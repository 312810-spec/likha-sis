const TRANSMUTATION_TABLE = [
  { min: 0, grade: 60 },
  { min: 4.68, grade: 61 },
  { min: 9.35, grade: 62 },
  { min: 14.01, grade: 63 },
  { min: 18.68, grade: 64 },
  { min: 23.35, grade: 65 },
  { min: 28.01, grade: 66 },
  { min: 32.68, grade: 67 },
  { min: 37.34, grade: 68 },
  { min: 42.01, grade: 69 },
  { min: 46.67, grade: 70 },
  { min: 51.34, grade: 71 },
  { min: 56.01, grade: 72 },
  { min: 60.67, grade: 73 },
  { min: 65.34, grade: 74 },
  { min: 70, grade: 75 },
  { min: 71.18, grade: 76 },
  { min: 72.36, grade: 77 },
  { min: 73.54, grade: 78 },
  { min: 74.72, grade: 79 },
  { min: 75.9, grade: 80 },
  { min: 77.08, grade: 81 },
  { min: 78.26, grade: 82 },
  { min: 79.44, grade: 83 },
  { min: 80.62, grade: 84 },
  { min: 81.8, grade: 85 },
  { min: 82.98, grade: 86 },
  { min: 84.16, grade: 87 },
  { min: 85.34, grade: 88 },
  { min: 86.52, grade: 89 },
  { min: 87.7, grade: 90 },
  { min: 88.88, grade: 91 },
  { min: 90.06, grade: 92 },
  { min: 91.24, grade: 93 },
  { min: 92.42, grade: 94 },
  { min: 93.6, grade: 95 },
  { min: 94.78, grade: 96 },
  { min: 95.96, grade: 97 },
  { min: 97.14, grade: 98 },
  { min: 98.32, grade: 99 },
  { min: 99.5, grade: 100 },
];

export function transmuteGrade(initialGrade) {
  if (typeof initialGrade !== 'number' || Number.isNaN(initialGrade) || initialGrade < 0) {
    return null;
  }
  if (initialGrade === 0) {
    return 0;
  }
  for (let i = TRANSMUTATION_TABLE.length - 1; i >= 0; i--) {
    if (initialGrade >= TRANSMUTATION_TABLE[i].min) {
      return TRANSMUTATION_TABLE[i].grade;
    }
  }
  return 60;
}

export function getGradeDescription(termGrade) {
  if (typeof termGrade !== 'number' || Number.isNaN(termGrade)) {
    return null;
  }
  if (termGrade >= 90 && termGrade <= 100) {
    return 'Advancing (Namumukod-tangi)';
  }
  if (termGrade >= 80 && termGrade < 90) {
    return 'Benchmarking (Napamamalas)';
  }
  if (termGrade >= 75 && termGrade < 80) {
    return 'Connecting (Natutungo)';
  }
  if (termGrade >= 65 && termGrade < 75) {
    return 'Developing (Napauunlad)';
  }
  if (termGrade >= 0 && termGrade < 65) {
    return 'Emerging (Nagsisimula)';
  }
  return null;
}
