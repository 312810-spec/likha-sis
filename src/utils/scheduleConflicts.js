// src/utils/scheduleConflicts.js
// Timetable validation. Conflicts never block saving -- a half-built schedule is
// a legitimate intermediate state -- but they are surfaced in the builder and
// before printing.

import { DAYS } from "./scheduleModel";

function eachCell(sections, visit) {
  sections.forEach((section) => {
    const cells = section.cells || {};
    Object.keys(cells).forEach((periodId) => {
      DAYS.forEach((day) => {
        const cell = cells[periodId] ? cells[periodId][day] : null;
        if (cell && cell.subject) visit({ section, periodId, day, cell });
      });
    });
  });
}

export function findConflicts({ sections = [], teachersById = {} }) {
  const conflicts = [];

  // A teacher standing in two rooms at once.
  const occupancy = new Map();
  eachCell(sections, ({ section, periodId, day, cell }) => {
    if (!cell.teacherId) return;
    const key = `${cell.teacherId}|${periodId}|${day}`;
    if (!occupancy.has(key)) occupancy.set(key, []);
    occupancy.get(key).push(section);
  });

  occupancy.forEach((occupiedSections, key) => {
    if (occupiedSections.length < 2) return;
    const [teacherId, periodId, day] = key.split("|");
    const teacher = teachersById[teacherId];
    const name = teacher ? teacher.displayName : teacherId;
    const where = occupiedSections
      .map((s) => `${s.gradeLevel} - ${s.name}`)
      .join(" and ");

    conflicts.push({
      type: "teacherDoubleBooked",
      teacherId,
      periodId,
      day,
      message: `${name} is booked in ${where} at the same time.`,
    });
  });

  // A subject on the grid with nobody to teach it.
  eachCell(sections, ({ section, periodId, day, cell }) => {
    if (cell.teacherId) return;
    conflicts.push({
      type: "unstaffed",
      sectionId: section.id,
      periodId,
      day,
      subject: cell.subject,
      message: `${cell.subject} in ${section.gradeLevel} - ${section.name} has no teacher assigned.`,
    });
  });

  // Placed sessions vs the declared sessions per week.
  sections.forEach((section) => {
    const declared = Array.isArray(section.subjects) ? section.subjects : [];
    const placedCounts = new Map();

    eachCell([section], ({ cell }) => {
      placedCounts.set(cell.subject, (placedCounts.get(cell.subject) || 0) + 1);
    });

    declared.forEach((entry) => {
      const placed = placedCounts.get(entry.subject) || 0;
      if (placed === entry.sessionsPerWeek) return;

      conflicts.push({
        type: "sessionCountMismatch",
        sectionId: section.id,
        subject: entry.subject,
        message:
          `${entry.subject} in ${section.gradeLevel} - ${section.name} is placed ` +
          `${placed} time(s) but expects ${entry.sessionsPerWeek} per week.`,
      });
    });
  });

  // Assigned outside the teacher's qualified subjects. A warning, not a block --
  // real timetables occasionally require it.
  const seenOutOfQual = new Set();
  eachCell(sections, ({ section, periodId, day, cell }) => {
    const teacher = teachersById[cell.teacherId];
    if (!teacher) return;
    if (!Array.isArray(teacher.handles) || teacher.handles.length === 0) return;
    if (teacher.handles.includes(cell.subject)) return;

    const key = `${cell.teacherId}|${cell.subject}|${section.id}`;
    if (seenOutOfQual.has(key)) return;
    seenOutOfQual.add(key);

    conflicts.push({
      type: "outOfQualification",
      teacherId: cell.teacherId,
      sectionId: section.id,
      periodId,
      day,
      subject: cell.subject,
      message: `${teacher.displayName} is not listed as handling ${cell.subject}.`,
    });
  });

  return conflicts;
}
