# SF8 Height-for-Age + Baseline/Endline Nutrition Consolidator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Height-for-Age (stunting) classification, a Baseline/Endline
measurement-period dimension to nutrition records, and a school-wide printable
Nutritional Status Consolidator report, closing the gap between the existing
per-section SF8 (`NutritionStatus.jsx`) and the DepEd
`TingubNHS-BASELINE-NS-CONSO-2026-2027.xlsx` template already in `public/`.

**Architecture:** Two new pure-logic modules (`hfaForAgeTable.js` +
`classifyHeightForAge()`, and `nutritionConsolidation.js`), a `period` field
added to the existing `nutritionRecords` collection (doc id becomes
`learnerId_schoolYear_period`), and one new read-only report component
(`NutritionConsolidator.jsx`) that fetches `learners` + `nutritionRecords`
once and aggregates school-wide. `NutritionStatus.jsx` (SF8) gains a period
selector and an HFA column but keeps its existing load/save shape otherwise.

**Tech Stack:** React + Vite, Firebase/Firestore, Tailwind CSS, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-16-sf8-nutrition-consolidator-design.md`

## Global Constraints

- Print components must keep a pure white `@media print` background with no
  dark/brand theme leakage (CLAUDE.md Section 2) — `NutritionConsolidator.jsx`
  and the modified SF8 print block in `NutritionStatus.jsx` must pass a
  `print-safety-audit` before being considered done.
- Any new/changed Firestore access rule must be deployed directly via Bash,
  not left for the user to run (`firebase deploy --only firestore:rules`).
- `npm run lint && npm run test` must pass after every task.
- Calendar terminology is `Term 1`/`Term 2`/`Term 3` only — not used in this
  feature (nutrition periods are `Baseline`/`Endline`, unrelated to academic
  terms), noted here only to avoid accidentally introducing quarter language.

---

## Task 1: Height-for-Age reference table

**Files:**
- Create: `src/utils/hfaForAgeTable.js`

**Interfaces:**
- Produces: `HFA_FOR_AGE_TABLE` (array), `HFA_TABLE_MIN_MONTHS` (60),
  `HFA_TABLE_MAX_MONTHS` (228) — consumed by Task 2's
  `classifyHeightForAge()`.

This is a pure data file, extracted from the hidden "Sir Wedz Helper Tables"
sheet in `public/School Form 8 SF8 Learner Basic Health and Nutrition Report.xlsx`
(columns `BV:CJ`, rows 5–173; boys cutoffs at `BX`/`BZ`/`CB`, girls at
`CE`/`CG`/`CI` — see the design spec's "Source data findings" section for how
these columns were identified from the sheet's own `VLOOKUP` formulas). There
is no test-first cycle for a static data table — `bmiForAgeTable.js` has none
either — so this task is "write the file, then use it in Task 2's tests."

- [ ] **Step 1: Create the file**

```js
// src/utils/hfaForAgeTable.js
//
// Official DepEd / WHO Height-for-Age reference table (WHO 2007 growth
// reference, 5 to 19 years), sourced from the DepEd SF8 workbook's hidden
// "Sir Wedz Helper Tables" sheet (columns BV:CJ, rows 5-173). Do not
// hand-edit these numbers; if a correction is ever needed, re-export from
// the source SF8 file.
//
// Each row: [ageInMonths, boysSeverelyStuntedMax, boysStuntedMax,
//   boysNormalMax, girlsSeverelyStuntedMax, girlsStuntedMax, girlsNormalMax]
// (heights in meters)
//
// Classification logic (matches the SF8 workbook's HFA lookup formulas):
//   height <= severelyStuntedMax   -> Severely Stunted
//   height <= stuntedMax           -> Stunted
//   height <= normalMax            -> Normal
//   height >  normalMax            -> Tall
//
// Table covers ages 60 to 228 months (5 to 19 years), the same range as
// BMI_FOR_AGE_TABLE. Outside that range, classification is not defined by
// this table.
//
// NOTE: the source sheet's boys column has a small non-monotonic dip at
// ages 161-164 months (1.363 -> 1.369 -> 1.364 -> 1.379) — preserved as-is
// from the source workbook rather than silently corrected. Flagged here for
// a follow-up check against an authoritative WHO HFA table if it ever
// affects a real classification at exactly that age.

export const HFA_FOR_AGE_TABLE = [
  [60, 0.96, 1.006, 1.192, 0.951, 0.998, 1.189],
  [61, 0.964, 1.01, 1.194, 0.952, 1, 1.191],
  [62, 0.968, 1.015, 1.2, 0.956, 1.004, 1.197],
  [63, 0.973, 1.019, 1.206, 0.96, 1.009, 1.203],
  [64, 0.977, 1.024, 1.212, 0.964, 1.013, 1.209],
  [65, 0.981, 1.029, 1.218, 0.969, 1.018, 1.215],
  [66, 0.986, 1.033, 1.224, 0.973, 1.022, 1.22],
  [67, 0.99, 1.038, 1.23, 0.977, 1.026, 1.226],
  [68, 0.994, 1.042, 1.236, 0.981, 1.031, 1.232],
  [69, 0.998, 1.047, 1.241, 0.985, 1.035, 1.237],
  [70, 1.003, 1.051, 1.247, 0.989, 1.039, 1.243],
  [71, 1.007, 1.056, 1.252, 0.993, 1.044, 1.248],
  [72, 1.011, 1.06, 1.258, 0.997, 1.048, 1.254],
  [73, 1.015, 1.064, 1.264, 1.001, 1.052, 1.259],
  [74, 1.019, 1.069, 1.269, 1.004, 1.056, 1.264],
  [75, 1.023, 1.073, 1.275, 1.008, 1.06, 1.27],
  [76, 1.027, 1.077, 1.28, 1.012, 1.065, 1.275],
  [77, 1.031, 1.081, 1.285, 1.016, 1.069, 1.28],
  [78, 1.035, 1.086, 1.291, 1.02, 1.073, 1.286],
  [79, 1.038, 1.09, 1.296, 1.024, 1.077, 1.291],
  [80, 1.042, 1.094, 1.302, 1.028, 1.081, 1.296],
  [81, 1.046, 1.098, 1.307, 1.031, 1.085, 1.302],
  [82, 1.05, 1.102, 1.312, 1.035, 1.089, 1.307],
  [83, 1.054, 1.107, 1.318, 1.039, 1.094, 1.312],
  [84, 1.058, 1.111, 1.323, 1.043, 1.098, 1.317],
  [85, 1.062, 1.115, 1.328, 1.047, 1.102, 1.323],
  [86, 1.065, 1.119, 1.334, 1.051, 1.106, 1.328],
  [87, 1.069, 1.123, 1.339, 1.055, 1.11, 1.333],
  [88, 1.073, 1.127, 1.344, 1.059, 1.115, 1.339],
  [89, 1.077, 1.131, 1.349, 1.063, 1.119, 1.344],
  [90, 1.08, 1.135, 1.355, 1.067, 1.123, 1.349],
  [91, 1.084, 1.139, 1.36, 1.071, 1.127, 1.355],
  [92, 1.088, 1.143, 1.365, 1.075, 1.131, 1.36],
  [93, 1.091, 1.147, 1.37, 1.079, 1.136, 1.365],
  [94, 1.095, 1.151, 1.375, 1.083, 1.14, 1.371],
  [95, 1.099, 1.155, 1.381, 1.087, 1.144, 1.376],
  [96, 1.102, 1.159, 1.386, 1.091, 1.149, 1.382],
  [97, 1.106, 1.163, 1.391, 1.095, 1.153, 1.387],
  [98, 1.109, 1.166, 1.396, 1.099, 1.157, 1.392],
  [99, 1.113, 1.17, 1.401, 1.103, 1.162, 1.398],
  [100, 1.116, 1.174, 1.406, 1.107, 1.166, 1.403],
  [101, 1.12, 1.178, 1.411, 1.111, 1.17, 1.409],
  [102, 1.123, 1.182, 1.416, 1.115, 1.175, 1.414],
  [103, 1.127, 1.186, 1.421, 1.119, 1.179, 1.42],
  [104, 1.13, 1.189, 1.426, 1.124, 1.184, 1.425],
  [105, 1.134, 1.193, 1.431, 1.128, 1.188, 1.431],
  [106, 1.137, 1.197, 1.436, 1.132, 1.193, 1.436],
  [107, 1.141, 1.201, 1.441, 1.136, 1.197, 1.442],
  [108, 1.144, 1.204, 1.446, 1.141, 1.202, 1.447],
  [109, 1.148, 1.208, 1.451, 1.145, 1.206, 1.453],
  [110, 1.151, 1.212, 1.456, 1.149, 1.211, 1.458],
  [111, 1.155, 1.216, 1.461, 1.154, 1.215, 1.464],
  [112, 1.158, 1.219, 1.466, 1.158, 1.22, 1.469],
  [113, 1.162, 1.223, 1.471, 1.162, 1.225, 1.475],
  [114, 1.165, 1.227, 1.476, 1.167, 1.229, 1.481],
  [115, 1.168, 1.231, 1.481, 1.171, 1.234, 1.486],
  [116, 1.172, 1.234, 1.486, 1.176, 1.239, 1.492],
  [117, 1.175, 1.238, 1.491, 1.18, 1.243, 1.497],
  [118, 1.179, 1.242, 1.495, 1.184, 1.248, 1.503],
  [119, 1.182, 1.246, 1.5, 1.189, 1.253, 1.509],
  [120, 1.186, 1.249, 1.505, 1.193, 1.257, 1.514],
  [121, 1.189, 1.253, 1.51, 1.198, 1.262, 1.52],
  [122, 1.192, 1.257, 1.515, 1.203, 1.267, 1.526],
  [123, 1.196, 1.261, 1.52, 1.207, 1.272, 1.531],
  [124, 1.199, 1.264, 1.525, 1.212, 1.277, 1.537],
  [125, 1.203, 1.268, 1.53, 1.216, 1.281, 1.543],
  [126, 1.206, 1.272, 1.535, 1.221, 1.286, 1.548],
  [127, 1.21, 1.276, 1.54, 1.226, 1.291, 1.554],
  [128, 1.213, 1.28, 1.545, 1.231, 1.296, 1.56],
  [129, 1.217, 1.284, 1.55, 1.235, 1.301, 1.566],
  [130, 1.221, 1.287, 1.555, 1.24, 1.306, 1.571],
  [131, 1.224, 1.291, 1.561, 1.245, 1.311, 1.577],
  [132, 1.228, 1.296, 1.566, 1.25, 1.316, 1.583],
  [133, 1.232, 1.3, 1.571, 1.254, 1.321, 1.589],
  [134, 1.236, 1.304, 1.576, 1.259, 1.326, 1.594],
  [135, 1.24, 1.308, 1.582, 1.264, 1.331, 1.6],
  [136, 1.244, 1.312, 1.587, 1.269, 1.336, 1.606],
  [137, 1.248, 1.316, 1.593, 1.273, 1.341, 1.611],
  [138, 1.252, 1.321, 1.598, 1.278, 1.346, 1.617],
  [139, 1.256, 1.325, 1.604, 1.283, 1.351, 1.622],
  [140, 1.26, 1.33, 1.609, 1.288, 1.356, 1.628],
  [141, 1.264, 1.334, 1.615, 1.292, 1.36, 1.633],
  [142, 1.268, 1.339, 1.621, 1.297, 1.365, 1.639],
  [143, 1.273, 1.343, 1.627, 1.302, 1.37, 1.644],
  [144, 1.277, 1.348, 1.633, 1.306, 1.375, 1.649],
  [145, 1.282, 1.353, 1.639, 1.311, 1.379, 1.654],
  [146, 1.286, 1.358, 1.645, 1.315, 1.384, 1.659],
  [147, 1.291, 1.363, 1.651, 1.319, 1.388, 1.664],
  [148, 1.296, 1.368, 1.657, 1.324, 1.392, 1.669],
  [149, 1.301, 1.373, 1.663, 1.328, 1.397, 1.674],
  [150, 1.306, 1.378, 1.67, 1.332, 1.401, 1.678],
  [151, 1.311, 1.384, 1.676, 1.336, 1.405, 1.683],
  [152, 1.316, 1.389, 1.683, 1.34, 1.409, 1.687],
  [153, 1.321, 1.394, 1.689, 1.344, 1.413, 1.691],
  [154, 1.326, 1.4, 1.696, 1.347, 1.417, 1.695],
  [155, 1.331, 1.405, 1.702, 1.351, 1.42, 1.699],
  [156, 1.337, 1.411, 1.709, 1.355, 1.424, 1.703],
  [157, 1.342, 1.416, 1.716, 1.358, 1.427, 1.706],
  [158, 1.347, 1.422, 1.722, 1.361, 1.431, 1.71],
  [159, 1.353, 1.428, 1.729, 1.364, 1.434, 1.713],
  [160, 1.358, 1.433, 1.735, 1.368, 1.437, 1.716],
  [161, 1.363, 1.439, 1.742, 1.371, 1.44, 1.719],
  [162, 1.369, 1.444, 1.748, 1.373, 1.443, 1.722],
  [163, 1.364, 1.45, 1.755, 1.376, 1.446, 1.725],
  [164, 1.379, 1.456, 1.761, 1.379, 1.448, 1.727],
  [165, 1.385, 1.461, 1.767, 1.381, 1.451, 1.73],
  [166, 1.39, 1.466, 1.774, 1.384, 1.453, 1.732],
  [167, 1.395, 1.472, 1.78, 1.386, 1.456, 1.735],
  [168, 1.4, 1.477, 1.786, 1.389, 1.458, 1.737],
  [169, 1.405, 1.482, 1.791, 1.391, 1.46, 1.739],
  [170, 1.41, 1.487, 1.797, 1.393, 1.462, 1.741],
  [171, 1.415, 1.492, 1.803, 1.395, 1.464, 1.742],
  [172, 1.42, 1.497, 1.808, 1.397, 1.466, 1.744],
  [173, 1.424, 1.502, 1.813, 1.399, 1.468, 1.746],
  [174, 1.429, 1.507, 1.818, 1.4, 1.47, 1.747],
  [175, 1.433, 1.511, 1.823, 1.402, 1.471, 1.749],
  [176, 1.438, 1.516, 1.828, 1.404, 1.473, 1.75],
  [177, 1.442, 1.52, 1.833, 1.405, 1.474, 1.751],
  [178, 1.446, 1.524, 1.837, 1.407, 1.476, 1.752],
  [179, 1.45, 1.528, 1.841, 1.408, 1.477, 1.753],
  [180, 1.454, 1.533, 1.846, 1.409, 1.478, 1.754],
  [181, 1.458, 1.536, 1.85, 1.411, 1.479, 1.755],
  [182, 1.462, 1.54, 1.854, 1.412, 1.48, 1.756],
  [183, 1.466, 1.544, 1.857, 1.413, 1.481, 1.757],
  [184, 1.47, 1.548, 1.861, 1.414, 1.482, 1.757],
  [185, 1.473, 1.551, 1.864, 1.415, 1.483, 1.758],
  [186, 1.476, 1.554, 1.868, 1.416, 1.484, 1.759],
  [187, 1.48, 1.558, 1.871, 1.417, 1.485, 1.759],
  [188, 1.483, 1.561, 1.874, 1.418, 1.486, 1.76],
  [189, 1.486, 1.564, 1.877, 1.418, 1.486, 1.76],
  [190, 1.489, 1.567, 1.879, 1.419, 1.487, 1.76],
  [191, 1.492, 1.57, 1.882, 1.42, 1.488, 1.761],
  [192, 1.495, 1.573, 1.884, 1.421, 1.488, 1.761],
  [193, 1.498, 1.575, 1.887, 1.421, 1.489, 1.761],
  [194, 1.5, 1.578, 1.889, 1.422, 1.49, 1.761],
  [195, 1.503, 1.58, 1.891, 1.422, 1.49, 1.762],
  [196, 1.505, 1.583, 1.893, 1.423, 1.491, 1.762],
  [197, 1.508, 1.585, 1.895, 1.423, 1.491, 1.762],
  [198, 1.51, 1.587, 1.897, 1.424, 1.491, 1.762],
  [199, 1.512, 1.589, 1.898, 1.424, 1.492, 1.762],
  [200, 1.514, 1.591, 1.9, 1.425, 1.492, 1.762],
  [201, 1.516, 1.593, 1.901, 1.425, 1.493, 1.762],
  [202, 1.518, 1.595, 1.902, 1.426, 1.493, 1.762],
  [203, 1.52, 1.596, 1.903, 1.426, 1.493, 1.762],
  [204, 1.521, 1.598, 1.904, 1.427, 1.494, 1.762],
  [205, 1.523, 1.599, 1.905, 1.427, 1.494, 1.762],
  [206, 1.524, 1.601, 1.906, 1.428, 1.494, 1.762],
  [207, 1.526, 1.602, 1.907, 1.428, 1.495, 1.763],
  [208, 1.527, 1.603, 1.908, 1.428, 1.495, 1.763],
  [209, 1.529, 1.604, 1.908, 1.429, 1.495, 1.763],
  [210, 1.53, 1.605, 1.909, 1.429, 1.496, 1.763],
  [211, 1.531, 1.607, 1.909, 1.43, 1.496, 1.763],
  [212, 1.532, 1.608, 1.91, 1.43, 1.496, 1.763],
  [213, 1.533, 1.608, 1.91, 1.43, 1.497, 1.763],
  [214, 1.534, 1.609, 1.91, 1.431, 1.497, 1.763],
  [215, 1.535, 1.61, 1.911, 1.431, 1.497, 1.763],
  [216, 1.536, 1.611, 1.911, 1.431, 1.497, 1.763],
  [217, 1.537, 1.612, 1.911, 1.432, 1.498, 1.763],
  [218, 1.538, 1.613, 1.911, 1.432, 1.498, 1.763],
  [219, 1.539, 1.613, 1.911, 1.432, 1.498, 1.763],
  [220, 1.54, 1.614, 1.911, 1.433, 1.498, 1.763],
  [221, 1.541, 1.615, 1.911, 1.433, 1.499, 1.763],
  [222, 1.541, 1.615, 1.911, 1.433, 1.499, 1.763],
  [223, 1.542, 1.616, 1.912, 1.433, 1.499, 1.763],
  [224, 1.543, 1.616, 1.912, 1.434, 1.499, 1.763],
  [225, 1.544, 1.617, 1.912, 1.434, 1.499, 1.763],
  [226, 1.544, 1.617, 1.911, 1.434, 1.499, 1.763],
  [227, 1.545, 1.618, 1.911, 1.434, 1.5, 1.762],
  [228, 1.545, 1.618, 1.911, 1.434, 1.5, 1.762],
];

export const HFA_TABLE_MIN_MONTHS = 60;
export const HFA_TABLE_MAX_MONTHS = 228;
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/hfaForAgeTable.js
git commit -m "feat(sf8): add WHO height-for-age reference table"
```

---

## Task 2: `classifyHeightForAge()` and shared `normalizeSex()`

**Files:**
- Modify: `src/utils/nutritionComputations.js`
- Test: `src/__tests__/nutritionComputations.test.js` (new file — this
  module currently has zero test coverage)

**Interfaces:**
- Consumes: `HFA_FOR_AGE_TABLE`, `HFA_TABLE_MIN_MONTHS`,
  `HFA_TABLE_MAX_MONTHS` from `src/utils/hfaForAgeTable.js` (Task 1).
- Produces: `classifyHeightForAge(heightM, ageInMonths, sex) ->
  "Severely Stunted" | "Stunted" | "Normal" | "Tall" | null`, and
  `normalizeSex(sex) -> "M" | "F" | ""` — both exported from
  `nutritionComputations.js`. Task 4 (`NutritionStatus.jsx`) and Task 3
  (`nutritionConsolidation.js`) both import `normalizeSex` from here instead
  of each defining their own copy.

This task only test-drives the two *new* pieces (`classifyHeightForAge`,
`normalizeSex`) — `getAgeInMonths`/`computeBMI`/`classifyNutritionalStatus`
already exist and work; this plan doesn't retroactively test unrelated
pre-existing code.

- [ ] **Step 1: Write the failing tests**

```js
// src/__tests__/nutritionComputations.test.js
import { describe, it, expect } from "vitest";
import { classifyHeightForAge, normalizeSex } from "../utils/nutritionComputations.js";

describe("normalizeSex", () => {
  it("normalizes M/Male and F/Female variants", () => {
    expect(normalizeSex("M")).toBe("M");
    expect(normalizeSex("Male")).toBe("M");
    expect(normalizeSex("male")).toBe("M");
    expect(normalizeSex("F")).toBe("F");
    expect(normalizeSex("Female")).toBe("F");
    expect(normalizeSex("female")).toBe("F");
  });

  it("returns empty string for missing or unrecognized values", () => {
    expect(normalizeSex("")).toBe("");
    expect(normalizeSex(null)).toBe("");
    expect(normalizeSex(undefined)).toBe("");
    expect(normalizeSex("Other")).toBe("");
  });
});

describe("classifyHeightForAge", () => {
  it("classifies boys at age 60 months using the exact table cutoffs", () => {
    // row: [60, 0.96, 1.006, 1.192, ...]
    expect(classifyHeightForAge(0.95, 60, "M")).toBe("Severely Stunted");
    expect(classifyHeightForAge(0.96, 60, "M")).toBe("Severely Stunted");
    expect(classifyHeightForAge(1.0, 60, "M")).toBe("Stunted");
    expect(classifyHeightForAge(1.006, 60, "M")).toBe("Stunted");
    expect(classifyHeightForAge(1.1, 60, "M")).toBe("Normal");
    expect(classifyHeightForAge(1.192, 60, "M")).toBe("Normal");
    expect(classifyHeightForAge(1.3, 60, "M")).toBe("Tall");
  });

  it("classifies girls at age 60 months using the exact table cutoffs", () => {
    // row: [60, ..., 0.951, 0.998, 1.189]
    expect(classifyHeightForAge(0.94, 60, "F")).toBe("Severely Stunted");
    expect(classifyHeightForAge(0.98, 60, "F")).toBe("Stunted");
    expect(classifyHeightForAge(1.1, 60, "F")).toBe("Normal");
    expect(classifyHeightForAge(1.2, 60, "F")).toBe("Tall");
  });

  it("accepts Male/Female sex spelling the same as M/F", () => {
    expect(classifyHeightForAge(0.95, 60, "Male")).toBe("Severely Stunted");
    expect(classifyHeightForAge(0.94, 60, "Female")).toBe("Severely Stunted");
  });

  it("returns null for missing height, age, or sex", () => {
    expect(classifyHeightForAge(null, 60, "M")).toBeNull();
    expect(classifyHeightForAge(1.0, null, "M")).toBeNull();
    expect(classifyHeightForAge(1.0, 60, "")).toBeNull();
    expect(classifyHeightForAge(1.0, 60, "Other")).toBeNull();
    expect(classifyHeightForAge(0, 60, "M")).toBeNull();
    expect(classifyHeightForAge(-1, 60, "M")).toBeNull();
  });

  it("returns null for ages outside the table's 60-228 month range, matching classifyNutritionalStatus", () => {
    expect(classifyHeightForAge(0.5, 59, "M")).toBeNull();
    expect(classifyHeightForAge(1.9, 229, "M")).toBeNull();
    expect(classifyHeightForAge(1.9, 300, "M")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- nutritionComputations`
Expected: FAIL — `classifyHeightForAge`/`normalizeSex` are not exported yet.

- [ ] **Step 3: Implement `normalizeSex` and `classifyHeightForAge`**

Add the import at the top of `src/utils/nutritionComputations.js` (after the
existing `bmiForAgeTable.js` import):

```js
import {
  HFA_FOR_AGE_TABLE,
  HFA_TABLE_MIN_MONTHS,
  HFA_TABLE_MAX_MONTHS,
} from "./hfaForAgeTable.js";
```

Append to the end of `src/utils/nutritionComputations.js`:

```js
/**
 * Normalizes a learner's sex value ("M"/"F"/"Male"/"Female", any case) to
 * "M" | "F" | "" so grouping/classification code doesn't each reimplement
 * this. Unrecognized values (including "Other" or missing) return "".
 *
 * @param {string} sex
 * @returns {"M"|"F"|""}
 */
export function normalizeSex(sex) {
  if (typeof sex !== "string") return "";
  const s = sex.trim().toUpperCase();
  if (s === "M" || s === "MALE") return "M";
  if (s === "F" || s === "FEMALE") return "F";
  return "";
}

/**
 * Classifies Height-for-Age (stunting) status using the WHO 2007 growth
 * reference, mirroring classifyNutritionalStatus()'s structure exactly.
 *
 * @param {number|string} heightM - height in meters
 * @param {number} ageInMonths - learner age in months
 * @param {string} sex - "M" or "F" (also accepts "Male"/"Female")
 * @returns {string|null} "Severely Stunted" | "Stunted" | "Normal" | "Tall" | null
 */
export function classifyHeightForAge(heightM, ageInMonths, sex) {
  if (heightM === null || heightM === undefined || ageInMonths === null || ageInMonths === undefined) {
    return null;
  }
  const h = Number(heightM);
  const age = Number(ageInMonths);

  if (isNaN(h) || h <= 0 || isNaN(age)) {
    return null;
  }

  if (age < HFA_TABLE_MIN_MONTHS || age > HFA_TABLE_MAX_MONTHS) {
    return null;
  }

  const s = normalizeSex(sex);
  if (!s) return null;

  let targetRow = HFA_FOR_AGE_TABLE.find((row) => row[0] === age);
  if (!targetRow) {
    let minDiff = Infinity;
    for (const row of HFA_FOR_AGE_TABLE) {
      const diff = Math.abs(row[0] - age);
      if (diff < minDiff) {
        minDiff = diff;
        targetRow = row;
      }
    }
  }

  if (!targetRow) return null;

  let severelyStuntedMax;
  let stuntedMax;
  let normalMax;

  if (s === "M") {
    [, severelyStuntedMax, stuntedMax, normalMax] = targetRow;
  } else {
    severelyStuntedMax = targetRow[4];
    stuntedMax = targetRow[5];
    normalMax = targetRow[6];
  }

  if (h <= severelyStuntedMax) return "Severely Stunted";
  if (h <= stuntedMax) return "Stunted";
  if (h <= normalMax) return "Normal";
  return "Tall";
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- nutritionComputations`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/nutritionComputations.js src/__tests__/nutritionComputations.test.js
git commit -m "feat(sf8): add classifyHeightForAge and shared normalizeSex"
```

---

## Task 3: `nutritionConsolidation.js` pure aggregator

**Files:**
- Create: `src/utils/nutritionConsolidation.js`
- Test: `src/__tests__/nutritionConsolidation.test.js`

**Interfaces:**
- Consumes: nothing from earlier tasks directly (pure function over plain
  arrays/objects — it does not import `classifyNutritionalStatus` or
  `classifyHeightForAge`; it trusts the `nutritionalStatus` /
  `heightForAgeStatus` fields already present on saved `nutritionRecords`
  documents, the same way `ConsolidatedGrades.jsx` trusts precomputed
  fields rather than recomputing).
- Produces: `consolidateBySection(learners, nutritionRecords, { schoolYear,
  period, gradeLevelsOffered }) -> { sections: SectionRow[], grandTotal:
  SectionRow }` where `SectionRow` is:

```js
{
  gradeLevel: string,   // "" for grandTotal
  section: string,      // "GRAND TOTAL" for grandTotal
  enrolment: { M: number, F: number, T: number },
  weighed:   { M: number, F: number, T: number },
  bmi: {
    severelyWasted: { M, F, T }, wasted: { M, F, T }, normal: { M, F, T },
    overweight: { M, F, T }, obese: { M, F, T },
  },
  hfa: {
    severelyStunted: { M, F, T }, stunted: { M, F, T }, normal: { M, F, T },
    tall: { M, F, T },
  },
}
```

Task 6 (`NutritionConsolidator.jsx`) renders this shape directly.

- [ ] **Step 1: Write the failing tests**

```js
// src/__tests__/nutritionConsolidation.test.js
import { describe, it, expect } from "vitest";
import { consolidateBySection } from "../utils/nutritionConsolidation.js";

const GRADE_LEVELS = ["Grade 7", "Grade 8"];

function learner(id, gradeLevel, section, sex) {
  return { id, gradeLevel, section, sex, schoolYear: "2026-2027" };
}

function record(learnerId, gradeLevel, section, sex, opts = {}) {
  return {
    learnerId,
    gradeLevel,
    section,
    sex,
    schoolYear: "2026-2027",
    period: "Baseline",
    nutritionalStatus: "Normal",
    heightForAgeStatus: "Normal",
    ...opts,
  };
}

describe("consolidateBySection", () => {
  it("counts enrolment for every learner in a section regardless of weigh-in status", () => {
    const learners = [
      learner("l1", "Grade 7", "Love", "M"),
      learner("l2", "Grade 7", "Love", "F"),
      learner("l3", "Grade 7", "Love", "F"),
    ];
    const result = consolidateBySection(learners, [], {
      schoolYear: "2026-2027",
      period: "Baseline",
      gradeLevelsOffered: GRADE_LEVELS,
    });
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0].enrolment).toEqual({ M: 1, F: 2, T: 3 });
    expect(result.sections[0].weighed).toEqual({ M: 0, F: 0, T: 0 });
  });

  it("counts weighed and tallies BMI/HFA categories by sex from matching records", () => {
    const learners = [
      learner("l1", "Grade 7", "Love", "M"),
      learner("l2", "Grade 7", "Love", "F"),
    ];
    const records = [
      record("l1", "Grade 7", "Love", "M", { nutritionalStatus: "Wasted", heightForAgeStatus: "Stunted" }),
      record("l2", "Grade 7", "Love", "F", { nutritionalStatus: "Normal", heightForAgeStatus: "Tall" }),
    ];
    const result = consolidateBySection(learners, records, {
      schoolYear: "2026-2027",
      period: "Baseline",
      gradeLevelsOffered: GRADE_LEVELS,
    });
    const row = result.sections[0];
    expect(row.weighed).toEqual({ M: 1, F: 1, T: 2 });
    expect(row.bmi.wasted).toEqual({ M: 1, F: 0, T: 1 });
    expect(row.bmi.normal).toEqual({ M: 0, F: 1, T: 1 });
    expect(row.hfa.stunted).toEqual({ M: 1, F: 0, T: 1 });
    expect(row.hfa.tall).toEqual({ M: 0, F: 1, T: 1 });
  });

  it("groups multiple sections across multiple grades, ordered by gradeLevelsOffered then section name", () => {
    const learners = [
      learner("l1", "Grade 8", "Peace", "M"),
      learner("l2", "Grade 7", "Love", "F"),
      learner("l3", "Grade 7", "Faith", "M"),
    ];
    const result = consolidateBySection(learners, [], {
      schoolYear: "2026-2027",
      period: "Baseline",
      gradeLevelsOffered: GRADE_LEVELS,
    });
    expect(result.sections.map((s) => `${s.gradeLevel}/${s.section}`)).toEqual([
      "Grade 7/Faith",
      "Grade 7/Love",
      "Grade 8/Peace",
    ]);
  });

  it("isolates Baseline records from Endline records", () => {
    const learners = [learner("l1", "Grade 7", "Love", "M")];
    const records = [
      record("l1", "Grade 7", "Love", "M", { period: "Endline", nutritionalStatus: "Obese" }),
    ];
    const result = consolidateBySection(learners, records, {
      schoolYear: "2026-2027",
      period: "Baseline",
      gradeLevelsOffered: GRADE_LEVELS,
    });
    expect(result.sections[0].weighed).toEqual({ M: 0, F: 0, T: 0 });
    expect(result.sections[0].bmi.obese).toEqual({ M: 0, F: 0, T: 0 });
  });

  it("ignores records for a different schoolYear", () => {
    const learners = [learner("l1", "Grade 7", "Love", "M")];
    const records = [
      record("l1", "Grade 7", "Love", "M", { schoolYear: "2025-2026" }),
    ];
    const result = consolidateBySection(learners, records, {
      schoolYear: "2026-2027",
      period: "Baseline",
      gradeLevelsOffered: GRADE_LEVELS,
    });
    expect(result.sections[0].weighed.T).toBe(0);
  });

  it("computes a grandTotal row summing every section", () => {
    const learners = [
      learner("l1", "Grade 7", "Love", "M"),
      learner("l2", "Grade 8", "Peace", "F"),
    ];
    const records = [
      record("l1", "Grade 7", "Love", "M", { nutritionalStatus: "Severely Wasted", heightForAgeStatus: "Severely Stunted" }),
      record("l2", "Grade 8", "Peace", "F", { nutritionalStatus: "Overweight", heightForAgeStatus: "Normal" }),
    ];
    const result = consolidateBySection(learners, records, {
      schoolYear: "2026-2027",
      period: "Baseline",
      gradeLevelsOffered: GRADE_LEVELS,
    });
    expect(result.grandTotal.enrolment).toEqual({ M: 1, F: 1, T: 2 });
    expect(result.grandTotal.weighed).toEqual({ M: 1, F: 1, T: 2 });
    expect(result.grandTotal.bmi.severelyWasted).toEqual({ M: 1, F: 0, T: 1 });
    expect(result.grandTotal.bmi.overweight).toEqual({ M: 0, F: 1, T: 1 });
    expect(result.grandTotal.hfa.severelyStunted).toEqual({ M: 1, F: 0, T: 1 });
    expect(result.grandTotal.hfa.normal).toEqual({ M: 0, F: 1, T: 1 });
  });

  it("returns empty sections and a zeroed grandTotal for no learners", () => {
    const result = consolidateBySection([], [], {
      schoolYear: "2026-2027",
      period: "Baseline",
      gradeLevelsOffered: GRADE_LEVELS,
    });
    expect(result.sections).toEqual([]);
    expect(result.grandTotal.enrolment).toEqual({ M: 0, F: 0, T: 0 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- nutritionConsolidation`
Expected: FAIL — module doesn't exist yet.

- [ ] **Step 3: Implement `consolidateBySection`**

```js
// src/utils/nutritionConsolidation.js
// Pure school-wide rollup of learners + nutritionRecords into the DepEd
// Nutritional Status Report grid (Enrolment / Pupils Weighed / BMI / HFA
// category counts, per section, split Male/Female/Total).

import { normalizeSex } from "./nutritionComputations.js";

const BMI_CATEGORIES = {
  "Severely Wasted": "severelyWasted",
  "Wasted": "wasted",
  "Normal": "normal",
  "Overweight": "overweight",
  "Obese": "obese",
};

const HFA_CATEGORIES = {
  "Severely Stunted": "severelyStunted",
  "Stunted": "stunted",
  "Normal": "normal",
  "Tall": "tall",
};

function zeroCount() {
  return { M: 0, F: 0, T: 0 };
}

function zeroCategoryBlock(categoryMap) {
  const block = {};
  for (const key of Object.values(categoryMap)) {
    block[key] = zeroCount();
  }
  return block;
}

function emptyRow(gradeLevel, section) {
  return {
    gradeLevel,
    section,
    enrolment: zeroCount(),
    weighed: zeroCount(),
    bmi: zeroCategoryBlock(BMI_CATEGORIES),
    hfa: zeroCategoryBlock(HFA_CATEGORIES),
  };
}

function increment(countObj, sexKey) {
  if (sexKey === "M" || sexKey === "F") {
    countObj[sexKey] += 1;
  }
  countObj.T += 1;
}

/**
 * Aggregates learners + nutritionRecords into per-section DepEd Nutritional
 * Status Report rows for one schoolYear + period.
 *
 * @param {Array<object>} learners - full learners collection
 * @param {Array<object>} nutritionRecords - full nutritionRecords collection
 * @param {{schoolYear: string, period: "Baseline"|"Endline", gradeLevelsOffered: string[]}} options
 * @returns {{sections: object[], grandTotal: object}}
 */
export function consolidateBySection(learners, nutritionRecords, { schoolYear, period, gradeLevelsOffered = [] }) {
  const rowsByKey = new Map();

  function rowFor(gradeLevel, section) {
    const key = `${gradeLevel}|${section}`;
    if (!rowsByKey.has(key)) {
      rowsByKey.set(key, emptyRow(gradeLevel, section));
    }
    return rowsByKey.get(key);
  }

  for (const learner of learners) {
    if ((learner.schoolYear || "") !== schoolYear) continue;
    const gradeLevel = learner.gradeLevel || "";
    const section = learner.section || "";
    if (!gradeLevel || !section) continue;
    const row = rowFor(gradeLevel, section);
    increment(row.enrolment, normalizeSex(learner.sex));
  }

  for (const record of nutritionRecords) {
    if ((record.schoolYear || "") !== schoolYear) continue;
    if ((record.period || "") !== period) continue;
    const gradeLevel = record.gradeLevel || "";
    const section = record.section || "";
    if (!gradeLevel || !section) continue;
    const row = rowFor(gradeLevel, section);
    const sexKey = normalizeSex(record.sex);

    increment(row.weighed, sexKey);

    const bmiKey = BMI_CATEGORIES[record.nutritionalStatus];
    if (bmiKey) increment(row.bmi[bmiKey], sexKey);

    const hfaKey = HFA_CATEGORIES[record.heightForAgeStatus];
    if (hfaKey) increment(row.hfa[hfaKey], sexKey);
  }

  const sections = Array.from(rowsByKey.values()).sort((a, b) => {
    const gradeDiff = gradeLevelsOffered.indexOf(a.gradeLevel) - gradeLevelsOffered.indexOf(b.gradeLevel);
    if (gradeDiff !== 0) {
      // Unknown grades (not in gradeLevelsOffered, indexOf = -1) sort last.
      if (gradeLevelsOffered.indexOf(a.gradeLevel) === -1) return 1;
      if (gradeLevelsOffered.indexOf(b.gradeLevel) === -1) return -1;
      return gradeDiff;
    }
    return a.section.localeCompare(b.section);
  });

  const grandTotal = emptyRow("", "GRAND TOTAL");
  for (const row of sections) {
    for (const key of ["M", "F", "T"]) {
      grandTotal.enrolment[key] += row.enrolment[key];
      grandTotal.weighed[key] += row.weighed[key];
    }
    for (const cat of Object.values(BMI_CATEGORIES)) {
      for (const key of ["M", "F", "T"]) {
        grandTotal.bmi[cat][key] += row.bmi[cat][key];
      }
    }
    for (const cat of Object.values(HFA_CATEGORIES)) {
      for (const key of ["M", "F", "T"]) {
        grandTotal.hfa[cat][key] += row.hfa[cat][key];
      }
    }
  }

  return { sections, grandTotal };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- nutritionConsolidation`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/nutritionConsolidation.js src/__tests__/nutritionConsolidation.test.js
git commit -m "feat(sf8): add school-wide nutrition consolidation aggregator"
```

---

## Task 4: `nutritionRecords` period dimension in `NutritionStatus.jsx` (data layer)

**Files:**
- Modify: `src/NutritionStatus.jsx`

**Interfaces:**
- Consumes: `classifyHeightForAge`, `normalizeSex` from
  `src/utils/nutritionComputations.js` (Task 2).
- Produces: `nutritionRecords` documents now carry `period` and
  `heightForAgeStatus`, and use doc id `${learnerId}_${schoolYear}_${period}`.
  Task 5 (UI) and Task 3's consumers (Task 6) rely on these two fields
  existing on every record saved from this point on.

No new automated test coverage for this task — `NutritionStatus.jsx` has no
existing test file and this plan follows that established (untested UI
component) pattern, same as the SF10 spec drew for its generator components.
Verify manually per Step 4.

- [ ] **Step 1: Add `period` state and use it in the doc id**

In `src/NutritionStatus.jsx`, add a `period` state next to the existing
`schoolYear` state (around line 66):

```js
  const [schoolYear, setSchoolYear] = useState("2026-2027");
  const [period, setPeriod] = useState("Baseline");
```

- [ ] **Step 2: Update `handleLoad` to key off `period`**

In `handleLoad` (around line 119), change the doc id construction:

```js
          const docId = `${learner.id}_${schoolYear.trim()}_${period}`;
```

- [ ] **Step 3: Update `handleSave` to compute HFA status and use the period-aware doc id**

In `handleSave` (around lines 194-222), add the HFA computation next to the
existing BMI computation, add `period`/`heightForAgeStatus` to the payload,
and update the doc id:

```js
        const ageInMonths = getAgeInMonths(learner.birthDate, measurementDate);
        const bmi = computeBMI(w, h);
        const nutritionalStatus = classifyNutritionalStatus(bmi, ageInMonths, learner.sex);
        const heightForAgeStatus = classifyHeightForAge(h, ageInMonths, learner.sex);

        const docId = `${learner.id}_${schoolYear.trim()}_${period}`;
        const fullName = `${learner.lastName || ""}, ${learner.firstName || ""}${
          learner.middleName ? " " + learner.middleName : ""
        }`.trim();

        const recordPayload = {
          learnerId: learner.id,
          learnerName: fullName,
          learnerLRN: learner.lrn || learner.learnerLRN || "",
          sex: learner.sex || "",
          birthDate: learner.birthDate || "",
          gradeLevel: gradeLevel.trim(),
          section: section.trim(),
          schoolYear: schoolYear.trim(),
          period,
          heightM: h,
          weightKg: w,
          measurementDate: measurementDate.trim(),
          bmi,
          ageInMonths,
          nutritionalStatus,
          heightForAgeStatus,
          measuredByEmail: user?.email || "",
          updatedAt: serverTimestamp(),
        };
```

Replace the file's existing `nutritionComputations` import (currently
`import { getAgeInMonths, computeBMI, classifyNutritionalStatus } from
"./utils/nutritionComputations";`) with the expanded version — same import
statement, two more names, not a second import line:

```js
import {
  getAgeInMonths,
  computeBMI,
  classifyNutritionalStatus,
  classifyHeightForAge,
  normalizeSex,
} from "./utils/nutritionComputations";
```

- [ ] **Step 4: Remove the file's local `normalizeSex` duplicate**

Delete the local `function normalizeSex(sex) { ... }` defined near the top
of `src/NutritionStatus.jsx` (lines 33-41 in the current file) — the import
added in Step 3 replaces it. Every other reference to `normalizeSex(...)`
elsewhere in this file (the `sf8PrintRows` grouping logic) is unchanged,
since the imported function has the identical signature and behavior.

- [ ] **Step 5: Manual verification**

Run: `npm run dev`, sign in as an `adviser` or `smeaCoordinator`, open
Nutrition Status, load a section, enter a height/weight, save. Confirm in
the Firebase console (or via the app reloading the same section) that the
saved `nutritionRecords` doc id ends in `_Baseline` and the doc has both
`nutritionalStatus` and `heightForAgeStatus` fields populated.

- [ ] **Step 6: Commit**

```bash
git add src/NutritionStatus.jsx
git commit -m "feat(sf8): add baseline/endline period to nutritionRecords"
```

---

## Task 5: Period selector and HFA column in `NutritionStatus.jsx` (UI layer)

**Files:**
- Modify: `src/NutritionStatus.jsx`

**Interfaces:**
- Consumes: `period` state and `classifyHeightForAge` from Task 4.
- Produces: no new interfaces — this task is UI-only, building on Task 4's
  data layer.

- [ ] **Step 1: Add the Period selector to the filter bar**

In the filter `<form>` (around line 479), add a Period `<select>` next to
the existing School Year field (after the School Year `<div>` block, before
Measurement Date):

```jsx
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
            Period
          </label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="w-full text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-colors"
          >
            <option value="Baseline">Baseline</option>
            <option value="Endline">Endline</option>
          </select>
        </div>
```

Since the filter form is a 5-column grid (`md:grid-cols-5`) and this adds a
6th field, change the grid class on the `<form>` (line ~481) from
`md:grid-cols-5` to `md:grid-cols-6` so all fields stay one row on desktop
widths.

- [ ] **Step 2: Add an HFA column to the interactive grid**

In the grid `<thead>` (around line 664), add a column header after
"Nutritional Status":

```jsx
                  <th className="py-3 px-4 w-36 text-center">Nutritional Status</th>
                  <th className="py-3 px-4 w-36 text-center">Height-for-Age</th>
```

In the grid body row rendering (around lines 679-747, inside the
`gridData.map` callback), compute and render the HFA status next to the
existing BMI status cell:

```js
                    const ageInMonths = getAgeInMonths(learner.birthDate, measurementDate);
                    const bmi = computeBMI(w, h);
                    const status = classifyNutritionalStatus(bmi, ageInMonths, learner.sex);
                    const hfaStatus = classifyHeightForAge(h, ageInMonths, learner.sex);
```

Add the new `<td>` immediately after the existing Nutritional Status `<td>`
(after the closing `</td>` of the block ending at line 747):

```jsx
                        <td className="py-3 px-4 text-center">
                          {hfaStatus === "Severely Stunted" || hfaStatus === "Stunted" ? (
                            <span className="inline-block bg-red-500/10 text-red-700 dark:bg-red-500/20 dark:text-red-300 border border-red-500/20 font-medium px-2.5 py-0.5 rounded-full text-xs">
                              {hfaStatus}
                            </span>
                          ) : hfaStatus === "Normal" ? (
                            <span className="inline-block bg-leaf/10 text-leaf-dark dark:bg-leaf/20 dark:text-leaf-light border border-leaf/20 font-medium px-2.5 py-0.5 rounded-full text-xs">
                              {hfaStatus}
                            </span>
                          ) : hfaStatus === "Tall" ? (
                            <span className="inline-block bg-accent/10 text-accent-dark dark:bg-accent/20 dark:text-accent-light border border-accent/20 font-medium px-2.5 py-0.5 rounded-full text-xs">
                              {hfaStatus}
                            </span>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500 font-mono">—</span>
                          )}
                        </td>
```

Update the empty-state `colSpan` in the same table (around line 670) from
`10` to `11` to account for the new column.

- [ ] **Step 3: Add an HFA column to the printable SF8 block**

In `renderSf8Row()` (around lines 350-380), compute and render HFA status:

```js
    const bmi = computeBMI(w, h);
    const status = classifyNutritionalStatus(bmi, ageInMonths, learner.sex);
    const hfaStatus = classifyHeightForAge(h, ageInMonths, learner.sex);
```

Change the `<td>` currently rendering the placeholder `—` for "Height for
Age (HFA)" (line 376: `<td>—</td>`, the column between Nutritional Status
and Remarks) to render the real value:

```jsx
        <td>{hfaStatus || "—"}</td>
```

(The `<th>Height for Age (HFA)</th>` header at line 876 already exists and
needs no change — it was already labeled for this column, just fed a
placeholder.)

- [ ] **Step 4: Manual verification**

Run: `npm run dev`. In Nutrition Status, load a section, enter height/weight
for a learner, confirm the new "Height-for-Age" column shows a classified
status in the interactive grid, switch Period between Baseline/Endline and
confirm the grid reloads independently for each (a value saved under
Baseline shouldn't appear when Endline is selected until also saved there).
Print the report (or preview print) and confirm the HFA column in the
printed table shows the same status instead of "—".

- [ ] **Step 5: Run print-safety-audit**

Since `NutritionStatus.jsx` is a printable component and this task touched
its print block, run the `print-safety-audit` skill against it before
committing, confirming the added HFA column doesn't leak dark/brand theme
styling into `@media print`.

- [ ] **Step 6: Commit**

```bash
git add src/NutritionStatus.jsx
git commit -m "feat(sf8): show Height-for-Age status and period selector in SF8"
```

---

## Task 6: `clinicTeacherName` in `schoolConfig.js` and `SchoolSettings.jsx`

**Files:**
- Modify: `src/schoolConfig.js`
- Modify: `src/SchoolSettings.jsx`

**Interfaces:**
- Produces: `schoolConfig.clinicTeacherName` (via `useSchoolConfig()`),
  consumed by Task 8's `NutritionConsolidator.jsx` "Prepared by" line.

No test-first cycle — this mirrors the existing untested `principalName`
field exactly, and `useSchoolConfig`'s `snapshotToConfig` already spreads
`{...data}` over the fallback, so no hook change is needed for a new field
to flow through.

- [ ] **Step 1: Add the default placeholder value**

In `src/schoolConfig.js`, add `clinicTeacherName` next to `principalName`:

```js
  principalName: "[Principal Full Name]",
  principalPosition: "School Principal",
  clinicTeacherName: "[School Clinic Teacher Full Name]",
```

- [ ] **Step 2: Add the field to `SchoolSettings.jsx`'s default state**

In `DEFAULT_SCHOOL_FIELDS` (around line 21):

```js
const DEFAULT_SCHOOL_FIELDS = {
  schoolName: "",
  schoolAddress: "",
  region: "",
  divisionOffice: "",
  district: "",
  municipalityCityProvince: "",
  principalName: "",
  principalPosition: "",
  clinicTeacherName: "",
};
```

- [ ] **Step 3: Add the input field to the form**

After the "Principal Position" field (around line 259 in
`src/SchoolSettings.jsx`):

```jsx
            <label className={labelClass}>
              Principal Position
              <input className={inputClass} value={schoolData.principalPosition || ""} onChange={(e) => updateField("principalPosition", e.target.value)} />
            </label>
            <label className={labelClass}>
              School Clinic Teacher Name
              <input className={inputClass} value={schoolData.clinicTeacherName || ""} onChange={(e) => updateField("clinicTeacherName", e.target.value)} />
            </label>
```

`handleSave` already writes `{...schoolData, ...}` to Firestore with
`merge: true` (no whitelist to update), and `clinicTeacherName` is not a
required field, so no validation changes are needed.

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, sign in as `ictCoordinator` or `principal`, open School
Settings, enter a Clinic Teacher name, save, reload the page and confirm it
persisted.

- [ ] **Step 5: Commit**

```bash
git add src/schoolConfig.js src/SchoolSettings.jsx
git commit -m "feat(sf8): add clinic teacher name to school settings"
```

---

## Task 7: `firestore.rules` read/write split for `nutritionRecords`

**Files:**
- Modify: `firestore.rules`

**Interfaces:**
- No code interfaces — this is a security rule change required for Task 8's
  `NutritionConsolidator.jsx` to be readable by the `principal` role.

- [ ] **Step 1: Split the rule**

In `firestore.rules`, replace the existing `nutritionRecords` block (lines
82-85):

```
    // ---- nutritionRecords ----
    match /nutritionRecords/{recordId} {
      allow read, write: if hasAnyRole(["adviser", "smeaCoordinator"]);
    }
```

with:

```
    // ---- nutritionRecords ----
    // Write stays adviser/smeaCoordinator-only (only NutritionStatus.jsx
    // writes this collection). Read now also includes principal so they
    // can view/print the school-wide Nutrition Consolidator (matches
    // nutritionConsolidator in pageAccess.js).
    match /nutritionRecords/{recordId} {
      allow read: if hasAnyRole(["adviser", "smeaCoordinator", "principal"]);
      allow write: if hasAnyRole(["adviser", "smeaCoordinator"]);
    }
```

- [ ] **Step 2: Deploy the rule**

Run: `firebase deploy --only firestore:rules`
Expected: deploy succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add firestore.rules
git commit -m "fix(security): let principal read nutritionRecords for the consolidator"
```

---

## Task 8: `NutritionConsolidator.jsx` component

**Files:**
- Create: `src/NutritionConsolidator.jsx`

**Interfaces:**
- Consumes: `consolidateBySection` from `src/utils/nutritionConsolidation.js`
  (Task 3); `useSchoolConfig()` (existing hook, now also returning
  `clinicTeacherName` and `principalName` per Task 6); `gradeLevelsOffered`
  from the same config.
- Produces: no new interfaces — this is the terminal UI component; Task 9
  wires it into routing.

No automated test coverage — same untested-UI-component pattern as
`ConsolidatedGrades.jsx`/`SF10Generator.jsx`.

- [ ] **Step 1: Create the component**

```jsx
// src/NutritionConsolidator.jsx
// School-wide DepEd Nutritional Status (Baseline/Endline) Consolidator —
// aggregates every section's nutritionRecords into the printable summary
// grid used in TingubNHS-BASELINE-NS-CONSO-2026-2027.xlsx.

import { Fragment, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import useSchoolConfig from "./hooks/useSchoolConfig";
import { consolidateBySection } from "./utils/nutritionConsolidation.js";
import {
  ArrowLeft,
  ClipboardList,
  RefreshCw,
  AlertCircle,
  Printer,
} from "lucide-react";

const BMI_COLUMNS = [
  { key: "severelyWasted", label: "Severely Wasted" },
  { key: "wasted", label: "Wasted" },
  { key: "normal", label: "Normal" },
  { key: "overweight", label: "Overweight" },
  { key: "obese", label: "Obese" },
];

const HFA_COLUMNS = [
  { key: "severelyStunted", label: "Severely Stunted" },
  { key: "stunted", label: "Stunted" },
  { key: "normal", label: "Normal" },
  { key: "tall", label: "Tall" },
];

export default function NutritionConsolidator({ user, goBack }) {
  const { config } = useSchoolConfig();
  const gradeLevelsOffered = config?.gradeLevelsOffered || [];

  const [schoolYear, setSchoolYear] = useState("2026-2027");
  const [period, setPeriod] = useState("Baseline");

  const [isLoading, setIsLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState({ sections: [], grandTotal: null });

  async function handleGenerate(e) {
    if (e) e.preventDefault();
    setIsLoading(true);
    setErrorMessage("");
    try {
      const [learnersSnap, recordsSnap] = await Promise.all([
        getDocs(collection(db, "learners")),
        getDocs(collection(db, "nutritionRecords")),
      ]);
      const learners = learnersSnap.docs.map((d) => d.data());
      const nutritionRecords = recordsSnap.docs.map((d) => d.data());

      const consolidated = consolidateBySection(learners, nutritionRecords, {
        schoolYear: schoolYear.trim(),
        period,
        gradeLevelsOffered,
      });
      setResult(consolidated);
      setIsLoaded(true);
    } catch (err) {
      console.error("Failed to generate nutrition consolidator:", err);
      setErrorMessage("Failed to load data. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  function renderCountCell(count) {
    return (
      <>
        <td>{count.M}</td>
        <td>{count.F}</td>
        <td>{count.T}</td>
      </>
    );
  }

  function renderRow(row, isGrandTotal) {
    return (
      <tr key={`${row.gradeLevel}|${row.section}`} className={isGrandTotal ? "nc-grand-total" : ""}>
        <td className="nc-cell-left">{isGrandTotal ? "GRAND TOTAL" : `${row.gradeLevel} - ${row.section}`}</td>
        {renderCountCell(row.enrolment)}
        {renderCountCell(row.weighed)}
        {BMI_COLUMNS.map((col) => (
          <Fragment key={col.key}>{renderCountCell(row.bmi[col.key])}</Fragment>
        ))}
        {HFA_COLUMNS.map((col) => (
          <Fragment key={`hfa-${col.key}`}>{renderCountCell(row.hfa[col.key])}</Fragment>
        ))}
      </tr>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-slide-up">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body * { visibility: hidden; }
          .nc-print-area, .nc-print-area * { visibility: visible; }
          .nc-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            color: #000;
            background: #fff;
          }
        }
        @page { size: A4 landscape; margin: 8mm; }
        .nc-table { border-collapse: collapse; width: 100%; }
        .nc-table th, .nc-table td {
          border: 1px solid #000;
          padding: 2px 3px;
          font-size: 6.5pt;
          text-align: center;
          line-height: 1.2;
          color: #000;
          background: #fff;
        }
        .nc-table th { background: #e8e8e8; font-weight: bold; }
        .nc-cell-left { text-align: left !important; }
        .nc-grand-total td { font-weight: bold; background: #f0f0f0; }
      `}</style>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-gray-900 p-5 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 no-print">
        <div className="flex items-center space-x-3">
          {goBack && (
            <button
              onClick={goBack}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors duration-150 active:scale-[0.98] transition-transform"
              title="Go Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <ClipboardList className="w-6 h-6 text-rose-500" />
              Nutrition Status Consolidator
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              School-wide Baseline / Endline BMI + Height-for-Age rollup
            </p>
          </div>
        </div>
        {isLoaded && (
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2 rounded-lg transition-colors duration-150 active:scale-[0.98] transition-transform shadow-sm"
          >
            <Printer className="w-4 h-4" />
            Print Report
          </button>
        )}
      </div>

      <form
        onSubmit={handleGenerate}
        className="no-print bg-white dark:bg-gray-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 grid grid-cols-1 sm:grid-cols-3 gap-4 items-end"
      >
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
            School Year
          </label>
          <input
            type="text"
            value={schoolYear}
            onChange={(e) => setSchoolYear(e.target.value)}
            className="w-full text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
            Period
          </label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="w-full text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-colors"
          >
            <option value="Baseline">Baseline</option>
            <option value="Endline">Endline</option>
          </select>
        </div>
        <div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white font-medium px-4 py-2 rounded-lg disabled:opacity-50 transition-colors duration-150 active:scale-[0.98] transition-transform shadow-sm text-sm"
          >
            {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ClipboardList className="w-4 h-4" />}
            {isLoading ? "Generating..." : "Generate Report"}
          </button>
        </div>
      </form>

      {errorMessage && (
        <div className="no-print animate-fade-in bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {isLoaded && (
        <div className="nc-print-area">
          <div style={{ padding: "0.4in 0.5in", fontFamily: "Arial, Helvetica, sans-serif" }}>
            <div style={{ textAlign: "center", color: "#000" }}>
              <div style={{ fontWeight: "bold", fontSize: "12pt" }}>{config?.schoolName || "—"}</div>
              <div style={{ fontWeight: "bold", fontSize: "13pt", marginTop: "4px" }}>
                NUTRITIONAL STATUS {period.toUpperCase()} REPORT OF STUDENTS
              </div>
              <div style={{ fontSize: "9pt", marginTop: "2px" }}>S.Y. {schoolYear}</div>
            </div>

            <table className="nc-table" style={{ marginTop: "10px" }}>
              <thead>
                <tr>
                  <th rowSpan={2} style={{ width: "12%" }}>Grade &amp; Section</th>
                  <th colSpan={3}>Enrolment</th>
                  <th colSpan={3}>Pupils Weighed</th>
                  {BMI_COLUMNS.map((col) => (
                    <th key={col.key} colSpan={3}>{col.label}</th>
                  ))}
                  {HFA_COLUMNS.map((col) => (
                    <th key={`hfa-${col.key}`} colSpan={3}>{col.label}</th>
                  ))}
                </tr>
                <tr>
                  <th>M</th><th>F</th><th>T</th>
                  <th>M</th><th>F</th><th>T</th>
                  {BMI_COLUMNS.map((col) => (
                    <Fragment key={col.key}>
                      <th>M</th>
                      <th>F</th>
                      <th>T</th>
                    </Fragment>
                  ))}
                  {HFA_COLUMNS.map((col) => (
                    <Fragment key={`hfa-${col.key}`}>
                      <th>M</th>
                      <th>F</th>
                      <th>T</th>
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.sections.length === 0 ? (
                  <tr>
                    <td colSpan={7 + BMI_COLUMNS.length * 3 + HFA_COLUMNS.length * 3} style={{ padding: "12px" }}>
                      No learners found for {schoolYear}.
                    </td>
                  </tr>
                ) : (
                  result.sections.map((row) => renderRow(row, false))
                )}
                {result.grandTotal && renderRow(result.grandTotal, true)}
              </tbody>
            </table>

            <table style={{ width: "100%", marginTop: "40px", fontSize: "9pt", color: "#000" }}>
              <tbody>
                <tr>
                  <td style={{ width: "50%", textAlign: "center" }}>
                    <div style={{ borderTop: "1px solid #000", marginTop: "40px", paddingTop: "4px" }}>
                      {config?.clinicTeacherName || "—"}
                    </div>
                    <div>School Clinic Teacher</div>
                    <div style={{ marginTop: "8px", fontWeight: "bold" }}>Prepared by:</div>
                  </td>
                  <td style={{ width: "50%", textAlign: "center" }}>
                    <div style={{ borderTop: "1px solid #000", marginTop: "40px", paddingTop: "4px" }}>
                      {config?.principalName || "—"}
                    </div>
                    <div>{config?.principalPosition || "School Principal"}</div>
                    <div style={{ marginTop: "8px", fontWeight: "bold" }}>Submitted by:</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Manual verification**

Run: `npm run dev`, sign in as `principal` (or `adviser`/`smeaCoordinator`),
navigate to Nutrition Consolidator once routed in Task 9, generate a report
for a school year with existing Baseline `nutritionRecords`, confirm section
rows and the Grand Total row show correct counts, print-preview and confirm
Enrolment/Pupils Weighed/BMI/HFA columns all render with real numbers (not
placeholders), and both signature names show what's configured in School
Settings.

- [ ] **Step 3: Run print-safety-audit**

Run the `print-safety-audit` skill against `NutritionConsolidator.jsx` before
committing — confirm the `.nc-print-area` block stays pure white under
`@media print` with no dark/brand theme leakage.

- [ ] **Step 4: Commit**

```bash
git add src/NutritionConsolidator.jsx
git commit -m "feat(sf8): add school-wide nutrition consolidator report"
```

---

## Task 9: Wire up routing, navigation, and access control

**Files:**
- Modify: `src/pageAccess.js`
- Modify: `src/App.jsx`
- Modify: `src/components/Sidebar.jsx`
- Test: `src/__tests__/pageAccess.test.js`

**Interfaces:**
- Consumes: `NutritionConsolidator` component from Task 8.
- Produces: `nutritionConsolidator` page key, reachable via the sidebar and
  gated by `canAccessPage`.

- [ ] **Step 1: Write the failing test**

In `src/__tests__/pageAccess.test.js`, add to the existing `"allows
restricted pages for listed roles and blocks unlisted roles"` test (after
the `reportCard` assertions, before the closing of that `it` block):

```js
      // nutritionConsolidator: ["adviser", "smeaCoordinator", "principal"]
      expect(canAccessPage("nutritionConsolidator", ["adviser"])).toBe(true);
      expect(canAccessPage("nutritionConsolidator", ["smeaCoordinator"])).toBe(true);
      expect(canAccessPage("nutritionConsolidator", ["principal"])).toBe(true);
      expect(canAccessPage("nutritionConsolidator", ["subjectTeacher"])).toBe(false);
      expect(canAccessPage("nutritionConsolidator", ["stakeholder"])).toBe(false);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- pageAccess`
Expected: FAIL — `nutritionConsolidator` is `undefined` in `PAGE_ACCESS`, so
`canAccessPage` returns `false` for every role including `adviser`.

- [ ] **Step 3: Add the `PAGE_ACCESS` entry**

In `src/pageAccess.js`, add after the existing `nutritionStatus` line:

```js
  nutritionStatus: ["adviser", "smeaCoordinator"],
  nutritionConsolidator: ["adviser", "smeaCoordinator", "principal"],
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- pageAccess`
Expected: PASS

- [ ] **Step 5: Wire the route in `App.jsx`**

In `src/App.jsx`, add the import near the existing `NutritionStatus` import:

```js
import NutritionConsolidator from "./NutritionConsolidator";
```

Add the case after the existing `"nutritionStatus"` case (around line 181):

```jsx
      case "nutritionConsolidator":
        pageTitle = "Nutrition Status Consolidator";
        pageContent = <NutritionConsolidator user={user} goBack={() => setCurrentPage("dashboard")} />;
        break;
```

- [ ] **Step 6: Add the sidebar entry**

In `src/components/Sidebar.jsx`, add after the existing `'Nutrition Status'`
entry (line 90):

```js
    { label: 'Nutrition Status', page: 'nutritionStatus' },
    { label: 'Nutrition Consolidator', page: 'nutritionConsolidator' },
```

- [ ] **Step 7: Run the full test suite and lint**

Run: `npm run lint && npm run test`
Expected: PASS, no errors.

- [ ] **Step 8: Manual verification**

Run: `npm run dev`, sign in as `principal`, confirm "Nutrition Consolidator"
appears in the sidebar and opens the new page; sign in as `subjectTeacher`
(a role not in the access list) and confirm it does not appear.

- [ ] **Step 9: Commit**

```bash
git add src/pageAccess.js src/App.jsx src/components/Sidebar.jsx src/__tests__/pageAccess.test.js
git commit -m "feat(sf8): route and expose the nutrition consolidator page"
```

---

## Final check

- [ ] Run `npm run lint && npm run test` once more from a clean state and
  confirm everything passes.
- [ ] Confirm both `print-safety-audit` passes (Task 5, Task 8) are recorded.
- [ ] Confirm `firebase deploy --only firestore:rules` (Task 7) completed
  successfully, not just committed.
