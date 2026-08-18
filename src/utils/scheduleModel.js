// src/utils/scheduleModel.js
// Pure schedule geometry: turns a shift definition into the period rows that
// every Class Program and Teacher's Load grid is drawn on. No React, no
// Firestore -- this module is the single source of truth for *when* a slot is.

export const DAYS = ["mon", "tue", "wed", "thu", "fri"];

// The school day runs 6:00 AM to 6:00 PM, so a bare "1:20" is unambiguous:
// it can only mean afternoon. Hours 6-11 are morning, 12 is noon, 1-5 are PM.
export function parseTime(hhmm) {
  if (typeof hhmm !== "string") return NaN;
  const match = hhmm.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return NaN;

  const rawHour = Number(match[1]);
  const minutes = Number(match[2]);
  if (rawHour > 12 || minutes > 59) return NaN;

  let hour = rawHour;
  if (rawHour >= 1 && rawHour <= 5) hour = rawHour + 12;

  return hour * 60 + minutes;
}

export function formatTime(totalMinutes) {
  const hour24 = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(minutes).padStart(2, "0")}`;
}

export function formatRange(startMin, endMin) {
  return `${formatTime(startMin)} – ${formatTime(endMin)}`;
}

// The shift config is hand-seeded in the Firebase console with no validating
// UI, so ordinary entry errors (a malformed "6:00 AM" startTime, a missing
// periodsPerDay) are expected. Returns an array of human-readable problem
// strings; an empty array means the shift is safe to lay out.
export function validateShift(shift) {
  if (!shift || typeof shift !== "object") {
    return ["Shift configuration is missing."];
  }

  const problems = [];

  if (Number.isNaN(parseTime(shift.startTime))) {
    problems.push(
      `startTime ${JSON.stringify(shift.startTime)} is not a valid H:MM time.`
    );
  }

  const periodsPerDay = shift.periodsPerDay;
  const hasValidPeriodsPerDay = Number.isInteger(periodsPerDay) && periodsPerDay > 0;
  if (!hasValidPeriodsPerDay) {
    problems.push(
      `periodsPerDay must be a positive integer (got ${JSON.stringify(periodsPerDay)}).`
    );
  }

  const periodDuration = shift.periodDuration;
  if (
    typeof periodDuration !== "number" ||
    !Number.isFinite(periodDuration) ||
    periodDuration <= 0
  ) {
    problems.push(
      `periodDuration must be a positive number (got ${JSON.stringify(periodDuration)}).`
    );
  }

  const blocks = Array.isArray(shift.fixedBlocks) ? shift.fixedBlocks : [];
  blocks.forEach((block, index) => {
    if (
      typeof block.duration !== "number" ||
      !Number.isFinite(block.duration) ||
      block.duration <= 0
    ) {
      problems.push(`fixedBlocks[${index}].duration must be a positive number.`);
    }

    const upperBound = hasValidPeriodsPerDay ? periodsPerDay : null;
    const withinBounds =
      Number.isInteger(block.afterPeriod) &&
      block.afterPeriod >= 0 &&
      (upperBound === null || block.afterPeriod <= upperBound);
    if (!withinBounds) {
      problems.push(
        `fixedBlocks[${index}].afterPeriod must be an integer between 0 and periodsPerDay.`
      );
    }
  });

  return problems;
}

// Walks the shift sequence, emitting fixed blocks at their declared position and
// teaching periods in between. afterPeriod: 0 places a block before period 1;
// afterPeriod equal to periodsPerDay places it after the last period.
export function generatePeriodRows(shift) {
  if (validateShift(shift).length > 0) return [];

  const rows = [];
  const blocks = Array.isArray(shift.fixedBlocks) ? shift.fixedBlocks : [];
  let cursor = parseTime(shift.startTime);

  for (let placed = 0; placed <= shift.periodsPerDay; placed += 1) {
    blocks.forEach((block, blockIndex) => {
      if (block.afterPeriod !== placed) return;
      rows.push({
        id: `F${blockIndex}`,
        startMin: cursor,
        endMin: cursor + block.duration,
        kind: "fixed",
        label: block.label,
        labelByDay: block.labelByDay,
      });
      cursor += block.duration;
    });

    if (placed < shift.periodsPerDay) {
      rows.push({
        id: `P${placed + 1}`,
        startMin: cursor,
        endMin: cursor + shift.periodDuration,
        kind: "teaching",
        periodNumber: placed + 1,
      });
      cursor += shift.periodDuration;
    }
  }

  return rows;
}

// A teacher who works across both shifts sits on the union of two row sets whose
// boundaries do not line up. Splitting at every boundary is what reproduces the
// irregular rows (11:30-12:30, 3:30-4:15) seen in the reference document.
export function mergeRowSets(rowSets) {
  const boundaries = new Set();
  rowSets.forEach((rows) => {
    rows.forEach((row) => {
      boundaries.add(row.startMin);
      boundaries.add(row.endMin);
    });
  });

  const sorted = [...boundaries].sort((a, b) => a - b);
  const segments = [];

  for (let i = 0; i < sorted.length - 1; i += 1) {
    segments.push({
      id: `S${sorted[i]}`,
      startMin: sorted[i],
      endMin: sorted[i + 1],
    });
  }

  return segments;
}
