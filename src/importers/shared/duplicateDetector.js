// src/importers/shared/duplicateDetector.js
// Duplicate detection at multiple levels:
//  1. duplicate LRN within one file
//  2. duplicate LRN across files in the same batch
//  3. existing LRN already in Firestore
//  4. duplicate enrollment (same learner, school year, grade, section)
//  5. conflicting learner identity for the same LRN
//
// Identity conflicts (different name/birth date/sex for the same LRN) are
// reported as serious (blocking) issues — we never silently overwrite.

import { makeIssue, ERROR, WARNING } from "./validation.js";
import { identityFingerprint } from "./validation.js";

/**
 * Annotate a flat list of records with duplicate metadata and issues.
 * @param {Array} records - each: { _id, lrn, fileIndex, fileLabel,
 *                              schoolYear, gradeLevel, section, identity }
 * @param {Object} existingByLrn - Firestore map: { [lrn]: { id, data } }
 * @returns {{ records, duplicates: {within:Object, cross:Object}, conflicts:Array }}
 */
export function detectDuplicates(records, existingByLrn = {}, options = {}) {
  // What counts as "the same record" differs by document type. For SF1 a repeated
  // LRN is always a duplicate learner. For SF10 it is not: one permanent record
  // legitimately lists the same learner once per school year + grade level, so
  // the caller narrows the key to keep those from being reported as duplicates.
  const { keyOf = (r) => r.lrn } = options;

  const byLrn = new Map(); // dedupe key -> array of record refs

  records.forEach((r) => {
    if (!r.lrn) return;
    const key = keyOf(r);
    if (!key) return;
    if (!byLrn.has(key)) byLrn.set(key, []);
    byLrn.get(key).push(r);
  });

  const within = {};
  const cross = {};
  const conflicts = [];

  const annotated = records.map((r) => ({
    ...r,
    duplicate: { withinFile: false, crossFile: false, inFirestore: false, enrollment: false },
  }));

  const indexOf = new Map();
  annotated.forEach((r) => indexOf.set(r._id, r));

  byLrn.forEach((group) => {
    // Report the learner's LRN, which is not necessarily the dedupe key.
    const lrn = group[0].lrn;
    // 1 + 2: duplicate LRN within file / across files
    const byFile = {};
    group.forEach((r) => {
      byFile[r.fileIndex] = (byFile[r.fileIndex] || []).concat(r);
    });

      Object.entries(byFile).forEach(([, list]) => {
      if (list.length > 1) {
        within[lrn] = (within[lrn] || []).concat(list.map((r) => r._id));
        list.forEach((r) => {
          const rec = indexOf.get(r._id);
          rec.duplicate.withinFile = true;
          rec.issues.push(
            makeIssue(
              ERROR,
              "duplicate-lrn-within-file",
              `LRN ${lrn} appears ${list.length} times in the same file.`,
              { field: "lrn", recordIndex: rec.recordIndex }
            )
          );
        });
      }
    });

    if (group.length > 1 && Object.keys(byFile).length > 1) {
      cross[lrn] = group.map((r) => r._id);
      group.forEach((r) => {
        const rec = indexOf.get(r._id);
        rec.duplicate.crossFile = true;
        rec.issues.push(
          makeIssue(
            ERROR,
            "duplicate-lrn-across-files",
            `LRN ${lrn} also appears in another file in this batch.`,
            { field: "lrn", recordIndex: rec.recordIndex }
          )
        );
      });
    }

    // 5: identity conflicts for the same LRN
    if (group.length > 1) {
      const fingerprints = new Set(group.map((r) => r.identity));
      if (fingerprints.size > 1) {
        const detail = group
          .map(
            (r) =>
              `${r.fileLabel} row ${r.recordIndex}: ${r.lastName || "?"}, ${r.firstName || "?"}, ${r.sex || "-"}, ${r.birthDate || "-"}`
          )
          .join("  |  ");
        conflicts.push({ lrn, group, detail });
        group.forEach((r) => {
          const rec = indexOf.get(r._id);
          rec.issues.push(
            makeIssue(
              ERROR,
              "identity-conflict",
              `LRN ${lrn} is used by rows with conflicting identity (name/birth date/sex). ${detail}`,
              { field: "lrn", recordIndex: rec.recordIndex }
            )
          );
        });
      }
    }
  });

  // 3: existing LRN already in Firestore + 4: duplicate enrollment
  annotated.forEach((r) => {
    if (!r.lrn) return;
    const existing = existingByLrn[r.lrn];
    if (existing) {
      r.duplicate.inFirestore = true;
      const matchedIdent = r.identity && existing.data
        ? identityFingerprint(existing.data) === r.identity
        : false;

      if (!matchedIdent) {
        r.issues.push(
          makeIssue(
            ERROR,
            "existing-lrn-identity-conflict",
            `LRN ${r.lrn} already exists in the system with different identity information. A conflict must be resolved before importing.`,
            { field: "lrn", recordIndex: r.recordIndex }
          )
        );
      } else {
        r.issues.push(
          makeIssue(
            WARNING,
            "existing-lrn",
            `LRN ${r.lrn} already exists in the system. The learner will be skipped (identity matches).`,
            { field: "lrn", recordIndex: r.recordIndex }
          )
        );
      }

      // Duplicate enrollment: same learner already enrolled for that context.
      if (
        existing.data &&
        String(existing.data.schoolYear || "") === String(r.schoolYear || "") &&
        String(existing.data.gradeLevel || "") === String(r.gradeLevel || "") &&
        String(existing.data.section || "") === String(r.section || "")
      ) {
        r.duplicate.enrollment = true;
      }
    }
  });

  return { records: annotated, duplicates: { within, cross }, conflicts };
}
