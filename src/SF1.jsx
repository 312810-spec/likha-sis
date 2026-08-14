// src/SF1.jsx
// School Form 1 — Learner's Information Sheet (core fields version).
// Teachers can add multiple learners in a table, then save the whole class list at once.

import { useState } from "react";
import { Fragment } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import useSchoolConfig from "./hooks/useSchoolConfig";

// Calculates age from a birth date string (YYYY-MM-DD), as of today.
// Note: official DepEd age is "as of 1st Friday of June" — we're using today's date
// as a simple starting point; we can refine this exact rule later if needed.
function calculateAge(birthDateString) {
  if (!birthDateString) return "";
  const birthDate = new Date(birthDateString);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const hasHadBirthdayThisYear =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());
  if (!hasHadBirthdayThisYear) age--;
  return age;
}

// One empty learner row, used whenever we add a new blank row to the table.
function createBlankLearner() {
  return {
    lrn: "",
    lastName: "",
    firstName: "",
    middleName: "",
    sex: "",
    birthDate: "",
    learningModality: "Face to Face",
    // Extended fields for learner details (expandable section)
    houseStreetSitio: "",
    barangay: "",
    municipalityCity: "",
    province: "",
    fathersName: "",
    mothersMaidenName: "",
    guardianName: "",
    guardianRelationship: "",
    remarks: "",
  };
}

function SF1({ user, goBack }) {
  const { config } = useSchoolConfig();
  const gradeOptions = config?.gradeLevelsOffered || ["Grade 4", "Grade 5", "Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10"];
  const [gradeLevel, setGradeLevel] = useState(gradeOptions[0] || "");
  const [section, setSection] = useState("");
  const [schoolYear, setSchoolYear] = useState("2026-2027");
  const [learners, setLearners] = useState([createBlankLearner()]);
  // Tracks which row indexes are expanded (showing detail panel).
  // Using a Set for O(1) lookup when rendering.
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  // Updates one field in one row, without touching the others.
  function updateLearner(index, field, value) {
    const updated = [...learners];
    updated[index] = { ...updated[index], [field]: value };
    setLearners(updated);
  }

  function addRow() {
    setLearners([...learners, createBlankLearner()]);
  }

  function removeRow(index) {
    setLearners(learners.filter((_, i) => i !== index));
  }

  // Toggles the expanded detail panel for a given row index.
  function toggleExpand(index) {
    const next = new Set(expandedRows);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    setExpandedRows(next);
  }

  // Checks everything is filled in correctly before we try saving to Firebase.
  function validateLearners() {
    if (!gradeLevel.trim() || !section.trim()) {
      return "Please fill in Grade Level and Section before saving.";
    }
    for (let i = 0; i < learners.length; i++) {
      const l = learners[i];
      if (!l.lrn.trim() || !l.lastName.trim() || !l.firstName.trim() || !l.sex || !l.birthDate) {
        return `Row ${i + 1}: LRN, Last Name, First Name, Sex, and Birth Date are all required.`;
      }
      if (!/^\d{12}$/.test(l.lrn.trim())) {
        return `Row ${i + 1}: LRN must be exactly 12 digits.`;
      }
    }
    // Check for duplicate LRNs within this batch
    const lrns = learners.map((l) => l.lrn.trim());
    const hasDuplicates = new Set(lrns).size !== lrns.length;
    if (hasDuplicates) {
      return "Two or more rows have the same LRN. Each learner needs a unique LRN.";
    }
    return null; // no errors
  }

  async function handleSaveAll() {
    const validationError = validateLearners();
    if (validationError) {
      setStatusMessage(validationError);
      return;
    }

    setIsSaving(true);
    setStatusMessage("");

    try {
      // Save each learner as its own document in the "learners" collection.
      for (const learner of learners) {
        await addDoc(collection(db, "learners"), {
          ...learner,
          age: calculateAge(learner.birthDate),
          gradeLevel,
          section,
          schoolYear,
          addedByTeacherEmail: user.email,
          createdAt: serverTimestamp(), // Firebase stamps the exact save time automatically
        });
      }
      setStatusMessage(`Successfully saved ${learners.length} learner(s)!`);
      setLearners([createBlankLearner()]); // reset the table after a successful save
    } catch (error) {
      console.error("Error saving learners:", error);
      setStatusMessage("Something went wrong while saving. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-slide-up">
      {/* Header Bar */}
      <div className="bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
        {goBack && (
          <button
            onClick={goBack}
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-primary-light font-medium mb-2 transition-colors duration-150"
            type="button"
          >
            ← Back to Dashboard
          </button>
        )}
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
          School Form 1 — Learner&apos;s Information Sheet
        </h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Master list of learners enrolled in the class with DepEd SF1 standard demographic details
        </p>
      </div>

      {/* Filter / Parameters Bar */}
      <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Grade Level
            </label>
            <select
              value={gradeLevel}
              onChange={(e) => setGradeLevel(e.target.value)}
              className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors"
            >
              {gradeOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Section
            </label>
            <input
              value={section}
              onChange={(e) => setSection(e.target.value)}
              placeholder="e.g. Kindness"
              className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              School Year
            </label>
            <input
              value={schoolYear}
              onChange={(e) => setSchoolYear(e.target.value)}
              placeholder="e.g. 2026-2027"
              className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-primary/5 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 font-semibold sticky top-0 z-10">
                <th className="p-2.5 text-center w-10">▼</th>
                <th className="p-2.5 min-w-[130px]">LRN (12 digits)</th>
                <th className="p-2.5 min-w-[120px]">Last Name</th>
                <th className="p-2.5 min-w-[120px]">First Name</th>
                <th className="p-2.5 min-w-[120px]">Middle Name</th>
                <th className="p-2.5 w-16 text-center">Sex</th>
                <th className="p-2.5 min-w-[130px]">Birth Date</th>
                <th className="p-2.5 w-12 text-center">Age</th>
                <th className="p-2.5 min-w-[130px]">Learning Modality</th>
                <th className="p-2.5 w-10 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 text-gray-800 dark:text-gray-200">
              {learners.map((learner, index) => (
                <Fragment key={index}>
                  {/* Main learner row */}
                  <tr className="hover:bg-primary/5 dark:hover:bg-gray-800/50 transition-colors duration-150">
                    {/* Expand/collapse toggle button — first column */}
                    <td className="p-2 text-center border-r border-gray-200 dark:border-gray-700">
                      <button
                        type="button"
                        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs transition-colors duration-150 active:scale-[0.98] transition-transform"
                        onClick={() => toggleExpand(index)}
                        aria-label={expandedRows.has(index) ? "Collapse details" : "Expand details"}
                      >
                        {expandedRows.has(index) ? "▼" : "▶"}
                      </button>
                    </td>
                    <td className="p-2 border-r border-gray-200 dark:border-gray-700">
                      <input
                        className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1 text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                        value={learner.lrn}
                        maxLength={12}
                        placeholder="12-digit LRN"
                        onChange={(e) => updateLearner(index, "lrn", e.target.value.replace(/\D/g, ""))}
                      />
                    </td>
                    <td className="p-2 border-r border-gray-200 dark:border-gray-700">
                      <input
                        className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1 text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                        value={learner.lastName}
                        placeholder="Last Name"
                        onChange={(e) => updateLearner(index, "lastName", e.target.value)}
                      />
                    </td>
                    <td className="p-2 border-r border-gray-200 dark:border-gray-700">
                      <input
                        className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1 text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                        value={learner.firstName}
                        placeholder="First Name"
                        onChange={(e) => updateLearner(index, "firstName", e.target.value)}
                      />
                    </td>
                    <td className="p-2 border-r border-gray-200 dark:border-gray-700">
                      <input
                        className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1 text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                        value={learner.middleName}
                        placeholder="Middle Name"
                        onChange={(e) => updateLearner(index, "middleName", e.target.value)}
                      />
                    </td>
                    <td className="p-2 border-r border-gray-200 dark:border-gray-700 text-center">
                      <select
                        className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-1 py-1 text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                        value={learner.sex}
                        onChange={(e) => updateLearner(index, "sex", e.target.value)}
                      >
                        <option value="">--</option>
                        <option value="M">M</option>
                        <option value="F">F</option>
                      </select>
                    </td>
                    <td className="p-2 border-r border-gray-200 dark:border-gray-700">
                      <input
                        className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1 text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                        type="date"
                        value={learner.birthDate}
                        onChange={(e) => updateLearner(index, "birthDate", e.target.value)}
                      />
                    </td>
                    <td className="p-2 border-r border-gray-200 dark:border-gray-700 text-center font-mono font-medium text-gray-700 dark:text-gray-300">
                      {calculateAge(learner.birthDate)}
                    </td>
                    <td className="p-2 border-r border-gray-200 dark:border-gray-700">
                      <select
                        className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-1 py-1 text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                        value={learner.learningModality}
                        onChange={(e) => updateLearner(index, "learningModality", e.target.value)}
                      >
                        <option>Face to Face</option>
                        <option>Blended</option>
                        <option>Online</option>
                        <option>Modular</option>
                      </select>
                    </td>
                    <td className="p-2 text-center">
                      <button
                        type="button"
                        onClick={() => removeRow(index)}
                        disabled={learners.length === 1}
                        className="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 disabled:opacity-30 transition-colors duration-150 active:scale-[0.98] transition-transform"
                        title="Remove row"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>

                  {/* Expandable detail panel row — shown when row is expanded */}
                  {expandedRows.has(index) && (
                    <tr className="bg-primary/5 dark:bg-gray-800/40">
                      {/* Empty cell for the expand column */}
                      <td className="p-2 border-r border-gray-200 dark:border-gray-700"></td>
                      {/* Detail panel spanning all data columns (colSpan=9 covers LRN through Actions) */}
                      <td colSpan={9} className="p-4 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex flex-wrap gap-4">

                          {/* Address section */}
                          <fieldset className="flex-1 min-w-[280px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-lg p-3 shadow-2xs">
                            <legend className="text-xs font-bold text-gray-800 dark:text-gray-200 px-1">Address</legend>
                            <div className="flex flex-col gap-2 mt-1">
                              <label className="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
                                House / Street / Sitio
                                <input
                                  className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1.5 text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                                  value={learner.houseStreetSitio}
                                  onChange={(e) => updateLearner(index, "houseStreetSitio", e.target.value)}
                                />
                              </label>
                              <label className="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
                                Barangay
                                <input
                                  className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1.5 text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                                  value={learner.barangay}
                                  onChange={(e) => updateLearner(index, "barangay", e.target.value)}
                                />
                              </label>
                              <label className="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
                                Municipality / City
                                <input
                                  className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1.5 text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                                  value={learner.municipalityCity}
                                  onChange={(e) => updateLearner(index, "municipalityCity", e.target.value)}
                                />
                              </label>
                              <label className="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
                                Province
                                <input
                                  className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1.5 text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                                  value={learner.province}
                                  onChange={(e) => updateLearner(index, "province", e.target.value)}
                                />
                              </label>
                            </div>
                          </fieldset>

                          {/* Parents section */}
                          <fieldset className="flex-1 min-w-[260px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-lg p-3 shadow-2xs">
                            <legend className="text-xs font-bold text-gray-800 dark:text-gray-200 px-1">Parents</legend>
                            <div className="flex flex-col gap-2 mt-1">
                              <label className="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
                                Father&apos;s Name
                                <input
                                  className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1.5 text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                                  value={learner.fathersName}
                                  onChange={(e) => updateLearner(index, "fathersName", e.target.value)}
                                />
                              </label>
                              <label className="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
                                Mother&apos;s Maiden Name
                                <input
                                  className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1.5 text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                                  value={learner.mothersMaidenName}
                                  onChange={(e) => updateLearner(index, "mothersMaidenName", e.target.value)}
                                />
                              </label>
                            </div>
                          </fieldset>

                          {/* Guardian section */}
                          <fieldset className="flex-1 min-w-[260px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-lg p-3 shadow-2xs">
                            <legend className="text-xs font-bold text-gray-800 dark:text-gray-200 px-1">Guardian (if not parent)</legend>
                            <div className="flex flex-col gap-2 mt-1">
                              <label className="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
                                Guardian Name
                                <input
                                  className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1.5 text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                                  value={learner.guardianName}
                                  onChange={(e) => updateLearner(index, "guardianName", e.target.value)}
                                />
                              </label>
                              <label className="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
                                Relationship to Learner
                                <input
                                  className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1.5 text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                                  value={learner.guardianRelationship}
                                  onChange={(e) => updateLearner(index, "guardianRelationship", e.target.value)}
                                />
                              </label>
                            </div>
                          </fieldset>

                          {/* Remarks section */}
                          <fieldset className="flex-1 min-w-[260px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-lg p-3 shadow-2xs">
                            <legend className="text-xs font-bold text-gray-800 dark:text-gray-200 px-1">Remarks</legend>
                            <div className="flex flex-col gap-2 mt-1">
                              <label className="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
                                Remarks (indicator codes, notes, etc.)
                                <textarea
                                  className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1.5 text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none min-h-[60px] resize-y"
                                  value={learner.remarks}
                                  onChange={(e) => updateLearner(index, "remarks", e.target.value)}
                                />
                              </label>
                            </div>
                          </fieldset>

                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={addRow}
          className="px-4 py-2 text-xs font-semibold text-primary dark:text-primary-light bg-primary/10 hover:bg-primary/20 dark:bg-primary/20 dark:hover:bg-primary/30 border border-primary/20 rounded-lg transition-colors duration-150 active:scale-[0.98] transition-transform"
        >
          + Add Learner Row
        </button>
        <button
          type="button"
          onClick={handleSaveAll}
          disabled={isSaving}
          className="px-4 py-2 text-xs font-semibold text-white bg-primary hover:bg-primary-dark rounded-lg shadow-sm disabled:opacity-50 transition-colors duration-150 active:scale-[0.98] transition-transform"
        >
          {isSaving ? "Saving..." : "Save All to Database"}
        </button>
      </div>

      {/* Status Message */}
      {statusMessage && (
        <div
          className={`animate-fade-in p-3.5 rounded-lg border text-xs font-medium ${
            statusMessage.startsWith("Successfully")
              ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
              : "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300"
          }`}
        >
          {statusMessage}
        </div>
      )}
    </div>
  );
}

export default SF1;