// src/pageAccess.js

export const PAGE_ACCESS = {
  dashboard: "all",
  sf1: ["adviser", "ictCoordinator", "principal"],
  sf2: ["adviser"],
  sf4: ["adviser"],
  classRecord: ["subjectTeacher", "adviser"],
  consolidatedGrades: ["subjectTeacher", "adviser", "principal", "masterTeacher", "smeaCoordinator"],
  reportCard: ["adviser", "principal"],
  viewLearners: "all",
  lardoTracking: ["adviser", "masterTeacher", "principal", "smeaCoordinator", "guidance"],
  nutritionStatus: ["adviser", "smeaCoordinator"],
  nutritionConsolidator: ["adviser", "smeaCoordinator", "principal"],
  trans