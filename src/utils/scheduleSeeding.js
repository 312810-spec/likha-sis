// src/utils/scheduleSeeding.js
// The "seed" gesture: turn a section's subject list plus sessions-per-week into a
// first-pass grid, so a fresh school year is mostly filled in one action. Every
// seeded cell is then editable by painting or dragging.

const SPREADS = {
  1: ["mon"],
  2: ["tue", "thu"],
  3: ["mon", "wed", "fri"],
  4: ["mon", "tue", "thu", "fri"],
  5: ["mon", "tue", "wed", "thu", "fri"],
};

export function spreadPattern(sessionsPerWeek) {
  if (!Number.isFinite(sessionsPerWeek) || sessionsPerWeek <= 0) return [];
  return SPREADS[Math.min(sessionsPerWeek, 5)];
}

export function seedSectionCells({ section, rows }) {
  const subjects = Array.isArray(section && section.subjects) ? section.subjects : [];
  const teachingRows = rows.filter((r) => r.kind === "teaching");
  const cells = {};

  subjects.forEach((entry, index) => {
    const row = teachingRows[index];
    if (!row) return;

    const days = spreadPattern(entry.sessionsPerWeek);
    if (days.length === 0) return;

    cells[row.id] = {};
    days.forEach((day) => {
      cells[row.id][day] = { subject: entry.subject, teacherId: entry.teacherId };
    });
  });

  return cells;
}
