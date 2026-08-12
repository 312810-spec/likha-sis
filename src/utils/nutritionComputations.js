// src/utils/nutritionComputations.js
// Pure utility functions for DepEd / WHO BMI-for-Age nutritional status computations.

import {
  BMI_FOR_AGE_TABLE,
  BMI_TABLE_MIN_MONTHS,
  BMI_TABLE_MAX_MONTHS,
} from "./bmiForAgeTable.js";

/**
 * Returns the whole number of months between two ISO date strings (YYYY-MM-DD), floored.
 * Returns null if either date string is invalid or if measurementDate is before birthDate.
 *
 * @param {string} birthDateString - ISO date string (YYYY-MM-DD)
 * @param {string} measurementDateString - ISO date string (YYYY-MM-DD)
 * @returns {number|null}
 */
export function getAgeInMonths(birthDateString, measurementDateString) {
  if (!birthDateString || !measurementDateString) return null;
  if (typeof birthDateString !== "string" || typeof measurementDateString !== "string") return null;

  const isoRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!isoRegex.test(birthDateString) || !isoRegex.test(measurementDateString)) {
    return null;
  }

  const [bY, bM, bD] = birthDateString.split("-").map(Number);
  const [mY, mM, mD] = measurementDateString.split("-").map(Number);

  const birthDateObj = new Date(bY, bM - 1, bD);
  const measDateObj = new Date(mY, mM - 1, mD);

  if (
    isNaN(birthDateObj.getTime()) ||
    isNaN(measDateObj.getTime()) ||
    birthDateObj.getMonth() !== bM - 1 ||
    measDateObj.getMonth() !== mM - 1
  ) {
    return null;
  }

  let months = (mY - bY) * 12 + (mM - bM);
  if (mD < bD) {
    months -= 1;
  }

  if (months < 0) return null;

  return Math.floor(months);
}

/**
 * Computes Body Mass Index (BMI): weightKg / (heightM * heightM), rounded to 2 decimal places.
 * Returns null if heightM is 0 or either input is not a positive number.
 *
 * @param {number|string} weightKg
 * @param {number|string} heightM
 * @returns {number|null}
 */
export function computeBMI(weightKg, heightM) {
  if (weightKg === null || weightKg === undefined || heightM === null || heightM === undefined) {
    return null;
  }
  const w = Number(weightKg);
  const h = Number(heightM);

  if (isNaN(w) || isNaN(h) || w <= 0 || h <= 0) {
    return null;
  }

  const bmi = w / (h * h);
  return Number(bmi.toFixed(2));
}

/**
 * Classifies nutritional status using WHO 2007 BMI-for-age reference data.
 *
 * @param {number|string} bmi - Body Mass Index
 * @param {number} ageInMonths - Learner age in months
 * @param {string} sex - "M" or "F" (also accepts "Male"/"Female")
 * @returns {string|null} "Severely Wasted" | "Wasted" | "Normal" | "Overweight" | "Obese" | null
 */
export function classifyNutritionalStatus(bmi, ageInMonths, sex) {
  if (bmi === null || bmi === undefined || ageInMonths === null || ageInMonths === undefined) {
    return null;
  }
  const b = Number(bmi);
  const age = Number(ageInMonths);

  if (isNaN(b) || b <= 0 || isNaN(age)) {
    return null;
  }

  if (age < BMI_TABLE_MIN_MONTHS || age > BMI_TABLE_MAX_MONTHS) {
    return null;
  }

  let s = "";
  if (typeof sex === "string") {
    const cleanSex = sex.trim().toUpperCase();
    if (cleanSex === "M" || cleanSex === "MALE") {
      s = "M";
    } else if (cleanSex === "F" || cleanSex === "FEMALE") {
      s = "F";
    }
  }

  if (!s) return null;

  let targetRow = BMI_FOR_AGE_TABLE.find((row) => row[0] === age);
  if (!targetRow) {
    let minDiff = Infinity;
    for (const row of BMI_FOR_AGE_TABLE) {
      const diff = Math.abs(row[0] - age);
      if (diff < minDiff) {
        minDiff = diff;
        targetRow = row;
      }
    }
  }

  if (!targetRow) return null;

  let severelyWastedMax;
  let wastedMax;
  let normalMax;
  let overweightMax;

  if (s === "M") {
    [, severelyWastedMax, wastedMax, normalMax, overweightMax] = targetRow;
  } else {
    severelyWastedMax = targetRow[5];
    wastedMax = targetRow[6];
    normalMax = targetRow[7];
    overweightMax = targetRow[8];
  }

  if (b <= severelyWastedMax) return "Severely Wasted";
  if (b <= wastedMax) return "Wasted";
  if (b <= normalMax) return "Normal";
  if (b <= overweightMax) return "Overweight";
  return "Obese";
}
