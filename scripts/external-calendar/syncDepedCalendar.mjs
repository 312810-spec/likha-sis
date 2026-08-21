#!/usr/bin/env node
// scripts/external-calendar/syncDepedCalendar.mjs
// Entry point run by .github/workflows/sync-official-calendar.yml (daily).
// Discovers the official DepEd school-calendar issuance for the active
// school year, parses it (HTML table, falling back to the linked PDF's
// text), and upserts depedCalendarEvents -- never deleting the
// last-known-good calendar on a failed fetch, a failed parse, or an
// unexpectedly empty parse (spec section 7).

import { getFirestoreDb, upsertDepedCalendarEvents } from "./lib/firestoreWriter.mjs";
import { activeSchoolYear } from "./lib/schoolYear.mjs";
import { discoverDepedCalendarSource, resolveDepedSourceContent, isOfficialDepedUrl } from "./depedSourceDiscovery.mjs";
import { parseDepedCalendarSource } from "./depedCalendarParser.mjs";
import { ocrPdfText } from "./lib/ocrPdf.mjs";

// Below this many characters, pdf-parse's result isn't a real text layer --
// just stray metadata/whitespace pdf-parse sometimes returns for a scanned
// PDF (confirmed against the real DO 009, s. 2026 PDF: pdf-parse returns
// under 60 bytes for the whole 58-page scanned document).
const MIN_REAL_PDF_TEXT_LENGTH = 200;

/**
 * Text-layer extraction first (pdf-parse); only falls back to OCR when the
 * PDF genuinely has no usable text layer (spec section 4: "do not use OCR
 * unless the official PDF genuinely contains no extractable text"). OCR
 * uses Poppler + Tesseract (free, open-source, local system binaries -- see
 * lib/ocrPdf.mjs) -- never an AI API. The actual date/event interpretation
 * stays deterministic regex code in depedCalendarParser.mjs either way; OCR
 * only substitutes for "read the text off the page image".
 */
async function fetchAndExtractPdfText(url) {
  if (!isOfficialDepedUrl(url)) return "";
  const res = await fetch(url);
  if (!res.ok) return "";
  const buffer = Buffer.from(await res.arrayBuffer());

  let textLayer = "";
  try {
    const { default: pdfParse } = await import("pdf-parse");
    const parsed = await pdfParse(buffer);
    textLayer = parsed.text || "";
  } catch (error) {
    console.warn(`[syncDepedCalendar] Failed to extract PDF text layer: ${error.message}`);
  }

  if (textLayer.trim().length >= MIN_REAL_PDF_TEXT_LENGTH) return textLayer;

  console.warn("[syncDepedCalendar] PDF has no usable text layer (likely scanned) -- falling back to OCR.");
  const ocrText = await ocrPdfText(buffer).catch((error) => {
    console.error(`[syncDepedCalendar] OCR failed: ${error.message}`);
    return null;
  });
  return ocrText || "";
}

async function main() {
  const schoolYear = activeSchoolYear();
  console.log(`[syncDepedCalendar] Active school year: ${schoolYear}`);

  const candidate = await discoverDepedCalendarSource({ schoolYear }).catch((error) => {
    console.error(`[syncDepedCalendar] Discovery failed: ${error.message}`);
    return null;
  });

  if (!candidate) {
    console.warn("[syncDepedCalendar] No official DepEd source discovered -- keeping last-known-good calendar.");
    return;
  }

  const source = await resolveDepedSourceContent({ candidate }).catch((error) => {
    console.error(`[syncDepedCalendar] Failed to resolve source content: ${error.message}`);
    return null;
  });

  if (!source) {
    console.warn("[syncDepedCalendar] Could not load the discovered source -- keeping last-known-good calendar.");
    return;
  }

  console.log(`[syncDepedCalendar] Source: ${source.sourceType || "DepEd issuance"} ${source.sourceNumber ? `No. ${source.sourceNumber}, s. ${source.sourceYear}` : ""} -- ${source.sourceUrl}`);
  if (source.sourcePdfUrl) console.log(`[syncDepedCalendar] Linked PDF: ${source.sourcePdfUrl}`);

  const pdfText = source.sourcePdfUrl ? await fetchAndExtractPdfText(source.sourcePdfUrl).catch(() => "") : "";
  const events = parseDepedCalendarSource({ html: source.html, pdfText });

  if (events.length === 0) {
    console.warn("[syncDepedCalendar] Parsed zero events from the official source -- keeping last-known-good calendar.");
    return;
  }

  const db = getFirestoreDb();
  const { synced, removed } = await upsertDepedCalendarEvents({ db, schoolYear, events, source });
  console.log(`[syncDepedCalendar] Synced ${synced} event(s) for SY ${schoolYear}; removed ${removed} stale event(s).`);
}

main().catch((error) => {
  console.error("[syncDepedCalendar] Unexpected failure:", error);
  process.exitCode = 1;
});
