// src/importers/shared/importBatch.js
// Helpers for assembling import metadata and building a deterministic file
// fingerprint, so re-importing the same file can be detected (idempotency).

import CryptoJS from "crypto-js";

/** Generate a short, sortable, roughly-unique import id. */
export function createImportId() {
  const t = new Date();
  const stamp = [
    t.getFullYear(),
    String(t.getMonth() + 1).padStart(2, "0"),
    String(t.getDate()).padStart(2, "0"),
    String(t.getHours()).padStart(2, "0"),
    String(t.getMinutes()).padStart(2, "0"),
    String(t.getSeconds()).padStart(2, "0"),
    String(t.getMilliseconds()).padStart(3, "0"),
  ].join("");
  const rand = Math.random().toString(36).slice(2, 8);
  return `imp-${stamp}-${rand}`;
}

/**
 * Compute a deterministic fingerprint (SHA-256 hex) for a file's bytes.
 * Used to detect when the same file is imported twice.
 * @param {ArrayBuffer|Uint8Array} buffer
 */
export function computeFileFingerprint(buffer) {
  const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
  const wordArray = CryptoJS.lib.WordArray.create(bytes);
  return CryptoJS.SHA256(wordArray).toString(CryptoJS.enc.Hex);
}

/**
 * Build the metadata stored alongside every import.
 * @param {Object} opts
 */
export function buildImportMetadata({
  importId,
  documentType,
  schoolId,
  schoolYear,
  filenames,
  fileFingerprints,
  learnerCount,
  successfulRecords,
  skippedRecords,
  errors,
  warnings,
  status,
  importedByEmail,
}) {
  return {
    importId,
    documentType,
    schoolId: schoolId || "",
    schoolYear: schoolYear || "",
    filenames,
    fileFingerprints: fileFingerprints || [],
    fileCount: filenames.length,
    learnerCount,
    successfulRecords,
    skippedRecords,
    errors,
    warnings,
    status,
    importedByEmail: importedByEmail || "",
  };
}
