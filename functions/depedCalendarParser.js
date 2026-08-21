// functions/depedCalendarParser.js
// Pure text-parsing logic for DepEd's published official School Calendar
// page. No network or Firestore calls here -- syncDepedCalendar.js does
// the fetching and writing; this file is the part that can drift out of
// sync with DepEd's actual page structure, so it's kept isolated and
// defensive: unparseable rows are skipped, never fatal.

const MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

const DATE_RANGE_RE = /([A-Za-z]+)\s+(\d{1,2})(?:\s*-\s*(\d{1,2}))?,\s*(\d{4})/;

function toDateKey(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function extractRows(html) {
  const rows = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  while ((rowMatch = rowRe.exec(html)) !== null) {
    const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells = [];
    let cellMatch;
    while ((cellMatch = cellRe.exec(rowMatch[1])) !== null) {
      cells.push(cellMatch[1].replace(/<[^>]+>/g, "").trim());
    }
    if (cells.length >= 2) rows.push(cells);
  }
  return rows;
}

/** Parses DepEd's published school calendar table HTML into discrete dated events. */
export function parseDepedCalendarHtml(html) {
  if (!html) return [];
  const events = [];
  for (const [dateCell, titleCell] of extractRows(html)) {
    const match = DATE_RANGE_RE.exec(dateCell);
    if (!match || !titleCell) continue;
    const [, monthName, startDay, endDay, year] = match;
    const month = MONTHS[monthName.toLowerCase()];
    if (!month) continue;
    events.push({
      title: titleCell,
      startDate: toDateKey(Number(year), month, Number(startDay)),
      endDate: toDateKey(Number(year), month, Number(endDay || startDay)),
      category: "deped",
    });
  }
  return events;
}
