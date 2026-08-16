// src/utils/keyStagesConfig.js
// Key Stage / grade-level definitions and DO 017 SHS default shapes.
// Shared by SetupWizard.jsx (first-run) and SchoolSettings.jsx (ongoing
// editing) so the two can never drift apart on what a Key Stage means or
// what a freshly-added SHS subject/cluster looks like.

export const KEY_STAGE_OPTIONS = [
  {
    key: "ks1",
    label: "Key Stage 1: Kindergarten to Grade 3",
    disabled: true,
    gradeLevels: [],
  },
  {
    key: "ks2",
    label: "Key Stage 2: Grades 4 to 6",
    disabled: false,
    gradeLevels: ["Grade 4", "Grade 5", "Grade 6"],
  },
  {
    key: "ks3",
    label: "Key Stage 3: Grades 7 to 10",
    disabled: false,
    gradeLevels: ["Grade 7", "Grade 8", "Grade 9", "Grade 10"],
  },
  {
    key: "ks4",
    label: "Key Stage 4: Grades 11 to 12 (Senior High)",
    disabled: false,
    gradeLevels: ["Grade 11", "Grade 12"],
  },
];

export function getGradeLevelsFromStages(stages) {
  const gradeLevels = [];
  KEY_STAGE_OPTIONS.forEach((stage) => {
    if (stages[stage.key] && !stage.disabled) gradeLevels.push(...stage.gradeLevels);
  });
  return gradeLevels;
}

export function makeDefaultShsSubjects() {
  return Array.from({ length: 5 }, (_, i) => ({
    id: `core${i + 1}`,
    name: `[Core Subject ${i + 1}]`,
    weightProfile: "core",
  }));
}

export function makeDefaultShsClusters() {
  return Array.from({ length: 10 }, (_, i) => ({
    id: `cluster${i + 1}`,
    name: `[Elective Cluster ${i + 1}]`,
    subjects: [],
  }));
}
