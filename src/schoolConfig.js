// src/schoolConfig.js
// Central place for school / division details used across the app.
// These are PLACEHOLDER values — the teacher should edit them with the
// real school information before generating certificates in production.

const schoolConfig = {
  schoolName: "Tingub National High School",
  schoolAddress: "Tingub, [City/Municipality], Cebu",
  divisionName: "Department of Education - Division of [Division Name]",
  principalName: "[Principal Full Name]",
  principalPosition: "School Principal",
  region: "[Region]",
  divisionOffice: "[Division Office Name]",
  district: "[District]",
  municipalityCityProvince: "[Municipality/City], [Province]",
  gradeLevelsOffered: [
    "Grade 4",
    "Grade 5",
    "Grade 6",
    "Grade 7",
    "Grade 8",
    "Grade 9",
    "Grade 10",
  ],
  // DO 017, s.2026 Strengthened SHS configuration -- only populated once a
  // school enables Key Stage 4 in Setup. subjects: the 5 mandatory Grade 11
  // core subjects; electiveClusters: the Tech-Pro Track's elective clusters,
  // each with its own subject list. Every subject/cluster name here is a
  // school-edited placeholder -- LIKHA-SIS doesn't assume DepEd's official
  // cluster catalog, since it isn't hardcoded anywhere in this app.
  shs: {
    subjects: [],
    electiveClusters: [],
  },
};

export default schoolConfig;
