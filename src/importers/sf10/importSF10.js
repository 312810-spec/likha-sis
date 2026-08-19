// src/importers/sf10/importSF10.js
// Orchestrates the SF10 import pipeline for ONE file:
//   read -> detect structure -> parse -> normalize -> validate -> duplicates
//   -> build an academic-record preview model.
// Like SF1, this only ANALYZES — Firestore writes happen separately for approved
// records via shared/firestoreImport.js.

import { readWorkbook } from "../shared/excelReader.js";
import { detectDocumentType } from "../shared/documentDetector.js";
import { detectSF10Structure } from "./detectSF10Structure.js";
import { parseSF10, extractSF10Identity } from "./parseSF10.js";
import { normalizeSF10 } from "./normalizeSF10.js";
import { validateSF10 } from "./validateSF10.js";
import { identityFingerprint, ERROR, WARNING } from "../shared/validation.js";
import { applyDuplicates } from "../sf1/importSF1.js";
import { computeFileFingerprint } from "../shared/importBatch.js";

function emptyRecord() {
  return {
    lrn: "",
    lastName: "",
    firstName: "",
    middleName: "",
    nameExtension: "",
    sex: "",
    birthDate: "",
    schoolId: "",
    schoolName: "",
    division: "",
    district: "",
    schoolYear: "",
    gradeLevel: "",
    section: "",
    learningAreas: [],
    generalAverage: "",
    promotionStatus: "",
    remarks: "",
  };
}

function errorFileResult({ filename, fileIndex, fingerprint, message, code }) {
  return {
    filename,
    fileIndex,
    fingerprint,
    documentType: "sf10",
    status: "error",
    learnerCount: 0,
    records: [],
    school: emptyRecord(),
    fileIssues: [{ severity: ERROR, code, message }],
    sheetName: "",
  };
}

/**
 * Analyze a single SF10 file's bytes into a file preview model.
 * The official SF10 is one learner per form, so a workbook yields one record
 * (the best SF10 sheet wins when several are present).
 */
export async function processSF10Buffer(arrayBuffer, opts = {}) {
  const { filename = "unknown.xls", fileIndex = 0 } = opts;
  const fingerprint = computeFileFingerprint(arrayBuffer);
  const base = { filename, fileIndex, fingerprint, documentType: "sf10" };

  let workbook;
  try {
    workbook = readWorkbook(arrayBuffer);
  } catch (err) {
    return errorFileResult({ ...base, message: err.message, code: "unreadable" });
  }

  // The SF10 is a multi-page, multi-year form: the learner's identity appears
  // once (page 1) while the scholastic blocks continue across the later pages.
  // Every SF10-looking sheet therefore contributes its blocks, all of them
  // parsed against the single identity.
  const sf10Sheets = workbook.sheets
    .filter((sheet) => detectDocumentType(sheet) !== "unknown")
    .map((sheet) => ({ sheet, structure: detectSF10Structure(sheet) }));

  const identityEntry = sf10Sheets.find((e) => e.structure.identityRow !== null);

  if (!identityEntry) {
    return errorFileResult({
      ...base,
      message:
        "No recognizable SF10 (Learner's Permanent Academic Record) identity header was found in this workbook.",
      code: "no-structure",
    });
  }

  const identity = extractSF10Identity(identityEntry.structure);

  const raws = [];
  sf10Sheets.forEach((entry) => {
    const { raws: sheetRaws } = parseSF10(entry.structure, entry.sheet, identity);
    sheetRaws.forEach((raw) => raws.push({ raw, entry }));
  });

  const fileIssues = (identityEntry.structure.warnings || []).map((w) => ({
    severity: WARNING,
    code: "structure",
    message: w,
  }));

  if (raws.length === 0) {
    fileIssues.push({
      severity: WARNING,
      code: "structure",
      message:
        "The learner was identified but no scholastic record with grades could be read from this workbook.",
    });
  }

  const normalized = normalizeSF10(raws.map((r) => r.raw));
  const { records } = validateSF10(normalized);

  const finalRecords = records.map((rec, i) => ({
    ...rec,
    _id: `f${fileIndex}-r${i}`,
    fileIndex,
    fileLabel: filename,
    identity: identityFingerprint(rec.learner),
    sourceFileFingerprint: fingerprint,
    duplicate: { withinFile: false, crossFile: false, inFirestore: false, enrollment: false },
    summary: rec.summary,
    severity:
      rec.summary.errors > 0 ? "error" : rec.summary.warnings > 0 ? "warning" : "valid",
    learner: { ...rec.learner, _rowIndex: raws[i].raw._blockRow },
  }));

  const first = finalRecords[0] ? finalRecords[0].learner : emptyRecord();
  const hasError = finalRecords.some((r) => r.severity === "error");
  const hasWarning =
    !hasError && (finalRecords.some((r) => r.severity === "warning") || fileIssues.length > 0);

  return {
    ...base,
    sheetName: identityEntry.sheet.name,
    sheetCount: workbook.sheets.length,
    school: {
      schoolId: first.schoolId,
      schoolName: first.schoolName,
      division: first.division,
      district: first.district,
      schoolYear: first.schoolYear,
      gradeLevel: first.gradeLevel,
      section: first.section,
    },
    records: finalRecords,
    fileIssues,
    status: hasError ? "error" : hasWarning ? "warning" : "valid",
    learnerCount: finalRecords.length,
  };
}

/**
 * Dedupe key for SF10 records. A permanent academic record legitimately repeats
 * the same LRN once per school year + grade level, so only a repeat of the SAME
 * year and grade is a genuine duplicate. This mirrors the Firestore document id
 * used by executeSF10Import (`${lrn}_${schoolYear}_${gradeLevel}`).
 */
export function sf10DedupeKey(record) {
  if (!record.lrn) return "";
  return [record.lrn, record.schoolYear || "", record.gradeLevel || ""].join("|");
}

/** Analyze many SF10 files and aggregate batch totals. */
export async function analyzeSF10Files(files, existingByLrn = {}) {
  const fileModels = [];
  for (let i = 0; i < files.length; i++) {
    try {
      const buffer = await files[i].arrayBuffer();
      fileModels.push(
        await processSF10Buffer(buffer, {
          filename: files[i].name,
          fileIndex: i,
        })
      );
    } catch (err) {
      fileModels.push(
        errorFileResult({
          filename: files[i].name,
          fileIndex: i,
          fingerprint: "",
          message: `Could not read "${files[i].name}". ${err.message}`,
          code: "read-error",
        })
      );
    }
  }
  const analyzed = applyDuplicates(fileModels, existingByLrn, { keyOf: sf10DedupeKey });
  return { files: analyzed, batch: aggregateBatch(analyzed) };
}

/** Aggregate per-file SF10 models into batch-level totals. */
export function aggregateBatch(fileModels) {
  let totalLearners = 0;
  let errorCount = 0;
  let warningCount = 0;
  let duplicateCount = 0;
  let filesWithErrors = 0;

  fileModels.forEach((f) => {
    if (f.status === "error") filesWithErrors++;
    totalLearners += f.records.length;
    (f.records || []).forEach((r) => {
      const d = r.duplicate || {};
      if (d.withinFile || d.crossFile || d.inFirestore || d.enrollment) duplicateCount++;
      errorCount += r.summary?.errors || 0;
      warningCount += r.summary?.warnings || 0;
    });
    (f.fileIssues || []).forEach((i) => {
      if (i.severity === ERROR) errorCount++;
      if (i.severity === WARNING) warningCount++;
    });
  });

  const blockingErrors = errorCount > 0;
  return {
    fileCount: fileModels.length,
    filesAnalyzed: fileModels.length - filesWithErrors,
    filesWithErrors,
    totalLearners,
    duplicateCount,
    warningCount,
    errorCount,
    blockingErrors,
    canImport: !blockingErrors && totalLearners > 0,
  };
}

