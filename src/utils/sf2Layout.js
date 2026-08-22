// src/utils/sf2Layout.js
// The canonical geometry and official wording of a DepEd LIS "School Form 2
// (SF2) Daily Attendance Report of Learners" export
// (school_form_2_ver2014.2.1.1), read from a real filled-in LIS export.
// Single source of truth for both the on-screen Monthly SF2 preview and the
// printed sheet, so the two can never drift apart (see SF2MonthlyView.jsx).
//
// Unlike SF1's export, this workbook has no per-column width overrides --
// every one of its 47 columns shares one base width, and visual width comes
// entirely from how many base columns a header/cell merges together. That
// merge structure is what SF2_GRID_UNITS below encodes.
//
// The real sheet has NO "MALE"/"FEMALE" caption row and NO Region/Division
// header fields (unlike SF1) -- only School ID, School Year, Report Month,
// School Name, Grade Level and Section. Preserve that; don't invent fields
// the official form doesn't have.

/** Total base column units across the sheet (columns A:AU). */
export const SF2_TOTAL_GRID_UNITS = 47;

/**
 * The sheet's fixed physical width for the Fit to Screen preview (see
 * sf1FitScale.computeFitScale, reused here since the math is identical):
 * legal landscape (14in) minus the source workbook's own 0.28in margins on
 * each side.
 */
export const SF2_SHEET_NATURAL_WIDTH_PX = 13.44 * 96;

/** No. + Name, at the left of the register (2 + 3 base units). */
export const SF2_LEFT_UNITS = { no: 2, name: 3 };

/**
 * The 25-slot (5 weeks x Mon-Fri) date area in the paper form spans base
 * columns 5-37 (33 units). LIKHA-SIS instead sizes this area for the ACTUAL
 * weekdays of the selected month (see attendanceDates.getWeekdays) rather
 * than a fixed 25-column paper template with unused trailing columns --
 * digital display doesn't need blank placeholder columns for a shorter
 * month. The date area's TOTAL share of the sheet (33/47) is preserved so
 * the left/date/right proportions still match the official form.
 */
export const SF2_DATE_AREA_UNITS = 33;

/** Absent + Present (Total for the Month) + Remarks, at the right (2+2+5). */
export const SF2_RIGHT_UNITS = { absent: 2, present: 2, remarks: 5 };

/**
 * Column widths as percentages of the sheet, for the print/preview
 * <colgroup>. `weekdayCount` is the number of actual school days in the
 * selected month (each gets an equal share of the date area).
 */
export function computeSf2ColumnPercents(weekdayCount) {
  const unit = 100 / SF2_TOTAL_GRID_UNITS;
  const dateColumnPercent = weekdayCount > 0 ? (SF2_DATE_AREA_UNITS * unit) / weekdayCount : 0;
  return {
    no: SF2_LEFT_UNITS.no * unit,
    name: SF2_LEFT_UNITS.name * unit,
    datePerColumn: dateColumnPercent,
    absent: SF2_RIGHT_UNITS.absent * unit,
    present: SF2_RIGHT_UNITS.present * unit,
    remarks: SF2_RIGHT_UNITS.remarks * unit,
  };
}

/** Dropout reason codes (a1-f) per the DepEd NLS legend, for the Remarks
 * popup's "Dropped Out" reason picker. Grouped wording matches
 * NLS_REASON_GROUPS below field-for-field. */
export const DROPOUT_REASONS = [
  { code: "a1", label: "Had to take care of siblings" },
  { code: "a2", label: "Early marriage/pregnancy" },
  { code: "a3", label: "Parents' attitude toward schooling" },
  { code: "a4", label: "Family problems" },
  { code: "b1", label: "Illness" },
  { code: "b2", label: "Overage" },
  { code: "b3", label: "Death" },
  { code: "b4", label: "Drug Abuse" },
  { code: "b5", label: "Poor academic performance" },
  { code: "b6", label: "Lack of interest/Distractions" },
  { code: "b7", label: "Hunger/Malnutrition" },
  { code: "c1", label: "Teacher Factor" },
  { code: "c2", label: "Physical condition of classroom" },
  { code: "c3", label: "Peer influence" },
  { code: "d1", label: "Distance between home and school" },
  { code: "d2", label: "Armed conflict (incl. Tribal wars & clanfeuds)" },
  { code: "d3", label: "Calamities/Disasters" },
  { code: "e1", label: "Child labor, work" },
  { code: "f", label: "Others (Specify)" },
];

/** The value/label used when a learner "Dropped Out" for a given reason code.
 * This exact string format is what's stored in Firestore today -- preserve
 * it so historical records keep matching. */
export function dropoutLabel(code) {
  const r = DROPOUT_REASONS.find((x) => x.code === code);
  return `Dropped Out - ${code}: ${r ? r.label : ""}`;
}

/** "2. REASONS/CAUSES FOR NLS" legend, grouped exactly as the official sheet
 * prints them (section 2 of the footer's middle column). */
export const NLS_REASON_GROUPS = [
  {
    letter: "a",
    title: "Domestic-Related Factors",
    items: ["a1", "a2", "a3", "a4"],
  },
  {
    letter: "b",
    title: "Individual-Related Factors",
    items: ["b1", "b2", "b3", "b4", "b5", "b6", "b7"],
  },
  { letter: "c", title: "School-Related Factors", items: ["c1", "c2", "c3"] },
  { letter: "d", title: "Geographic/Environmental", items: ["d1", "d2", "d3"] },
  { letter: "e", title: "Financial-Related", items: ["e1"] },
  { letter: "f", title: "Others (Specify)", items: [] },
];

/** "1. CODES FOR CHECKING ATTENDANCE" -- official wording, verbatim,
 * including the source workbook's own "Commer" spelling and its inconsistent
 * spacing around "-" and "=" (re-verified via xlrd against the real
 * workbook; a prior pass claimed this matched but the string still read
 * "Comer" with one m and evenly-spaced punctuation). */
export const ATTENDANCE_CODES_TEXT =
  "(blank) - Present; (x)- Absent; Tardy (half shaded= Upper for Late Commer, Lower for Cutting Classes)";

/** The three official summary formulas, exactly as labelled on the sheet. */
export const SF2_FORMULAS = [
  {
    label: "a. Percentage of Enrolment",
    numerator: "Registered Learners as of end of the month",
    denominator: "Enrolment as of 1st Friday of the school year",
    suffix: "x 100",
  },
  {
    label: "b. Average Daily Attendance",
    numerator: "Total Daily Attendance",
    denominator: "Number of School Days in reporting month",
    suffix: "",
  },
  {
    label: "c. Percentage of Attendance for the month",
    numerator: "Average daily attendance",
    denominator: "Registered Learners as of end of the month",
    suffix: "x 100",
  },
];

/** Guideline notes 1-6, official wording, printed under GUIDELINES. */
export const SF2_GUIDELINES_TEXT = [
  "1. The attendance shall be accomplished daily. Refer to the codes for checking learners' attendance.",
  "2. Dates shall be written in the columns after Learner's Name.",
  "3. To compute the following:",
  "4. Every end of the month, the class adviser will submit this form to the office of the principal for recording of summary table into School Form 4. Once signed by the principal, this form should be returned to the adviser.",
  "5. The adviser will provide necessary interventions including but not limited to home visitation to learner/s who were absent for 5 consecutive days and/or those at risk of dropping out.",
  "6. Attendance performance of learners will be reflected in Form 137 and Form 138 every grading period.",
  "*Beginning of School Year cut-off report is every 1st Friday of the School Year",
];
