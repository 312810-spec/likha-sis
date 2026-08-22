// src/data/depedSubjectDirectory.js
// Canonical DepEd subject directory, transcribed verbatim from
// `public/DepEd Philippines Curriculum Subject Directory (MATATAG & SHS).docx`
// (§7-8 of the teacher-scoping/subject-directory task). This answers "what
// subjects exist for a key stage" -- it is NOT "what does this teacher
// teach" (that's users/{uid}.assignments) and NOT the grading/print sources
// of truth (SUBJECT_WEIGHTS in subjectWeights.js, LEGACY_SUBJECT_ROWS in
// subjectRows.js). See docs/ai/DECISIONS.md for the three-way split.
//
// Grade 11 (Strengthened SHS: 5 streamlined core + elective clusters) and
// Grade 12 (Original K-12 SHS: applied subjects + strand-specific
// specialized subjects) are DELIBERATELY separate sets per DO 017 -- the
// source document itself treats them as two different curricula, not one
// flat "SHS" bag.
//
// Each subject entry: { id, label, aliases }. `id` mirrors the key
// convention already used by LEGACY_SUBJECT_ROWS (subjectRows.js) so
// findCanonicalKey() keeps working unmodified against either source.
//
// TERM COVERAGE: the source document does not break any SHS subject down by
// term (Term 1/2/3) -- it lists subjects per grade/cluster/strand only, with
// no per-subject term assignment or cascade information. Per the update
// task's explicit instruction not to fabricate missing curriculum data,
// every entry here defaults to ALL_TERMS (all three terms) via
// getSubjectsForGradeLevel()/searchSubjects() in subjectDirectory.js, which
// matches today's actual behavior (no term filtering exists yet). An entry
// gets an explicit narrower `terms: [...]` only once DepEd/the school
// publishes which term(s) it's actually offered in -- never guessed here.
export const ALL_TERMS = [1, 2, 3];

// Key Stage 1 (Kindergarten-Grade 3) is a catalog entry only -- gated off by
// keyStagesConfig.js's `disabled: true` for ks1, same as the rest of the app.
export const KS1_SUBJECTS = [
  { id: "LANGUAGE", label: "Language", aliases: [] },
  { id: "READING AND LITERACY", label: "Reading and Literacy", aliases: [] },
  { id: "MATHEMATICS", label: "Mathematics", aliases: ["Math"] },
  { id: "MAKABANSA", label: "Makabansa (National Identity, Civics & Culture)", aliases: ["Makabansa"] },
  { id: "GMRC", label: "GMRC (Good Manners and Right Conduct)", aliases: ["GMRC"] },
  { id: "ENGLISH", label: "English", aliases: [] },
  { id: "FILIPINO", label: "Filipino", aliases: [] },
  { id: "SCIENCE", label: "Science", aliases: [] },
];

// The 6 learning areas common to both Key Stage 2 (Grades 4-6) and Key
// Stage 3 (Grades 7-10) learning areas, per the source document. Keys/
// aliases mirror LEGACY_SUBJECT_ROWS exactly.
const KS2_KS3_SHARED_SUBJECTS = [
  { id: "ENGLISH", label: "English", aliases: [] },
  { id: "FILIPINO", label: "Filipino", aliases: [] },
  { id: "MATHEMATICS", label: "Mathematics", aliases: ["Math"] },
  { id: "SCIENCE", label: "Science", aliases: [] },
  { id: "ARALING PANLIPUNAN", label: "Araling Panlipunan (AP)", aliases: ["AP"] },
  { id: "MAPEH", label: "MAPEH", aliases: [] },
];

// Key Stage 2 (Grades 4-6): EPP and GMRC are their own separate subjects
// here, never combined with their Key Stage 3 counterpart into one
// slash-joined name. A subject-teacher assignment's `subject` value becomes
// part of a Class Record's Firestore document ID (see utils/classRecordId.js)
// -- a "/" in that value used to be parsed as a path separator and crash the
// load, so this directory must never offer a combined name again. The
// combined "GMRC / Values Education" / "EPP / TLE" labels stay only as
// aliases, so a pre-existing assignment still saved under the old combined
// name is recognized (see LEGACY_SUBJECT_ROWS in subjectRows.js, and the
// backward-compatible keys kept in subjectWeights.js).
export const KS2_SUBJECTS = [
  ...KS2_KS3_SHARED_SUBJECTS,
  {
    id: "GMRC",
    label: "GMRC",
    aliases: ["Good Manners and Right Conduct", "GMRC / Values Education"],
  },
  {
    id: "EPP",
    label: "EPP",
    aliases: ["Edukasyong Pantahanan at Pangkabuhayan", "EPP / TLE"],
  },
];

// Key Stage 3 (Grades 7-10): TLE and Values Education are their own
// separate subjects, for the same reason as KS2_SUBJECTS above. TLE
// additionally carries a Major (e.g. CSS, Cookery) for Grades 9-10 only --
// chosen on the Class Record page itself, not baked into this directory
// entry (Grades 7-8 TLE is exploratory, with no major).
export const KS3_SUBJECTS = [
  ...KS2_KS3_SHARED_SUBJECTS,
  {
    id: "VALUES EDUCATION",
    label: "Values Education",
    aliases: [
      "Edukasyon sa Pagpapakatao",
      "Edukasyon sa Pagpapakatao (EsP)",
      "EsP",
      "GMRC / Values Education",
    ],
  },
  {
    id: "TLE",
    label: "TLE",
    aliases: ["Technology and Livelihood Education", "TLE / ICT Specializations", "EPP / TLE"],
  },
];

// Grade 11 -- Strengthened SHS Program: 5 streamlined core subjects for ALL
// strands, plus strand-specific elective clusters (including TechPro/TVL
// and Field Experience).
export const GRADE_11_CORE_SUBJECTS = [
  { id: "EFFECTIVE COMMUNICATION", label: "Effective Communication / Mabisang Komunikasyon", aliases: [] },
  { id: "LIFE AND CAREER SKILLS", label: "Life and Career Skills", aliases: [] },
  { id: "GENERAL MATHEMATICS", label: "General Mathematics", aliases: [] },
  { id: "GENERAL SCIENCE", label: "General Science", aliases: [] },
  {
    id: "KASAYSAYAN AT LIPUNANG PILIPINO",
    label: "Pag-aaral ng Kasaysayan at Lipunang Pilipino",
    aliases: [],
  },
];

export const GRADE_11_ELECTIVE_CLUSTERS = [
  {
    id: "stem",
    name: "STEM Cluster",
    subjects: [
      "Pre-Calculus 1", "Pre-Calculus 2", "Advanced Mathematics 1", "Advanced Mathematics 2",
      "Trigonometry 1", "Trigonometry 2", "Finite Mathematics",
      "Fundamentals of Data Analytics & Management",
      "Biology 1", "Biology 2", "Chemistry 1", "Chemistry 2", "Physics 1", "Physics 2",
      "Earth & Space Science 1", "Earth & Space Science 2", "Empowerment Technologies",
    ],
  },
  {
    id: "business_entrepreneurship",
    name: "Business & Entrepreneurship",
    subjects: [
      "Basic Accounting", "Business Finance & Income Taxation",
      "Contemporary Marketing & Business Economics", "Entrepreneurship",
      "Introduction to Organization & Management",
    ],
  },
  {
    id: "arts_social_science_humanities",
    name: "Arts, Social Science & Humanities",
    subjects: [
      "Creative Writing / Malikhaing Pagsulat", "Philippine Politics & Governance",
      "Introduction to Philosophy of the Human Person", "Citizenship & Civic Engagement",
      "Cultivating Filipino Identity Through the Arts",
      "Creative Industries (Visual, Media, Music, Dance, Theater)",
      "Leadership & Management in Creative Industries",
      "Wika at Komunikasyon sa Akademikong Filipino",
    ],
  },
  {
    id: "sports_health_wellness",
    name: "Sports, Health & Wellness",
    subjects: [
      "Exercise & Sports Programming", "Safety & First Aid", "Introduction to Human Movement",
      "Sports Activity Management", "Sports Coaching", "Sports Officiating",
      "PE (Fitness, Recreation, & Dance)",
    ],
  },
  {
    id: "techpro_tvl",
    name: "TechPro / TVL Clusters",
    subjects: [
      "Agriculture & Fishery Arts (AFA NC II)", "ICT - Animation", "ICT - Computer Programming NC III",
      "ICT - Illustration", "ICT - Visual Graphic Design", "Home Economics", "Industrial Arts",
    ],
  },
  {
    id: "field_experience",
    name: "Field Experience / Exposure",
    subjects: [
      "Arts Apprenticeship (160 hrs)", "In-Campus/Off-Campus Field Exposure (320 hrs)",
      "Industry Exposure / Immersion",
    ],
  },
];

// Grade 12 -- Original / Traditional K-12 SHS Curriculum: applied subjects
// common to all strands, plus strand-specific specialized subjects.
export const GRADE_12_APPLIED_SUBJECTS = [
  { id: "EAPP", label: "English for Academic and Professional Purposes (EAPP)", aliases: ["EAPP"] },
  { id: "PRACTICAL RESEARCH 1", label: "Practical Research 1", aliases: [] },
  { id: "PRACTICAL RESEARCH 2", label: "Practical Research 2", aliases: [] },
  { id: "3IS", label: "Inquiries, Investigations, and Immersion (3Is)", aliases: ["3Is"] },
  { id: "FILIPINO SA PILING LARANG", label: "Filipino sa Piling Larang", aliases: [] },
  { id: "EMPOWERMENT TECHNOLOGIES", label: "Empowerment Technologies (E-Tech)", aliases: ["E-Tech"] },
  { id: "ENTREPRENEURSHIP", label: "Entrepreneurship", aliases: [] },
];

export const GRADE_12_STRAND_SUBJECTS = [
  {
    id: "stem",
    name: "STEM Strand",
    subjects: [
      "General Biology 2", "General Chemistry 2", "General Physics 2", "Basic Calculus",
      "STEM Capstone / Research Project",
    ],
  },
  {
    id: "abm",
    name: "ABM Strand",
    subjects: [
      "Fundamentals of Accountancy, Business & Management 2", "Business Finance",
      "Applied Economics", "Business Ethics & Social Responsibility",
      "Business Enterprise Simulation",
    ],
  },
  {
    id: "humss",
    name: "HUMSS Strand",
    subjects: [
      "Creative Nonfiction", "Community Engagement, Solidarity & Citizenship",
      "Disciplines & Ideas in Applied Social Sciences",
      "Trends, Networks, & Critical Thinking in the 21st Century",
      "HUMSS Culminating Activity",
    ],
  },
  {
    id: "gas",
    name: "GAS Strand",
    subjects: [
      "Elective 2 (from STEM, ABM, or HUMSS)", "Humanities 2", "Social Science 2",
      "Applied Economics", "Work Immersion / Research Project",
    ],
  },
  {
    id: "tvl",
    name: "TVL Track",
    subjects: [
      "Specialized NC II / NC III Competencies (Advanced Modules)",
      "On-the-Job Training / Work Immersion (80-320 hrs)", "TESDA National Assessment",
    ],
  },
  {
    id: "arts_design",
    name: "Arts & Design Track",
    subjects: [
      "Apprenticeship and Production in Chosen Arts Field",
      "Exhibition / Performing Arts Recital",
      "Leadership & Management in Creative Industries",
    ],
  },
  {
    id: "sports",
    name: "Sports Track",
    subjects: [
      "Sports Officiating Practicum", "Fitness & Coaching Internship",
      "Sports Program Management Practicum",
    ],
  },
];

export const DEPED_SUBJECT_DIRECTORY = {
  ks1: { subjects: KS1_SUBJECTS },
  ks2: { subjects: KS2_SUBJECTS },
  ks3: { subjects: KS3_SUBJECTS },
  ks4: {
    grade11: { core: GRADE_11_CORE_SUBJECTS, clusters: GRADE_11_ELECTIVE_CLUSTERS },
    grade12: { applied: GRADE_12_APPLIED_SUBJECTS, strands: GRADE_12_STRAND_SUBJECTS },
  },
};
