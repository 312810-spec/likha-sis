import { describe, it, expect } from "vitest";
import { isOcrToolingAvailable, ocrPdfText } from "../lib/ocrPdf.mjs";

function fakeExecFile({ pdfinfoStdout = "Pages: 2\nPage size: 600 x 850 pts\n", failVersionCheck = false, failOcrRun = false, tesseractText = "line one\nline two" } = {}) {
  return async (bin, args) => {
    if (bin === "pdftoppm" && args.includes("-v")) {
      if (failVersionCheck) throw new Error("pdftoppm not found");
      return { stdout: "pdftoppm version 25.07.0" };
    }
    if (bin === "tesseract" && args.includes("--version")) {
      if (failVersionCheck) throw new Error("tesseract not found");
      return { stdout: "tesseract 5.4.0" };
    }
    if (bin === "pdfinfo") return { stdout: pdfinfoStdout };
    if (bin === "pdftoppm") return { stdout: "" };
    if (bin === "tesseract") {
      if (failOcrRun) throw new Error("tesseract crashed mid-run");
      return { stdout: tesseractText };
    }
    throw new Error(`Unexpected command in fake execFile: ${bin}`);
  };
}

describe("isOcrToolingAvailable", () => {
  it("returns true when both pdftoppm and tesseract version checks succeed", async () => {
    expect(await isOcrToolingAvailable(fakeExecFile())).toBe(true);
  });

  it("returns false when the tools aren't found", async () => {
    expect(await isOcrToolingAvailable(fakeExecFile({ failVersionCheck: true }))).toBe(false);
  });
});

describe("ocrPdfText", () => {
  it("returns null without attempting rasterization when tooling isn't available", async () => {
    const text = await ocrPdfText(Buffer.from("fake pdf"), { execFileImpl: fakeExecFile({ failVersionCheck: true }) });
    expect(text).toBeNull();
  });

  it("concatenates per-page OCR text in page order", async () => {
    const text = await ocrPdfText(Buffer.from("fake pdf"), {
      execFileImpl: fakeExecFile({ pdfinfoStdout: "Pages: 2\nPage size: 600 x 850 pts\n", tesseractText: "December 2026\n1 e Test Event" }),
    });
    expect(text).toContain("December 2026");
    // 2 pages, each contributing the same fixture text once.
    expect(text.split("December 2026")).toHaveLength(3);
  });

  it("returns null when the PDF has zero pages", async () => {
    const text = await ocrPdfText(Buffer.from("fake pdf"), {
      execFileImpl: fakeExecFile({ pdfinfoStdout: "Pages: 0\n" }),
    });
    expect(text).toBeNull();
  });

  it("returns null (not a throw) when the OCR run fails partway through", async () => {
    const text = await ocrPdfText(Buffer.from("fake pdf"), {
      execFileImpl: fakeExecFile({ failOcrRun: true }),
    });
    expect(text).toBeNull();
  });
});
