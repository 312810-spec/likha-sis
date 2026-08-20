// src/importers/shared/firestoreImport.js
// Executes the approved import into Firestore, reusing the EXISTING learner
// data model (the `learners` collection used by SF1 / ViewLearners / SMEA).
//
// SF10 academic-record imports do NOT fit the learner data model, so they go
// through the sibling executeSF10Import() below, which writes one documented
// set per learner per school year + grade level into the `academicRecords`
// collection instead of the `learners` collection.
//
// Safety guarantees:
//  - refuses to write when any blocking validation error exists
//  - detects prior imports via file fingerprint (idempotency)
//  - never silently overwrites an existing learner's identity:
//      * same LRN + different identity  -> blocked earlier (validation)
//      * same LRN + matching identity   -> only enrollment/import fields updated
//      * brand new LRN                  -> new learner document created
//  - writes are committed with chunked Firestore batches (max 500/batch)

import {
  collection,
  getDocs,
  writeBatch,
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { createImportId, buildImportMetadata } from "./importBatch.js";

const BATCH_LIMIT = 500;

/** Compute age (as of today) from a YYYY-MM-DD birth date. */
export function calculateAge(birthDateString) {
  if (!birthDateString) return "";
  const birthDate = new Date(birthDateString);
  if (Number.isNaN(birthDate.getTime())) return "";
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const hadBirthday =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());
  if (!hadBirthday) age--;
  return age;
}

/**
 * Map a normalized importer learner onto the EXISTING Firestore learner shape.
 * Keeps the legacy field names used by ViewLearners / EditLearnerModal so the
 * imported records remain fully compatible with the rest of the app.
 */
export function toFirestoreLearner(learner, { importId, sourceFileFingerprint, userEmail }) {
  return {
    lrn: learner.lrn,
    lastName: learner.lastName,
    firstName: learner.firstName,
    middleName: learner.middleName,
    nameExtension: learner.nameExtension || "",
    sex: learner.sex,
    birthDate: learner.birthDate,
    age: learner.age || calculateAge(learner.birthDate),
    motherTongue: learner.motherTongue || "",
    ipEthnicGroup: learner.ipEthnicGroup || "",
    religion: learner.religion || "",
    address: learner.address || "",
    // SF1 records the address in four parts; keep them so the register can be
    // reprinted exactly and the Edit modal has something to edit.
    houseStreetSitio: learner.houseStreetSitio || "",
    barangay: learner.barangay || "",
    municipalityCity: learner.municipalityCity || "",
    province: learner.province || "",
    fathersName: learner.fathersName || "",
    mothersMaidenName: learner.mothersMaidenName || learner.mothersName || "",
    guardianName: learner.guardianName || learner.guardian || "",
    guardianRelationship: learner.guardianRelationship || "",
    contactNumber: learner.contactNumber || "",
    learningModality: learner.learningModality || "",
    remarks: learner.remarks || "",

    // enrollment context (from the workbook)
    schoolId: learner.schoolId || "",
    schoolName: learner.schoolName || "",
    region: learner.region || "",
    division: learner.division || "",
    district: learner.district || "",
    schoolYear: learner.schoolYear || "",
    gradeLevel: learner.gradeLevel || "",
    section: learner.section || "",

    // import metadata / traceability
    source: "SF1_IMPORT",
    documentType: "sf1",
    importId,
    sourceFileFingerprint,
    addedByTeacherEmail: userEmail,
  };
}

/** Fetch existing learners, keyed by LRN, to power dedup / conflict checks. */
export async function fetchExistingLearnersByLrn(db) {
  const snapshot = await getDocs(collection(db, "learners"));
  const map = {};
  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const lrn = String(data.lrn || "").trim();
    if (lrn && !map[lrn]) {
      map[lrn] = { id: docSnap.id, data };
    }
  });
  return map;
}

/** Check whether any prior successful import used the same file fingerprint. */
export async function findPriorImport(db, fingerprints) {
  if (!fingerprints || fingerprints.length === 0) return null;
  const snap = await getDocs(collection(db, "importBatches"));
  let found = null;
  snap.forEach((docSnap) => {
    const data = docSnap.data();
    if (data.status !== "success") return;
    const prior = Array.isArray(data.fileFingerprints) ? data.fileFingerprints : [];
    const overlap = fingerprints.some((fp) => prior.includes(fp));
    if (overlap && !found) found = { id: docSnap.id, data };
  });
  return found;
}

/**
 * Execute an approved import batch into Firestore.
 * Safety: blocks when any record has a blocking error; creates new learners for
 * brand-new LRNs, updates the existing document in place for a matching-identity
 * LRN with a new enrollment context (re-enrollment), and skips only exact
 * duplicate enrollments; chunks writes.
 */
export async function executeImport(db, opts = {}) {
  const {
    records = [],
    documentType = "sf1",
    school = {},
    filenames = [],
    fileFingerprints = [],
    importedByEmail = "",
  } = opts;

  const importId = createImportId();

  const blocked = records.filter((r) => r.severity === "error");
  if (blocked.length > 0) {
    return {
      importId,
      status: "blocked",
      written: 0,
      skipped: 0,
      blockedCount: blocked.length,
      error: `Import blocked: ${blocked.length} record(s) have blocking errors. Fix them before importing.`,
    };
  }

  // Records are shaped { learner: { lrn, ... }, issues, severity, ... }.
  // The LRN lives on r.learner.lrn, NOT at r.lrn directly.
  // - Brand new LRN                          -> create a new learner document.
  // - Existing LRN, matching identity, but a
  //   different school year/grade/section    -> re-enrollment: update the
  //   existing document's enrollment fields in place, rather than skipping it.
  // - Existing LRN with the exact same
  //   enrollment already recorded            -> true duplicate, skip.
  const toCreate = records.filter(
    (r) => r.learner?.lrn && !(r.duplicate && r.duplicate.inFirestore)
  );
  const toUpdate = records.filter(
    (r) =>
      r.learner?.lrn &&
      r.duplicate?.inFirestore &&
      r.duplicate?.existingId &&
      !r.duplicate?.enrollment
  );
  const skippedCount = records.length - toCreate.length - toUpdate.length;

  const createDocs = toCreate.map((r) => {
    const fp =
      r.sourceFileFingerprint ||
      (fileFingerprints[r.fileIndex] ? fileFingerprints[r.fileIndex] : "");
    return {
      ref: doc(collection(db, "learners")),
      data: {
        ...toFirestoreLearner(r.learner, {
          importId,
          sourceFileFingerprint: fp,
          userEmail: importedByEmail,
        }),
        createdAt: serverTimestamp(),
        importBatchId: importId,
      },
    };
  });

  const updateDocs = toUpdate.map((r) => {
    const fp =
      r.sourceFileFingerprint ||
      (fileFingerprints[r.fileIndex] ? fileFingerprints[r.fileIndex] : "");
    return {
      ref: doc(db, "learners", r.duplicate.existingId),
      data: {
        ...toFirestoreLearner(r.learner, {
          importId,
          sourceFileFingerprint: fp,
          userEmail: importedByEmail,
        }),
        updatedAt: serverTimestamp(),
        importBatchId: importId,
      },
    };
  });

  for (let i = 0; i < createDocs.length; i += BATCH_LIMIT) {
    const chunk = createDocs.slice(i, i + BATCH_LIMIT);
    const batch = writeBatch(db);
    chunk.forEach((d) => batch.set(d.ref, d.data));
    await batch.commit();
  }

  for (let i = 0; i < updateDocs.length; i += BATCH_LIMIT) {
    const chunk = updateDocs.slice(i, i + BATCH_LIMIT);
    const batch = writeBatch(db);
    chunk.forEach((d) => batch.update(d.ref, d.data));
    await batch.commit();
  }

  const metadata = buildImportMetadata({
    importId,
    documentType,
    schoolId: school.schoolId || "",
    schoolYear: school.schoolYear || "",
    filenames,
    fileFingerprints,
    learnerCount: records.length,
    successfulRecords: createDocs.length + updateDocs.length,
    skippedRecords: skippedCount,
    errors: records.reduce((n, r) => n + (r.summary?.errors || 0), 0),
    warnings: records.reduce((n, r) => n + (r.summary?.warnings || 0), 0),
    status: "success",
    importedByEmail,
  });
  await setDoc(doc(db, "importBatches", importId), {
    ...metadata,
    createdAt: serverTimestamp(),
  });

  return {
    importId,
    status: "success",
    written: createDocs.length,
    updated: updateDocs.length,
    skipped: skippedCount,
    blockedCount: 0,
  };
}

/**
 * Build the deterministic document id for an SF10 academic record.
 * One learner may have several scholastic records (one per school year + grade
 * level), so the id is `${lrn}_${schoolYear}_${gradeLevel}` with spaces replaced
 * by underscores (matching the makeDocumentId convention in SF2.jsx / SF4.jsx).
 */
function sf10DocumentId(learner) {
  const part = (value) => String(value ?? "").trim().replace(/\s+/g, "_");
  return [part(learner.lrn), part(learner.schoolYear), part(learner.gradeLevel)].join("_");
}

/**
 * Execute an approved SF10 import into Firestore.
 * Dedicated sibling of executeImport(): SF10 records describe one scholastic
 * block per learner per school year + grade level, so they are written to the
 * `academicRecords` collection keyed by `${lrn}_${schoolYear}_${gradeLevel}`
 * instead of being forced through the learner identity model. No deduplication
 * against the `learners` collection is performed -- academicRecords is keyed
 * independently.
 * Safety:
 *  - blocks when any record has a blocking error
 *  - a re-import of the same grade level's record REPLACES the stored document
 *    (setDoc without merge) so stale grade data can never linger
 *  - writes are committed with chunked Firestore batches (max 500/batch)
 */
export async function executeSF10Import(db, opts = {}) {
  const {
    records = [],
    school = {},
    filenames = [],
    fileFingerprints = [],
    importedByEmail = "",
  } = opts;

  const importId = createImportId();

  const blocked = records.filter((r) => r.severity === "error");
  if (blocked.length > 0) {
    return {
      importId,
      status: "blocked",
      written: 0,
      skipped: 0,
      blockedCount: blocked.length,
      error: `Import blocked: ${blocked.length} record(s) have blocking errors. Fix them before importing.`,
    };
  }

  const toWrite = records.filter((r) => {
    const lrn = String(r.lrn || r.learner?.lrn || "").trim();
    return lrn !== "";
  });
  const skippedCount = records.length - toWrite.length;

  const docs = toWrite.map((r) => {
    const learner = r.learner || {};
    const fp =
      r.sourceFileFingerprint ||
      (fileFingerprints[r.fileIndex] ? fileFingerprints[r.fileIndex] : "");
    return {
      ref: doc(db, "academicRecords", sf10DocumentId(learner)),
      data: {
        // normalized SF10 academic-record fields, kept as-is
        lrn: learner.lrn || "",
        lastName: learner.lastName || "",
        firstName: learner.firstName || "",
        middleName: learner.middleName || "",
        nameExtension: learner.nameExtension || "",
        sex: learner.sex || "",
        birthDate: learner.birthDate || "",
        schoolId: learner.schoolId || "",
        schoolName: learner.schoolName || "",
        division: learner.division || "",
        district: learner.district || "",
        schoolYear: learner.schoolYear || "",
        gradeLevel: learner.gradeLevel || "",
        section: learner.section || "",
        learningAreas: learner.learningAreas || [],
        generalAverage: learner.generalAverage || "",
        promotionStatus: learner.promotionStatus || "",
        remarks: learner.remarks || "",

        // import metadata / traceability
        source: "SF10_IMPORT",
        documentType: "sf10",
        importId,
        sourceFileFingerprint: fp,
        importedByEmail,
        createdAt: serverTimestamp(),
        importBatchId: importId,
      },
    };
  });

  for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
    const chunk = docs.slice(i, i + BATCH_LIMIT);
    const batch = writeBatch(db);
    chunk.forEach((d) => batch.set(d.ref, d.data));
    await batch.commit();
  }

  const metadata = buildImportMetadata({
    importId,
    documentType: "sf10",
    schoolId: school.schoolId || "",
    schoolYear: school.schoolYear || "",
    filenames,
    fileFingerprints,
    learnerCount: records.length,
    successfulRecords: docs.length,
    skippedRecords: skippedCount,
    errors: records.reduce((n, r) => n + (r.summary?.errors || 0), 0),
    warnings: records.reduce((n, r) => n + (r.summary?.warnings || 0), 0),
    status: "success",
    importedByEmail,
  });
  await setDoc(doc(db, "importBatches", importId), {
    ...metadata,
    createdAt: serverTimestamp(),
  });

  return {
    importId,
    status: "success",
    written: docs.length,
    skipped: skippedCount,
    blockedCount: 0,
  };
}
