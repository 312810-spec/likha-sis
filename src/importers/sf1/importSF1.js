// src/importers/sf1/importSF1.js
// Orchestrates the full SF1 import pipeline for ONE file:
//   read -> detect document type -> detect structure -> parse -> normalize
//   -> validate -> duplicates -> statistics -> build a file preview model.
// Keeping this orchestration separate from the UI keeps parsing/validation and
// presentation concerns cleanly separated.
//
// IMPORTANT: This never imports into Firestore. It only ANALYZES. Writes are
// performed later by the UI only for approved (error-free) records via
// shared/firestoreImport.js.

import { readWorkbook } from "../shared/excelReader.js";
import { detectDocumentType } from "../shared/documentDetector.js";
import { detectSF1Structure, findSummaryRow } from "./detectSF1Structure.js";
import { parseSF1 } from "./parseSF1.js";
import { normalizeSF1 } from "./normalizeSF1.js";
import { validateSF1 } from "./validateSF1.js";
import { detectDuplicates } from "../shared/duplicateDetector.js";
import { computeStatistics, compareWithSummary } from "../shared/statistics.js";
import { identityFingerprint, summarizeIssues, ERROR, WARNING } from "../shared/validation.js";
import { computeFileFingerprint } from "../shared/importBatch.js";

function emptySchool() {
  return {
    schoolId: "",
    schoolName: "",
    region: "",
    division: "",
    district: "",
    schoolYear: "",
    gradeLevel: "",
    section: "",
  };
}

function errorFileResult({ filename, fileIndex, fingerprint, message, code = "file-error" }) {
  return {
    filename,
    fileIndex,
    fingerprint,
    documentType: "sf1",
    status: "error",
    learnerCount: 0,
    records: [],
    stats: { total: 0, male: 0, female: 0 },
    school: emptySchool(),
    fileIssues: [{ severity: ERROR, code, message }],
    summaryWarnings: [],
    droppedCount: 0,
    droppedSamples: [],
    sheetName: "",
  };
}

/**
 * Analyze every worksheet and pick the best SF1 learner sheet (the one with the
 * most parsed learners). A single SF1 file normally holds one class list, so we
 * surface one sheet per file but keep the sheet name + a flag when several SF1
 * sheets exist so the user is aware.
 */
function selectBestSheet(workbook) {
  const candidates = [];
  for (const sheet of workbook.sheets) {
    if (detectDocumentType(sheet) === "unknown") continue;
    let structure;
    try {
      structure = detectSF1Structure(sheet);
    } catch {
      continue;
    }
    // headerRow is a 0-based ROW INDEX: a truthiness check would discard a sheet
    // whose learner header happens to be the very first row.
    if (structure.headerRow === null || structure.headerRow === undefined) continue;
    const { rawLearners, droppedRows } = parseSF1(structure);
    const { learners } = normalizeSF1(rawLearners);
    const { records } = validateSF1(learners);
    candidates.push({ sheet, structure, rawLearners, droppedRows, learners, records });
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.learners.length - a.learners.length);
  return { candidates, chosen: candidates[0] };
}

/**
 * Analyze a single SF1 file's bytes into a file preview model.
 * @param {ArrayBuffer} arrayBuffer - raw file bytes (from file.arrayBuffer())
 * @param {Object} opts - { filename, fileIndex, existingByLrn }
 * @returns {Object} file preview model
 */
export async function processSF1Buffer(arrayBuffer, opts = {}) {
  const { filename = "unknown.xls", fileIndex = 0 } = opts;
  const fingerprint = computeFileFingerprint(arrayBuffer);
  const base = { filename, fileIndex, fingerprint, documentType: "sf1" };

  let workbook;
  try {
    workbook = readWorkbook(arrayBuffer);
  } catch (err) {
    return errorFileResult({ ...base, message: err.message, code: "unreadable" });
  }

  const selected = selectBestSheet(workbook);
  if (!selected) {
    return errorFileResult({
      ...base,
      message:
        "No recognizable SF1 learner table was found in this workbook. " +
        "The file may not be an SF1 (Learner's Information Sheet) or its layout was not recognized.",
      code: "no-structure",
    });
  }

  const { chosen, candidates } = selected;
  const { structure, droppedRows, learners } = chosen;

  // File-level issues from structure detection warnings.
  const fileIssues = (structure.warnings || []).map((w) => ({
    severity: WARNING,
    code: "structure",
    message: w,
  }));

  // Statistics are computed INDEPENDENTLY from parsed records (never trust
  // TOTAL MALE / TOTAL FEMALE / COMBINED rows as the learner source).
  const stats = computeStatistics(learners);
  const summaryRow = findSummaryRow(chosen.sheet, structure.headerRow);
  const summaryWarnings = compareWithSummary(stats, summaryRow);
  summaryWarnings.forEach((w) =>
    fileIssues.push({ severity: WARNING, code: "summary-mismatch", message: w })
  );


  // Build records with metadata needed for batch-level duplicate detection.
  const records = chosen.records.map((rec, i) => ({
    ...rec,
    _id: `f${fileIndex}-r${i}`,
    fileIndex,
    fileLabel: filename,
    identity: identityFingerprint(rec.learner),
    sourceFileFingerprint: fingerprint,
    duplicate: { withinFile: false, crossFile: false, inFirestore: false, enrollment: false },
    summary: summarizeIssues(rec.issues),
    severity:
      summarizeIssues(rec.issues).errors > 0
        ? "error"
        : summarizeIssues(rec.issues).warnings > 0
        ? "warning"
        : "valid",
  }));

  const hasError = records.some((r) => r.severity === "error");
  const hasWarning =
    !hasError && (records.some((r) => r.severity === "warning") || fileIssues.length > 0);

  return {
    ...base,
    sheetName: chosen.sheet.name,
    sheetCount: workbook.sheets.length,
    multiSheetSF1: candidates.length > 1,
    school: { ...structure.context },
    records,
    stats,
    summaryWarnings,
    fileIssues,
    droppedCount: droppedRows.length,
    droppedSamples: droppedRows.slice(0, 5).map((r) => ({
      rowIndex: r._rowIndex,
      fields: Object.keys(r)
        .filter((k) => !k.startsWith("_"))
        .slice(0, 6)
        .reduce((acc, k) => {
          acc[k] = String(r[k] ?? "");
          return acc;
        }, {}),
    })),
    status: hasError ? "error" : hasWarning ? "warning" : "valid",
    learnerCount: learners.length,
  };
}

/**
 * Convenience wrapper for the UI: takes an array of File objects and analyzes
 * them all, returning an array of file models plus shared batch totals.
 * @param {Array<File>} files
 * @param {Object} existingByLrn
 * @returns {Promise<{ files: Array, batch: Object }>}
 */
export async function analyzeSF1Files(files, existingByLrn = {}) {
  const fileModels = [];
  for (let i = 0; i < files.length; i++) {
    try {
      const buffer = await files[i].arrayBuffer();
      fileModels.push(
        await processSF1Buffer(buffer, {
          filename: files[i].name,
          fileIndex: i,
        })
      );
    } catch (err) {
      fileModels.push({
        filename: files[i].name,
        fileIndex: i,
        fingerprint: "",
        documentType: "sf1",
        status: "error",
        learnerCount: 0,
        records: [],
        stats: { total: 0, male: 0, female: 0 },
        school: emptySchool(),
        fileIssues: [
          {
            severity: ERROR,
            code: "read-error",
            message: `Could not read "${files[i].name}". ${err.message}`,
          },
        ],
        summaryWarnings: [],
        droppedCount: 0,
        droppedSamples: [],
        sheetName: "",
      });
    }
  }
  const analyzed = applyDuplicates(fileModels, existingByLrn);
  return { files: analyzed, batch: aggregateBatch(analyzed) };
}

/**
 * Run duplicate detection across the WHOLE batch (within-file, cross-file,
 * Firestore-existing, duplicate enrollment, and identity conflicts) for SF1 and
 * SF10 alike. `detectDuplicates` expects flat records (lrn/name on the record),
 * so we map the nested `learner` shape to that flat shape, run detection, then
 * merge the resulting issues/duplicate flags back into the file models.
 *
 * @param {Array} fileModels
 * @param {Object} existingByLrn
 * @param {Object} [options] - forwarded to detectDuplicates (e.g. `keyOf`, which
 *        SF10 narrows so one learner's several school years are not duplicates)
 * @returns {Array} updated fileModels
 */
export function applyDuplicates(fileModels, existingByLrn = {}, options = {}) {
  const byId = new Map();
  const flat = fileModels.flatMap((f) =>
    (f.records || []).map((r) => {
      const l = r.learner || {};
      const flatRec = {
        _id: r._id,
        lrn: l.lrn,
        lastName: l.lastName,
        firstName: l.firstName,
        sex: l.sex,
        birthDate: l.birthDate,
        schoolYear: l.schoolYear,
        gradeLevel: l.gradeLevel,
        section: l.section,
        identity: r.identity,
        fileIndex: r.fileIndex,
        fileLabel: r.fileLabel,
        recordIndex: l._rowIndex,
        _original: r,
        issues: [],
      };
      byId.set(r._id, flatRec);
      return flatRec;
    })
  );

  const res = detectDuplicates(flat, existingByLrn, options);

  res.records.forEach((annotated) => {
    const orig = annotated._original;
    const dupIssues = annotated.issues || [];
    const combined = [...(orig.issues || []), ...dupIssues];
    const summary = summarizeIssues(combined);
    const severity =
      summary.errors > 0 ? "error" : summary.warnings > 0 ? "warning" : "valid";
    orig.issues = combined;
    orig.duplicate = annotated.duplicate || orig.duplicate;
    orig.summary = summary;
    orig.severity = severity;
    orig._dupDetails = {
      within: !!annotated.duplicate?.withinFile,
      cross: !!annotated.duplicate?.crossFile,
      firestore: !!annotated.duplicate?.inFirestore,
      enrollment: !!annotated.duplicate?.enrollment,
    };
  });

  // Recompute each file's status now that duplicate issues (errors) may exist.
  fileModels.forEach((f) => {
    const hasErr = (f.records || []).some((r) => r.severity === "error");
    const hasWarn =
      !hasErr &&
      ((f.records || []).some((r) => r.severity === "warning") ||
        (f.fileIssues && f.fileIssues.length > 0));
    if (hasErr) f.status = "error";
    else if (hasWarn) f.status = "warning";
  });

  return fileModels;
}

/**
 * Aggregate per-file models into batch-level totals for the import summary.
 * @param {Array} fileModels
 */
export function aggregateBatch(fileModels) {
  const byStatus = { valid: 0, warning: 0, error: 0 };
  let totalLearners = 0;
  let male = 0;
  let female = 0;
  let duplicateCount = 0;
  let warningCount = 0;
  let errorCount = 0;

  fileModels.forEach((f) => {
    const status = f.status && f.status !== "error" ? f.status : "error";
    byStatus[status] = (byStatus[status] || 0) + 1;
    if (f.records) totalLearners += f.records.length;
    if (f.stats) {
      male += f.stats.male;
      female += f.stats.female;
    }
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
    filesAnalyzed: fileModels.length - (byStatus.error || 0),
    filesWithErrors: byStatus.error || 0,
    totalLearners,
    male,
    female,
    duplicateCount,
    warningCount,
    errorCount,
    blockingErrors,
    canImport: !blockingErrors && totalLearners > 0,
    byStatus,
  };
}

