// src/schoolConfig.js
// Central place for school / division details used across the app.
// These are PLACEHOLDER values — the teacher should edit them with the
// real school information before generating certificates in production.

const schoolConfig = {
  schoolId: "302975",
  schoolName: "Tingub National High School",
  schoolAddress: "Tingub, Mandaue City, Cebu",
  divisionName: "Department of Education - Division of Mandaue City",
  principalName: "[Principal Full Name]",
  principalPosition: "School Principal",
  clinicTeacherName: "[School Clinic Teacher Full Name]",
  divisionSuperintendent: "[Schools Division Superintendent]",
  divisionSuperintendentPosition: "Schools Division Superintendent",
  region: "Region VII",
  divisionOffice: "Division of Mandaue City",
  district: "Mandaue City District III",
  municipalityCityProvince: "Mandaue City, Cebu",
  // Coordinates drive the local weather card and the "earthquake near your
  // school" radius. Approximate values for Tingub, Mandaue City -- the school
  // should refine these in School Settings. Weather simply doesn't render when
  // both are absent, rather than guessing a location.
  latitude: 10.3554,
  longitude: 123.935,
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
