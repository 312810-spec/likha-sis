// scripts/external-calendar/depedCalendarParser.mjs
// Pure text-parsing logic for DepEd's official school calendar issuance --
// no network or Firestore calls here. Handles both an HTML table (when a
// DepEd page publishes one directly) and PDF-extracted text (when, as is
// currently the case for DO 009, s. 2026, the calendar only exists inside
// the linked PDF). Unparseable rows/lines are skipped and logged, never
// fatal -- DepEd's page structure is out of our control and will drift.

import * as cheerio from "cheerio";

const MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

// "September 15-19, 2026" / "June 8, 2026"
const SAME_MONTH_RE = /([A-Za-z]+)\s+(\d{1,2})(?:\s*[-–—]\s*(\d{1,2}))?,?\s*(\d{4})/;
// "May 30 - June 3, 2026" (cross-month, same year)
const CROSS_MONTH_RE = /([A-Za-z]+)\s+(\d{1,2})\s*[-–—]\s*([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/;

// Ordered most-specific-activity first: a title like "Term 1 Final
// Examinations" should classify as an examination, not just as landing
// inside Term 1, so the generic term1/term2/term3 rules are checked last.
const CATEGORY_RULES = [
  [/opening of classes|start of classes|school opening/i, "schoolOpening"],
  [/closing of (the )?school year|end of (the )?school year|school closing/i, "schoolClosing"],
  [/opening block/i, "openingBlock"],
  [/end[- ]of[- ]term block/i, "endOfTermBlock"],
  [/instructional block/i, "instructionalBlock"],
  [/summative assessment/i, "summativeAssessment"],
  [/examination/i, "examination"],
  [/in-?set|in-service training/i, "inset"],
  [/wellness break/i, "wellnessBreak"],
  [/enrollment/i, "enrollment"],
  [/brigada eskwela/i, "brigadaEskwela"],
  [/pta|report card distribution|parent-teacher/i, "ptaConference"],
  [/\baral\b/i, "aral"],
  [/break|holiday|recess|non-working/i, "schoolBreak"],
  [/term\s*1\b/i, "term1"],
  [/term\s*2\b/i, "term2"],
  [/term\s*3\b/i, "term3"],
];

function toDateKey(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Best-effort category classification for an event title (spec section 5). */
export function classifyDepedEventCategory(title) {
  for (const [re, category] of CATEGORY_RULES) {
    if (re.test(title)) return category;
  }
  return "other";
}

/**
 * Parses a date or date range out of free text. Tries the cross-month
 * pattern first (more specific) before the same-month/single-day pattern.
 * Returns null when nothing date-like is found -- callers skip the row.
 */
function parseDateSpan(text) {
  const cross = CROSS_MONTH_RE.exec(text);
  if (cross) {
    const [matchedText, startMonthName, startDay, endMonthName, endDay, year] = cross;
    const startMonth = MONTHS[startMonthName.toLowerCase()];
    const endMonth = MONTHS[endMonthName.toLowerCase()];
    if (startMonth && endMonth) {
      return {
        matchedText,
        startDate: toDateKey(year, startMonth, startDay),
        endDate: toDateKey(year, endMonth, endDay),
      };
    }
  }

  const same = SAME_MONTH_RE.exec(text);
  if (same) {
    const [matchedText, monthName, startDay, endDay, year] = same;
    const month = MONTHS[monthName.toLowerCase()];
    if (month) {
      return {
        matchedText,
        startDate: toDateKey(year, month, startDay),
        endDate: toDateKey(year, month, endDay || startDay),
      };
    }
  }

  return null;
}

function extractTableRows(html) {
  const $ = cheerio.load(html);
  const rows = [];
  $("tr").each((_, tr) => {
    const cells = $(tr)
      .find("td")
      .map((__, td) => $(td).text().replace(/\s+/g, " ").trim())
      .get();
    if (cells.length >= 2) rows.push(cells);
  });
  return rows;
}

/** Parses a DepEd calendar HTML table (a `dateCell` + `titleCell` per row) into events. */
export function parseDepedCalendarHtml(html) {
  if (!html) return [];
  const events = [];
  for (const [dateCell, titleCell] of extractTableRows(html)) {
    if (!titleCell) continue;
    const parsed = parseDateSpan(dateCell);
    if (!parsed) {
      console.warn(`[depedCalendarParser] Skipping row with no parseable date: "${dateCell}" | "${titleCell}"`);
      continue;
    }
    events.push({
      title: titleCell,
      startDate: parsed.startDate,
      endDate: parsed.endDate,
      category: classifyDepedEventCategory(titleCell),
    });
  }
  return events;
}

/**
 * Parses plain text extracted from a DepEd calendar PDF (one candidate event
 * per line: a date or date range followed by, or preceded by, a description).
 */
export function parseDepedCalendarPdfText(text) {
  if (!text) return [];
  const events = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+/g, " ").trim();
    if (!line) continue;

    const parsed = parseDateSpan(line);
    if (!parsed) continue; // most PDF lines are prose, not calendar rows -- not a warning-worthy skip

    const title = line
      .replace(parsed.matchedText, "")
      .replace(/^[\s\-–—:.,]+|[\s\-–—:.,]+$/g, "")
      .trim();

    if (!title) {
      console.warn(`[depedCalendarParser] Skipping PDF line with a date but no title: "${line}"`);
      continue;
    }

    events.push({
      title,
      startDate: parsed.startDate,
      endDate: parsed.endDate,
      category: classifyDepedEventCategory(title),
    });
  }
  return events;
}

// DepEd's "Annex B" calendar matrix (confirmed against the real DO 009,
// s. 2026 PDF, OCR'd -- see lib/ocrPdf.mjs) is a table of "Month YYYY"
// section headers followed by day/day-range rows, each with one or more
// bullet items, e.g.:
//   December 2026
//   3-4 e Term 2 Examination
//   4 e End of Testing Window for NCAE
//   (Grade 10 only)
// A wrapped continuation line has no leading day number or bullet; a second
// bullet under the same day has a bullet but no leading day number (both
// happen constantly in the real document, e.g. "1-5" in June 2026 carries
// both "Brigada Eskwela" and "Enrollment Period"). OCR renders the bullet
// character "•" as "e" or "@" essentially every time.
const ANNEX_MONTH_HEADER_RE = /^([A-Za-z]+)\s+(\d{4})\s*$/;
// The day part is usually a single day or a simple range ("3-4"), but
// sometimes a discontinuous list ("24, 29, 30, & 31 e End-of-Term Block") --
// the leading `(?:\s*[,&]\s*\d{1,2})*` consumes the rest of that list so it
// doesn't fall through and get misread as a continuation of the *previous*
// entry (confirmed against the real document: without this, "24 e
// Announcement of ..." picks up a stray trailing "24" from the next line).
// This loses the "these are specific, non-contiguous days" nuance in favor
// of just anchoring on the first day -- an acceptable simplification next
// to the alternative of corrupting an unrelated entry.
const ANNEX_DAY_ROW_RE = /^(\d{1,2})(?:[,&\s]+\d{1,2})*\s*(?:[-–.](\d{1,2}))?\s+[e@●•]+\s*(.+)/;
const ANNEX_BULLET_ONLY_RE = /^[e@●•]+\s+(.+)/;

// Lines that come from the table's own headers, a "Class Days: NN" summary,
// a "TERM n" divider, or leaked digits/brackets from the mini-calendar
// thumbnail beside each month's entries (page cropping in ocrPdf.mjs
// removes most of that thumbnail, but not every page's layout is identical).
function isAnnexNoiseLine(line) {
  return (
    /class\s*days\s*:/i.test(line) ||
    /^month\W*activity\W*$/i.test(line) ||
    /^annex\s+[a-z]\b/i.test(line) ||
    /^term\s*\d/i.test(line) ||
    /^school\s+year\s+\d{4}/i.test(line) ||
    /^[\d\s|[\](){}.,-]+$/.test(line)
  );
}

// A continuation/second-bullet line is only trusted if it looks like real
// prose (a run of 3+ lowercase letters) -- garbled OCR noise from a stray
// table fragment is reliably almost-all-uppercase/digits/punctuation.
function looksLikeAnnexText(line) {
  return /[a-z]{3,}/.test(line) && !line.includes("|");
}

// The calendar matrix ends and a completely different, much longer table
// begins right after the last month's entries -- confirmed against the real
// document: a "Legend:" key, a "Summary of Three-Term School Calendar"
// class-days table, then a multi-page "Legal Basis and/or Date" table of
// holiday/observance legal citations. None of that is dated calendar data,
// and without a hard stop here the continuation-line fallback below will
// keep blindly appending that entire unrelated table (which reads as
// plausible prose line by line) onto whatever the last real entry was.
const ANNEX_END_RE = /^legend\s*:|^acronyms\s+used|summary of (the )?three-term school calendar|number of class days per month|legal basis/i;

// A genuine calendar entry is at most a sentence or two. Anything far
// longer is contamination from the failure mode above (or something
// similar this hasn't been tested against) -- dropped rather than kept,
// consistent with "skip if not confident" elsewhere in this parser.
const MAX_EVENT_TITLE_LENGTH = 220;

/**
 * Parses DepEd's Annex B-style calendar matrix out of OCR'd (or any other
 * plain-text) PDF content: repeated "Month YYYY" section headers followed
 * by day/day-range rows, each possibly carrying several bulleted activities
 * and wrapped continuation lines. Unlike parseDepedCalendarPdfText (one
 * self-contained date per line), state here -- the current month and the
 * current day/range -- carries across lines and across pages.
 */
export function parseDepedAnnexCalendarText(text) {
  if (!text) return [];
  const events = [];
  let currentMonth = null;
  let currentDate = null;
  let pending = null;

  function finalizePending() {
    if (pending && pending.title.trim()) {
      // A leading OCR punctuation/symbol artifact (e.g. a mis-recognized
      // second bullet glyph) is common enough to strip on the way out.
      const title = pending.title.trim().replace(/\s+/g, " ").replace(/^[^\w(]+/, "");
      if (title.length > MAX_EVENT_TITLE_LENGTH) {
        console.warn(`[depedCalendarParser] Dropping annex entry with a suspiciously long title (${title.length} chars) -- likely leaked unrelated content: "${title.slice(0, 60)}..."`);
      } else {
        events.push({
          title,
          startDate: pending.startDate,
          endDate: pending.endDate,
          category: classifyDepedEventCategory(title),
        });
      }
    }
    pending = null;
  }

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (ANNEX_END_RE.test(line)) {
      finalizePending();
      break;
    }
    if (isAnnexNoiseLine(line)) continue;

    const monthMatch = ANNEX_MONTH_HEADER_RE.exec(line);
    if (monthMatch) {
      const month = MONTHS[monthMatch[1].toLowerCase()];
      if (month) {
        finalizePending();
        currentMonth = { month, year: Number(monthMatch[2]) };
        currentDate = null;
        continue;
      }
    }

    const dayMatch = currentMonth && ANNEX_DAY_ROW_RE.exec(line);
    if (dayMatch) {
      finalizePending();
      const [, startDay, endDay, title] = dayMatch;
      currentDate = {
        startDate: toDateKey(currentMonth.year, currentMonth.month, startDay),
        endDate: toDateKey(currentMonth.year, currentMonth.month, endDay || startDay),
      };
      pending = { title, ...currentDate };
      continue;
    }

    const bulletMatch = currentDate && ANNEX_BULLET_ONLY_RE.exec(line);
    if (bulletMatch) {
      finalizePending();
      pending = { title: bulletMatch[1], ...currentDate };
      continue;
    }

    if (pending && looksLikeAnnexText(line)) {
      pending.title += ` ${line}`;
    }
  }
  finalizePending();

  return events;
}

/**
 * Orchestrates the HTML -> linked PDF -> events flow (spec section 4).
 * Tries the HTML table first, then the Annex B calendar-matrix parser and
 * the generic single-line parser against whatever PDF text was supplied
 * (from pdf-parse for a text PDF, or OCR for a scanned one -- this doesn't
 * care which); merges everything, deduplicating by startDate + normalized
 * title.
 */
export function parseDepedCalendarSource({ html, pdfText } = {}) {
  const fromHtml = html ? parseDepedCalendarHtml(html) : [];
  const fromAnnex = pdfText ? parseDepedAnnexCalendarText(pdfText) : [];
  const fromPdf = pdfText ? parseDepedCalendarPdfText(pdfText) : [];

  const seen = new Set();
  const deduped = [];
  for (const event of [...fromHtml, ...fromAnnex, ...fromPdf]) {
    const key = `${event.startDate}|${event.title.toLowerCase().replace(/[^a-z0-9]+/g, "")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(event);
  }
  return deduped;
}
