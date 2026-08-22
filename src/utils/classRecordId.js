// src/utils/classRecordId.js
// Canonical, Firestore-safe Class Record document ID builder. One
// classRecords document exists per gradeLevel+section+subject+term+
// schoolYear (see firestore.rules and ClassRecord.jsx) -- this is the single
// place that combines those five fields into an actual Firestore document
// ID, so every consumer (ClassRecord.jsx, the Dashboard's Class Record
// widget, and any future one) can never drift apart or accidentally build
// an ID containing "/", which Firestore's doc(db, "classRecords", docId)
// would otherwise parse as a path separator instead of a literal character
// -- silently pointing at the wrong nested path, or throwing
// "Invalid document reference" outright depending on how many slashes
// appear. That thrown error is what surfaced as the misleading "Failed to
// load class record. Please check your connection and try again." message
// for subjects like the old combined "EPP / TLE" / "GMRC / Values
// Education" names.
//
// Everything about this format is unchanged from the original getDocId() /
// classRecordDocId() implementations except the added "/" replacement, so
// every subject name that never contained a slash produces the exact same
// ID as before -- no existing Class Record is orphaned by this change.

export function buildClassRecordId({ gradeLevel, section, subject, term, schoolYear }) {
  const raw = `${gradeLevel}_${String(section).trim()}_${subject}_${term}_${String(schoolYear).trim()}`;
  return raw
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/\//g, "-slash-");
}
