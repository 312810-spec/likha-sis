import { describe, it, expect } from "vitest";
import {
  parseDepedCalendarHtml,
  parseDepedCalendarPdfText,
  parseDepedCalendarSource,
  parseDepedAnnexCalendarText,
  classifyDepedEventCategory,
} from "../depedCalendarParser.mjs";

const sampleHtml = `
<table>
  <tr><td>June 8, 2026</td><td>Opening of Classes</td></tr>
  <tr><td>September 15-19, 2026</td><td>Term 1 Final Examinations</td></tr>
  <tr><td>May 30 - June 3, 2026</td><td>Enrollment Period</td></tr>
  <tr><td>not a date at all</td><td>Malformed row, should be skipped</td></tr>
</table>
`;

describe("parseDepedCalendarHtml", () => {
  it("extracts single-day events", () => {
    const events = parseDepedCalendarHtml(sampleHtml);
    expect(events).toContainEqual({
      title: "Opening of Classes",
      startDate: "2026-06-08",
      endDate: "2026-06-08",
      category: "schoolOpening",
    });
  });

  it("extracts same-month date-range events", () => {
    const events = parseDepedCalendarHtml(sampleHtml);
    expect(events).toContainEqual({
      title: "Term 1 Final Examinations",
      startDate: "2026-09-15",
      endDate: "2026-09-19",
      category: "examination",
    });
  });

  it("extracts cross-month date-range events", () => {
    const events = parseDepedCalendarHtml(sampleHtml);
    expect(events).toContainEqual({
      title: "Enrollment Period",
      startDate: "2026-05-30",
      endDate: "2026-06-03",
      category: "enrollment",
    });
  });

  it("skips rows that don't contain a parseable date", () => {
    const events = parseDepedCalendarHtml(sampleHtml);
    expect(events.find((e) => e.title.includes("Malformed"))).toBeUndefined();
  });

  it("returns an empty array for empty or unparseable input", () => {
    expect(parseDepedCalendarHtml("")).toEqual([]);
    expect(parseDepedCalendarHtml("<p>no table here</p>")).toEqual([]);
  });
});

describe("parseDepedCalendarPdfText", () => {
  const pdfText = `
DepEd Order No. 009, s. 2026

Guidelines on the Implementation of the Three-Term School Calendar

June 8, 2026 - Opening of Classes
September 15-19, 2026 - Term 1 Final Examinations
This is just narrative text with no date in it.
April 9, 2027 - Closing of School Year
`;

  it("extracts single dates and date ranges from PDF-extracted text", () => {
    const events = parseDepedCalendarPdfText(pdfText);
    expect(events).toContainEqual({
      title: "Opening of Classes",
      startDate: "2026-06-08",
      endDate: "2026-06-08",
      category: "schoolOpening",
    });
    expect(events).toContainEqual({
      title: "Term 1 Final Examinations",
      startDate: "2026-09-15",
      endDate: "2026-09-19",
      category: "examination",
    });
    expect(events).toContainEqual({
      title: "Closing of School Year",
      startDate: "2027-04-09",
      endDate: "2027-04-09",
      category: "schoolClosing",
    });
  });

  it("does not produce an event for prose lines with no date", () => {
    const events = parseDepedCalendarPdfText(pdfText);
    expect(events.some((e) => e.title.includes("narrative"))).toBe(false);
  });

  it("returns an empty array for empty input", () => {
    expect(parseDepedCalendarPdfText("")).toEqual([]);
  });
});

describe("classifyDepedEventCategory", () => {
  it("classifies known DepEd calendar activity types", () => {
    expect(classifyDepedEventCategory("Brigada Eskwela")).toBe("brigadaEskwela");
    expect(classifyDepedEventCategory("INSET Day 2")).toBe("inset");
    expect(classifyDepedEventCategory("Wellness Break")).toBe("wellnessBreak");
    expect(classifyDepedEventCategory("PTA / Report Card Distribution")).toBe("ptaConference");
  });

  it("falls back to 'other' for unrecognized titles", () => {
    expect(classifyDepedEventCategory("Flag Ceremony")).toBe("other");
  });
});

// Real Tesseract OCR output (--psm 4) from the actual DO_s2026_009r.pdf's
// Annex B, page cropped to its left 65% (see lib/ocrPdf.mjs), captured
// while building this parser -- not a hand-written fixture.
const REAL_ANNEX_OCR_EXCERPT = `
Annex B

THREE-TERM SCHOOL CALENDAR IN BAS
FOR SCHOOL YEAR (SY) 2026-:

End-of-School Year (EOSY) 202

Month I Activity

April 2026

1 e Start of 30-day Teachers' EOSY Break

2 e Maundy Thursday (Regular Holiday)

3 e Good Friday (Regular Holiday)

4 e Black Saturday (Additional Special
Non-Working Holiday)

9 e The Day of Valor (Regular Holiday)

13.17 e 2026 National Schools Press
Conference (NSPC)

School Year 2026-2027
Month Activity
June 2026
1-5 e Brigada Eskwela
e Enrollment Period
8-11 e Opening Block: Start of Term 1

e Start of Mandatory Learners' Health
Assessment, Learners and Parents'
Orientation, and other activities
`;

describe("parseDepedAnnexCalendarText", () => {
  it("parses single days, day ranges, and a '.'-misread range separator from real OCR text", () => {
    const events = parseDepedAnnexCalendarText(REAL_ANNEX_OCR_EXCERPT);
    expect(events).toContainEqual({
      title: "Start of 30-day Teachers' EOSY Break",
      startDate: "2026-04-01",
      endDate: "2026-04-01",
      category: "schoolBreak",
    });
    expect(events).toContainEqual({
      title: "2026 National Schools Press Conference (NSPC)",
      startDate: "2026-04-13",
      endDate: "2026-04-17",
      category: "other",
    });
  });

  it("splits multiple bullets under the same day into separate same-dated events", () => {
    const events = parseDepedAnnexCalendarText(REAL_ANNEX_OCR_EXCERPT);
    const brigada = events.find((e) => e.title === "Brigada Eskwela");
    const enrollment = events.find((e) => e.title === "Enrollment Period");
    expect(brigada).toMatchObject({ startDate: "2026-06-01", endDate: "2026-06-05" });
    expect(enrollment).toMatchObject({ startDate: "2026-06-01", endDate: "2026-06-05" });
  });

  it("joins wrapped continuation lines onto the current entry's title", () => {
    const events = parseDepedAnnexCalendarText(REAL_ANNEX_OCR_EXCERPT);
    expect(events).toContainEqual(
      expect.objectContaining({
        title: expect.stringContaining("Start of Mandatory Learners' Health Assessment"),
        startDate: "2026-06-08",
        endDate: "2026-06-11",
      })
    );
  });

  it("does not leak the 'Month | Activity' table header or 'School Year' divider into an entry", () => {
    const events = parseDepedAnnexCalendarText(REAL_ANNEX_OCR_EXCERPT);
    expect(events.some((e) => /month.*activity/i.test(e.title))).toBe(false);
    expect(events.some((e) => /school year 2026-2027/i.test(e.title))).toBe(false);
  });

  it("anchors a comma/ampersand day list ('24, 29, 30, & 31') on the first day without corrupting the previous entry", () => {
    const text = `
December 2026
24 e Announcement of Academic Excellence Awardees
24, 29, 30, & 31 e Computation of Grades, Accomplishment of School Forms
`;
    const events = parseDepedAnnexCalendarText(text);
    expect(events).toContainEqual({
      title: "Announcement of Academic Excellence Awardees",
      startDate: "2026-12-24",
      endDate: "2026-12-24",
      category: "other",
    });
    expect(events).toContainEqual({
      title: "Computation of Grades, Accomplishment of School Forms",
      startDate: "2026-12-24",
      endDate: "2026-12-24",
      category: "other",
    });
  });

  it("stops at the 'ACRONYMS USED' section instead of absorbing the glossary as calendar entries", () => {
    const text = `
June 2027
7-11 e Brigada Eskwela
e Enrollment Period

ACRONYMS USED

e BOSY - Beginning-of-School Year
e CRLA - Comprehensive Rapid Literacy Assessment
`;
    const events = parseDepedAnnexCalendarText(text);
    expect(events).toHaveLength(2);
    expect(events.some((e) => e.title.includes("BOSY"))).toBe(false);
  });

  it("drops (rather than keeps) an entry whose title balloons past a sane length from leaked unrelated content", () => {
    const hugeTail = "unrelated legal citation text ".repeat(20);
    const text = `
March 2027
5 e Short Real Event
${hugeTail}
`;
    const events = parseDepedAnnexCalendarText(text);
    expect(events).toHaveLength(0); // the continuation glommed onto the only entry, pushing it over the cap
  });

  it("returns an empty array for empty input", () => {
    expect(parseDepedAnnexCalendarText("")).toEqual([]);
  });
});

describe("parseDepedCalendarSource", () => {
  it("merges HTML and PDF results, deduplicating identical events", () => {
    const events = parseDepedCalendarSource({
      html: '<table><tr><td>June 8, 2026</td><td>Opening of Classes</td></tr></table>',
      pdfText: "June 8, 2026 - Opening of Classes\nSeptember 15-19, 2026 - Term 1 Final Examinations",
    });
    expect(events).toHaveLength(2);
    expect(events.filter((e) => e.title === "Opening of Classes")).toHaveLength(1);
  });

  it("returns an empty array when both sources are missing", () => {
    expect(parseDepedCalendarSource({})).toEqual([]);
  });
});
