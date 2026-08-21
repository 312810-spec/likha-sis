// scripts/external-calendar/lib/ocrPdf.mjs
// OCR fallback for a DepEd calendar PDF that has no extractable text layer
// (confirmed the case for DO 009, s. 2026 -- a scanned document; pdf-parse
// returns ~0 bytes of text for it). Per spec: OCR only when the PDF
// genuinely has no extractable text, and never an AI API -- this shells out
// to `pdftoppm` (Poppler) to rasterize pages and `tesseract` (Tesseract
// OCR) to recognize text, both free/open-source system binaries (apt-get
// install poppler-utils tesseract-ocr on the GitHub Actions runner). The
// actual calendar interpretation stays deterministic regex/state-machine
// code in depedCalendarParser.mjs -- OCR only substitutes for "read the
// text off the page image", the same role pdf-parse plays for a text PDF.
//
// Verified against the real DO_s2026_009r.pdf while building this: 58
// pages, Annex B (the actual dated calendar matrix) is a clean typed table
// with a small illustrative mini-calendar image to the right of each
// month's entries. Cropping each page to its left ~65% before OCR removes
// that mini-calendar image and the noise it otherwise introduces into the
// recognized text. A full 58-page OCR run took ~1 minute locally -- fine
// for the once-daily schedule this runs on.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const realExecFile = promisify(execFile);

const MAX_OCR_PAGES = 80; // guards against an unexpectedly huge future document

async function toolVersion(execFileImpl, bin, args) {
  try {
    await execFileImpl(bin, args);
    return true;
  } catch {
    return false;
  }
}

/** True when both `pdftoppm` and `tesseract` are on PATH. `execFileImpl` is injectable for tests. */
export async function isOcrToolingAvailable(execFileImpl = realExecFile) {
  const [poppler, tesseract] = await Promise.all([
    toolVersion(execFileImpl, "pdftoppm", ["-v"]),
    toolVersion(execFileImpl, "tesseract", ["--version"]),
  ]);
  return poppler && tesseract;
}

async function getPageCount(execFileImpl, pdfPath) {
  const { stdout } = await execFileImpl("pdfinfo", [pdfPath]);
  const match = /^Pages:\s+(\d+)/m.exec(stdout);
  return match ? Number(match[1]) : 0;
}

async function getPageSizePixels(execFileImpl, pdfPath, dpi) {
  const { stdout } = await execFileImpl("pdfinfo", [pdfPath]);
  const match = /^Page size:\s+([\d.]+)\s*x\s*([\d.]+)\s*pts/m.exec(stdout);
  if (!match) return null;
  const [, widthPts, heightPts] = match;
  return {
    width: Math.round((Number(widthPts) / 72) * dpi),
    height: Math.round((Number(heightPts) / 72) * dpi),
  };
}

/**
 * Rasterizes and OCRs every page of a PDF buffer with no text layer,
 * returning the concatenated recognized text in page order (so a
 * month-header context on one page carries into the next), or null when the
 * OCR toolchain isn't available or the run fails outright. Never throws --
 * callers treat null as "keep last-known-good data", the same as any other
 * fetch/parse failure.
 *
 * `execFileImpl` is injectable (defaults to Node's real execFile, promisified)
 * so tests can simulate the toolchain without needing real Poppler/Tesseract
 * binaries installed.
 */
export async function ocrPdfText(pdfBuffer, { dpi = 200, cropWidthFraction = 0.65, execFileImpl = realExecFile } = {}) {
  if (!(await isOcrToolingAvailable(execFileImpl))) {
    console.warn("[ocrPdf] pdftoppm/tesseract not found on PATH -- skipping OCR.");
    return null;
  }

  const dir = await mkdtemp(join(tmpdir(), "deped-ocr-"));
  const pdfPath = join(dir, "source.pdf");
  try {
    await writeFile(pdfPath, pdfBuffer);

    const totalPages = await getPageCount(execFileImpl, pdfPath);
    if (totalPages === 0) return null;
    const pageCount = Math.min(totalPages, MAX_OCR_PAGES);
    if (totalPages > MAX_OCR_PAGES) {
      console.warn(`[ocrPdf] Document has ${totalPages} pages -- only OCR-ing the first ${MAX_OCR_PAGES}.`);
    }

    const size = await getPageSizePixels(execFileImpl, pdfPath, dpi);
    const cropArgs = size
      ? ["-x", "0", "-y", "0", "-W", String(Math.round(size.width * cropWidthFraction)), "-H", String(size.height)]
      : [];

    const pagesText = [];
    for (let page = 1; page <= pageCount; page += 1) {
      // -singlefile gives a fixed, predictable filename (no page-number
      // suffix to predict/guess -- confirmed against a real multi-page PDF
      // while building this).
      const pngPath = join(dir, `page-${page}.png`);
      await execFileImpl("pdftoppm", ["-png", "-singlefile", "-r", String(dpi), "-f", String(page), "-l", String(page), ...cropArgs, pdfPath, join(dir, `page-${page}`)]);
      const { stdout } = await execFileImpl("tesseract", [pngPath, "stdout", "--psm", "4"], { maxBuffer: 1024 * 1024 * 8 });
      pagesText.push(stdout);
    }

    return pagesText.join("\n\n");
  } catch (error) {
    console.error(`[ocrPdf] OCR run failed: ${error.message}`);
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
