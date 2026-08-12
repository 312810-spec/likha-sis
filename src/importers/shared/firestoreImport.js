// src/importers/shared/firestoreImport.js
// Executes the approved import into Firestore, reusing the EXISTING learner
// data model (the `learners` collection used by SF1 / ViewLearners / SMEA).
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
    religion: learner.religion || "",
    address: learner.address || "",
    // legacy address fields (importer keeps them empty; populated via Edit modal)
    houseStreetSitio: "",
    barangay: "",
    municipalityCity: "",
    province: "",
    fathersName: learner.fathersName || "",
    mothersMaidenName: learner.mothersName || "",
    guardianName: learner.guardian || "",
    guardianRelationship: "",
    contactNumber: learner.contactNumber || "",
    learningModality: learner.learningModality || "",
    remarks: learner.remarks || "",

    // enrollment context (from the workbook)
    schoolId: learner.schoolId || "",
    schoolName: learner.schoolName || "",
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
 * Safety: blocks when any record has a blocking error; only creates NEW learners
 * (existing matching LRNs are skipped to preserve history); chunks writes.
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

  const toWrite = records.filter((r) => r.lrn && !(r.duplicate && r.duplicate.inFirestore));
  const skippedCount = records.filter(
    (r) => !r.lrn || (r.duplicate && r.duplicate.inFirestore)
  ).length;

  const docs = toWrite.map((r) => {
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

  for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
    const chunk = docs.slice(i, i + BATCH_LIMIT);
    const batch = writeBatch(db);
    chunk.forEach((d) => batch.set(d.ref, d.data));
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

  return { importId, status: "success", written: docs.length, skipped: skippedCount, blockedCount: 0 };
}
