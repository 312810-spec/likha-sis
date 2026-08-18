// src/utils/teacherLoadDerivation.js
// The Teacher's Load grid is DERIVED, never stored. It is rebuilt from the
// section grids every time, which is what structurally prevents the Class
// Program and the Teacher's Load from disagreeing.

import { DAYS, generatePeriodRows, formatRange } from "./scheduleModel";

export const DUTY_ROTATION = [
  "IMs Preparation",
  "Checking & Monitoring of Outputs",
  "Lesson Planning",
];

function formatDuration(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

// Ancillary designations (e.g. a "Mapeh Coor" coordinatorship) carry real
// weekly minutes per the source workbook's own formula
// (=INT(SUM(F2:F11)/60) & "h " & MOD(SUM(F2:F11),60) & "m", F = D * E) but
// occupy no cell on any section's class program, so the grid-derived totals
// below would otherwise give them zero. These docs are hand-seeded, so stay
// defensive: an entry with a missing/zero/non-numeric meetingsPerWeek or
// minutesPerMeeting is ignored rather than allowed to produce NaN on a
// printed document.
function sumAncillaryLoad(ancillaryLoad) {
  const entries = Array.isArray(ancillaryLoad) ? ancillaryLoad : [];
  let ancillaryMinutes = 0;
  const breakdown = [];

  entries.forEach((entry) => {
    const meetingsPerWeek = Number(entry && entry.meetingsPerWeek);
    const minutesPerMeeting = Number(entry && entry.minutesPerMeeting);
    if (!Number.isFinite(meetingsPerWeek) || meetingsPerWeek <= 0) return;
    if (!Number.isFinite(minutesPerMeeting) || minutesPerMeeting <= 0) return;

    const minutesPerWeek = meetingsPerWeek * minutesPerMeeting;
    ancillaryMinutes += minutesPerWeek;
    breakdown.push({ label: entry.label, minutesPerWeek });
  });

  return { ancillaryMinutes, breakdown };
}

export function deriveTeacherLoad({ teacher, sections = [], shiftsById = {} }) {
  const dutySlots = teacher.dutySlots || {};
  const { ancillaryMinutes, breakdown: ancillaryBreakdown } = sumAncillaryLoad(
    teacher.ancillaryLoad
  );

  // 1. Which shifts does this teacher actually appear in?
  const touchedShiftIds = [];
  const teaching = new Map(); // `${shiftId}|${periodId}|${day}` -> cell info
  const preparations = new Set();

  sections.forEach((section) => {
    const cells = section.cells || {};
    Object.keys(cells).forEach((periodId) => {
      DAYS.forEach((day) => {
        const cell = cells[periodId] ? cells[periodId][day] : null;
        if (!cell || cell.teacherId !== teacher.id) return;

        if (!touchedShiftIds.includes(section.shiftId)) {
          touchedShiftIds.push(section.shiftId);
        }
        teaching.set(`${section.shiftId}|${periodId}|${day}`, {
          subject: cell.subject,
          sectionLabel: section.name,
        });
        preparations.add(`${cell.subject}|${section.gradeLevel}`);
      });
    });
  });

  if (touchedShiftIds.length === 0) {
    return {
      rows: [],
      totals: {
        preparations: 0,
        countedMinutesPerWeek: ancillaryMinutes,
        countedLabel: formatDuration(ancillaryMinutes),
        uncountedMinutesPerWeek: 0,
        breakdown: ancillaryBreakdown,
      },
    };
  }

  // 2. Build the row set from every shift the teacher touches, ordered by clock
  //    time. Overlapping shifts produce the irregular boundaries in the source
  //    document.
  const rows = [];
  touchedShiftIds
    .filter((shiftId) => shiftsById[shiftId])
    .forEach((shiftId) => {
      generatePeriodRows(shiftsById[shiftId]).forEach((row) => {
        rows.push({ ...row, shiftId });
      });
    });
  rows.sort((a, b) => a.startMin - b.startMin);

  // 3. Fill each row, tracking gap rows so the rotation advances per gap row.
  let gapOrdinal = 0;
  let teachingMinutes = 0;
  let dutyMinutes = 0;
  let uncountedMinutes = 0;

  const loadRows = rows.map((row) => {
    const timeLabel = formatRange(row.startMin, row.endMin);
    const duration = row.endMin - row.startMin;
    const overrides = dutySlots[timeLabel] || {};
    const byDay = {};

    const isGapRow =
      row.kind === "teaching" &&
      !DAYS.some((day) => teaching.has(`${row.shiftId}|${row.id}|${day}`));

    DAYS.forEach((day, dayIndex) => {
      if (row.kind === "fixed") {
        const label =
          (row.labelByDay && row.labelByDay[day]) || row.label || "";
        byDay[day] = { kind: "fixed", text: label };
        return;
      }

      const taught = teaching.get(`${row.shiftId}|${row.id}|${day}`);
      if (taught) {
        teachingMinutes += duration;
        byDay[day] = {
          kind: "teaching",
          text: `${taught.subject}\n${taught.sectionLabel}`,
          subject: taught.subject,
          sectionLabel: taught.sectionLabel,
        };
        return;
      }

      if (overrides[day]) {
        dutyMinutes += duration;
        byDay[day] = { kind: "duty", text: overrides[day] };
        return;
      }

      // Rotation filler -- IMs Preparation / Checking & Monitoring of Outputs /
      // Lesson Planning -- is deliberately NOT counted toward the weekly total
      // (spec section 14.1), but its minutes are tracked so the printed sheet
      // can state that magnitude honestly instead of a hardcoded zero.
      uncountedMinutes += duration;
      const index = (gapOrdinal + dayIndex) % DUTY_ROTATION.length;
      byDay[day] = { kind: "duty", text: DUTY_ROTATION[index] };
    });

    if (isGapRow) gapOrdinal += 1;

    return { id: row.id, startMin: row.startMin, endMin: row.endMin, timeLabel, byDay };
  });

  // 4. Totals. See spec section 14.1 -- the counted-slot rule is explicit and the
  //    breakdown is rendered so the figure can be checked before printing.
  const breakdown = [];
  if (teachingMinutes > 0) {
    breakdown.push({ label: "Teaching load", minutesPerWeek: teachingMinutes });
  }
  if (dutyMinutes > 0) {
    breakdown.push({ label: "Ancillary duties", minutesPerWeek: dutyMinutes });
  }
  breakdown.push(...ancillaryBreakdown);

  const counted = teachingMinutes + dutyMinutes + ancillaryMinutes;

  return {
    rows: loadRows,
    totals: {
      preparations: preparations.size,
      countedMinutesPerWeek: counted,
      countedLabel: formatDuration(counted),
      uncountedMinutesPerWeek: uncountedMinutes,
      breakdown,
    },
  };
}
