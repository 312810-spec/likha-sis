// src/importers/sf10/importSF10.js
// Orchestrates the SF10 import pipeline for ONE file:
//   read -> detect structure -> parse -> normalize -> validate -> duplicates
//   -> build an academic-record preview model.
// Like SF1, this only ANALYZES — Firestore writes happen separately for approved
// records via shared/firestoreImport.js.

import { readWorkbook } from "../shared/excelReader.js";
import { detectDocumentType } from "../shared/documentDetector.js";
import { detectSF10Structure } from "./detectSF10Structure.js";
import { parseSF10 } from "./parseSF10.js";
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

  // Select the best SF10 sheet (the one with a detected identity header).
  let chosen = null;
  for (const sheet of workbook.sheets) {
    if (detectDocumentType(sheet) === "unknown") continue;
    const structure = detectSF10Structure(sheet);
    if (structure.identityRow === null) continue;
    if (!chosen || sheet.rowCount > chosen.sheet.rowCount) {
      chosen = { sheet, structure };
    }
  }

  if (!chosen) {
    return errorFileResult({
      ...base,
      message:
        "No recognizable SF10 (Learner's Permanent Academic Record) identity header was found in this workbook.",
      code: "no-structure",
    });
  }

  const { raw } = parseSF10(chosen.structure, chosen.sheet);
  const normalized = normalizeSF10([raw])[0];

  const fileIssues = (chosen.structure.warnings || []).map((w) => ({
    severity: WARNING,
    code: "structure",
    message: w,
  }));

  const { records } = validateSF10([normalized]);
  const final = {
    ...records[0],
    _id: `f${fileIndex}-r0`,
    fileIndex,
    fileLabel: filename,
    identity: identityFingerprint(records[0].learner),
    sourceFileFingerprint: fingerprint,
    duplicate: { withinFile: false, crossFile: false, inFirestore: false, enrollment: false },
    summary: records[0].summary,
    severity:
      records[0].summary.errors > 0
        ? "error"
        : records[0].summary.warnings > 0
        ? "warning"
        : "valid",
  };

  const learner = { ...final.learner };
  return {
    ...base,
    sheetName: chosen.sheet.name,
    sheetCount: workbook.sheets.length,
    school: {
      schoolId: learner.schoolId,
      schoolName: learner.schoolName,
      division: learner.division,
      district: learner.district,
      schoolYear: learner.schoolYear,
      gradeLevel: learner.gradeLevel,
      section: learner.section,
    },
    records: [
      {
        ...final,
        learner: { ...final.learner, _rowIndex: chosen.structure.identityRow + 1 },
      },
    ],
    fileIssues,
    status: final.severity === "error" ? "error" : final.severity === "warning" ? "warning" : "valid",
    learnerCount: learner.lrn ? 1 : 0,
  };
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
  const analyzed = applyDuplicates(fileModels, existingByLrn);
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

