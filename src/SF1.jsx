// src/SF1.jsx
// School Form 1 — Learner's Information Sheet (official DepEd register fields).
// Teachers add learners in a table and save the whole class list at once. When a
// grade + section + school year is selected, the page LOADS the existing roster
// (including learners created by the SF1 Bulk Importer) so imported data reflects
// on the page. Printing renders a pixel-exact replica of the official LIS SF1
// School Register via components/SF1PrintView.jsx.

import { useState, useEffect } from "react";
import { Fragment } from "react";
import { Printer, Eye, EyeOff, Save } from "lucide-react";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import useSchoolConfig from "./hooks/useSchoolConfig";
import useAvailableSections from "./hooks/useAvailableSections";
import SF1PrintView from "./components/SF1PrintView";
import useAcademicCalendar from "./hooks/useAcademicCalendar";

// Calculates age from a birth date string (YYYY-MM-DD), as of today.
// The official DepEd age is "as of 1st Friday of June"; the importer pre-computes
// `age` for imported learners, so this is mainly a fallback for hand-entered rows.
function calculateAge(birthDateString) {
  if (!birthDateString) return "";
  const birthDate = new Date(birthDateString);
  if (Number.isNaN(birthDate.getTime())) return "";
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const hasHadBirthdayThisYear =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());
  if (!hasHadBirthdayThisYear) age--;
  return age;
}

// The importer stores sex as "Male"/"Female"; the form and register use M/F.
function sexLetter(sex) {
  const s = String(sex || "").trim().toUpperCase();
  if (s.startsWith("M")) return "M";
  if (s.startsWith("F")) return "F";
  return "";
}

// One empty learner row, used for new rows and as a trailing blank row.
function createBlankLearner() {
  return {
    lrn: "",
    lastName: "",
    firstName: "",
    middleName: "",
    nameExtension: "",
    sex: "",
    birthDate: "",
    learningModality: "Face to Face",
    // Extended SF1 demographic fields (expandable section)
    motherTongue: "",
    ipEthnicGroup: "",
    religion: "",
    houseStreetSitio: "",
    barangay: "",
    municipalityCity: "",
    province: "",
    fathersName: "",
    mothersMaidenName: "",
    guardianName: "",
    guardianRelationship: "",
    contactNumber: "",
    remarks: "",
  };
}

// A row with no LRN, no last name and no first name is just blank filler.
function isBlankLearner(l) {
  return (
    !String(l.lrn || "").trim() &&
    !String(l.lastName || "").trim() &&
    !String(l.firstName || "").trim()
  );
}

// Map a Firestore learner doc (written by the SF1 form OR the Bulk Importer) onto
// the editable table-row shape.
function toFormLearner(id, d) {
  return {
    _id: id,
    lrn: d.lrn ?? "",
    lastName: d.lastName ?? "",
    firstName: d.firstName ?? "",
    middleName: d.middleName ?? "",
    nameExtension: d.nameExtension ?? "",
    sex: sexLetter(d.sex),
    birthDate: d.birthDate ?? "",
    learningModality: d.learningModality || "Face to Face",
    motherTongue: d.motherTongue ?? "",
    ipEthnicGroup: d.ipEthnicGroup ?? "",
    religion: d.religion ?? "",
    houseStreetSitio: d.houseStreetSitio ?? "",
    barangay: d.barangay ?? "",
    municipalityCity: d.municipalityCity ?? "",
    province: d.province ?? "",
    fathersName: d.fathersName ?? d.fatherName ?? "",
    mothersMaidenName: d.mothersMaidenName ?? d.mothersName ?? d.motherName ?? "",
    guardianName: d.guardianName ?? d.guardian ?? "",
    guardianRelationship: d.guardianRelationship ?? "",
    contactNumber: d.contactNumber ?? d.contactNo ?? d.contact ?? "",
    remarks: d.remarks ?? d.remark ?? "",
  };
}

function learnerName(l) {
  const first = [l.firstName, l.nameExtension].filter(Boolean).join(" ");
  const tail = [first, l.middleName].filter(Boolean).join(" ");
  return [l.lastName, tail].filter(Boolean).join(", ");
}

function composeAddress(l) {
  return [l.houseStreetSitio, l.barangay, l.municipalityCity, l.province]
    .filter((x) => x && String(x).trim())
    .join(", ");
}

// Editable fields written back to Firestore for an existing learner (an
// `updateDoc` merge, so enrollment/import metadata is preserved).
function editableFields(l, isSHS, track, cluster, gradeLevel, section, schoolYear) {
  return {
    lrn: String(l.lrn || "").trim(),
    lastName: String(l.lastName || "").trim(),
    firstName: String(l.firstName || "").trim(),
    middleName: String(l.middleName || "").trim(),
    nameExtension: String(l.nameExtension || "").trim(),
    sex: sexLetter(l.sex),
    birthDate: l.birthDate || "",
    age: calculateAge(l.birthDate),
    motherTongue: l.motherTongue || "",
    ipEthnicGroup: l.ipEthnicGroup || "",
    religion: l.religion || "",
    address: composeAddress(l),
    houseStreetSitio: l.houseStreetSitio || "",
    barangay: l.barangay || "",
    municipalityCity: l.municipalityCity || "",
    province: l.province || "",
    fathersName: l.fathersName || "",
    mothersMaidenName: l.mothersMaidenName || "",
    guardianName: l.guardianName || "",
    guardianRelationship: l.guardianRelationship || "",
    contactNumber: l.contactNumber || "",
    learningModality: l.learningModality || "Face to Face",
    remarks: l.remarks || "",
    gradeLevel,
    section,
    schoolYear,
    ...(isSHS ? { track, cluster: track === "techPro" ? cluster : null } : {}),
  };
}

function SF1({ user }) {
  const { config } = useSchoolConfig();
  const { calendar } = useAcademicCalendar();
  const gradeOptions =
    config?.gradeLevelsOffered ||
    ["Grade 4", "Grade 5", "Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10"];
  const [gradeLevel, setGradeLevel] = useState(gradeOptions[0] || "");
  const [section, setSection] = useState("");
  const [schoolYear, setSchoolYear] = useState("2026-2027");
  // DO 017 SHS: one SF1 sheet is one grade+section, so track/cluster are
  // sheet-level (like gradeLevel/section above), not per learner row.
  const isSHS = gradeLevel === "Grade 11" || gradeLevel === "Grade 12";
  const [track, setTrack] = useState("");
  const [cluster, setCluster] = useState("");
  const electiveClusters = config?.shs?.electiveClusters || [];
  const [sectionsRefreshKey, setSectionsRefreshKey] = useState(0);
  const { sections: availableSections } = useAvailableSections(
    gradeLevel,
    schoolYear,
    sectionsRefreshKey
  );
  const [newSection, setNewSection] = useState("");
  const [showNewSection, setShowNewSection] = useState(false);

  const [learners, setLearners] = useState([createBlankLearner()]);
  // Tracks which row indexes are expanded (showing the detail panel).
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [showPrintArea, setShowPrintArea] = useState(false);
  const [loadingClass, setLoadingClass] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Load the existing roster for the selected grade + section + school year so
  // imported (and previously saved) learners reflect on this page.
  useEffect(() => {
    let cancelled = false;

    async function loadClass() {
      if (!gradeLevel.trim() || !schoolYear.trim() || !section.trim()) {
        setLearners([createBlankLearner()]);
        setLoadingClass(false);
        return;
      }
      // The "+ Add new section" box is a brand-new section — nothing to load yet.
      if (showNewSection) {
        setLearners([createBlankLearner()]);
        setLoadingClass(false);
        return;
      }

      setLoadingClass(true);
      try {
        const snapshot = await getDocs(collection(db, "learners"));
        if (cancelled) return;
        const rows = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          if (String(d.gradeLevel || "") !== gradeLevel) return;
          if (String(d.section || "") !== section) return;
          if (String(d.schoolYear || "") !== schoolYear) return;
          rows.push(toFormLearner(docSnap.id, d));
        });
        rows.sort((a, b) =>
          learnerName(a).localeCompare(learnerName(b), undefined, { sensitivity: "base" })
        );
        setLearners([...rows, createBlankLearner()]);
        setExpandedRows(new Set());
        setStatusMessage(rows.length ? `Loaded ${rows.length} learner(s) for ${gradeLevel} - ${section}.` : "");
      } catch (err) {
        console.error("Error loading class roster:", err);
        if (!cancelled) {
          setStatusMessage(
            "Could not load the existing roster for this class. A blank table is shown instead."
          );
          setLearners([createBlankLearner()]);
        }
      } finally {
        if (!cancelled) setLoadingClass(false);
      }
    }

    loadClass();
    return () => {
      cancelled = true;
    };
  }, [gradeLevel, section, schoolYear, showNewSection, reloadKey]);

  // An SF1 bulk import (possibly in another tab) can create a new section or
  // add learners to the currently open class. `SF1Importer` signals this via
  // localStorage so an already-open SF1 page refreshes without a manual reload.
  useEffect(() => {
    function handleRosterChanged(event) {
      if (event.key !== "sf1:rosterChanged") return;
      setReloadKey((k) => k + 1);
      setSectionsRefreshKey((k) => k + 1);
    }
    window.addEventListener("storage", handleRosterChanged);
    return () => window.removeEventListener("storage", handleRosterChanged);
  }, []);

  // Non-blank rows drive the print register and the Print button visibility.
  const nonBlankLearners = learners.filter((l) => !isBlankLearner(l));

  // Live gender tally for the toolbar metrics badge (matches the print view's
  // male-then-female split, then every remaining learner lands under Total).
  const maleCount = nonBlankLearners.filter((l) => sexLetter(l.sex) === "M").length;
  const femaleCount = nonBlankLearners.filter((l) => sexLetter(l.sex) === "F").length;
  const totalCount = nonBlankLearners.length;

  // Human-readable labels for the DO 017 SHS sheet header (track/cluster are
  // stored as codes/ids in the wizard, printed as their display names).
  const trackLabel =
    track === "techPro"
      ? "Tech-Voc (Tech-Pro)"
      : track === "academic"
      ? "Academic"
      : track || "";
  const selectedCluster = electiveClusters.find((c) => c.id === cluster);
  const clusterLabel = selectedCluster?.name || cluster || "";


  // Updates one field in one row, without touching the others.
  function updateLearner(index, field, value) {
    const updated = [...learners];
    updated[index] = { ...updated[index], [field]: value };
    setLearners(updated);
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

  // Checks everything is filled in correctly before saving to Firebase.
  function validateLearners() {
    if (!gradeLevel.trim() || !section.trim()) {
      return "Please fill in Grade Level and Section before saving.";
    }
    const rows = learners.filter((l) => !isBlankLearner(l));
    if (rows.length === 0) return "Add at least one learner before saving.";
    for (let i = 0; i < learners.length; i++) {
      const l = learners[i];
      if (isBlankLearner(l)) continue;
      if (!l.lrn.trim() || !l.lastName.trim() || !l.firstName.trim() || !l.sex || !l.birthDate) {
        return `Row ${i + 1}: LRN, Last Name, First Name, Sex, and Birth Date are all required.`;
      }
      if (!/^\d{12}$/.test(l.lrn.trim())) {
        return `Row ${i + 1}: LRN must be exactly 12 digits.`;
      }
    }
    // Check for duplicate LRNs within this batch.
    const lrns = rows.map((l) => l.lrn.trim());
    if (new Set(lrns).size !== lrns.length) {
      return "Two or more rows have the same LRN. Each learner needs a unique LRN.";
    }
    return null;
  }

  // Saves every non-blank row. Rows loaded from Firestore (they carry an `_id`)
  // are UPDATED in place; brand-new rows are INSERTED. This never duplicates an
  // imported learner when the teacher just edits + saves the roster.
  async function handleSaveAll() {
    const validationError = validateLearners();
    if (validationError) {
      setStatusMessage(validationError);
      return;
    }

    setIsSaving(true);
    setStatusMessage("");

    let created = 0;
    let updated = 0;
    try {
      for (const l of learners) {
        if (isBlankLearner(l)) continue;
        const fields = editableFields(l, isSHS, track, cluster, gradeLevel, section, schoolYear);
        if (l._id) {
          await updateDoc(doc(db, "learners", l._id), fields);
          updated++;
        } else {
          await addDoc(collection(db, "learners"), {
            ...fields,
            addedByTeacherEmail: user.email,
            createdAt: serverTimestamp(),
          });
          created++;
        }
      }
      setShowNewSection(false);
      setStatusMessage(`Saved ${created + updated} learner(s) (${created} new, ${updated} updated).`);
      // Re-load the roster so the freshly saved learners appear on the table.
      setReloadKey((k) => k + 1);
    } catch (error) {
      console.error("Error saving learners:", error);
      setStatusMessage("Something went wrong while saving. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  // Opens the print dialog. The register is mounted first (it may be hidden in
  // live view), then the browser snapshots the page so only .sf1-print-view
  // reaches the printer.
  function handlePrint() {
    setShowPrintArea(true);
    // Let React commit the print view to the DOM before `window.print()` runs.
    setTimeout(() => window.print(), 0);
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-slide-up">
      {/* Print CSS — every piece of LIKHA-SIS screen chrome is hidden so only the
          SF1 replica reaches the printer. The sheet's own styling lives in
          components/SF1PrintView.jsx. */}
      <style>{`
        @media print {
          .no-print,
          nav,
          .sidebar,
          button,
          input:not([type="hidden"]),
          select,
          textarea { display: none !important; }

          /* Anything outside the register is hidden without collapsing the
             layout the print view is positioned against. */
          body * { visibility: hidden !important; }
          .sf1-print-view, .sf1-print-view * { visibility: visible !important; }

          .sf1-print-view {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
        }
      `}</style>

      {/* Action Toolbar — every control is `.no-print` so it never reaches the
          printed register. */}
      <div className="no-print bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-sm font-semibold transition-colors"
        >
          <Printer size={16} />
          Print SF1 Register
        </button>
        <button
          type="button"
          onClick={() => setShowPrintArea((v) => !v)}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          {showPrintArea ? <EyeOff size={16} /> : <Eye size={16} />}
          {showPrintArea ? "Hide Live Preview" : "Toggle Live Preview"}
        </button>
        <button
          type="button"
          onClick={handleSaveAll}
          disabled={isSaving}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Save size={16} />
          {isSaving ? "Saving..." : "Save Roster"}
        </button>
        <div
          className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200"
          role="status"
        >
          <span className="text-blue-600 dark:text-blue-400">Male: {maleCount}</span>
          <span aria-hidden="true">|</span>
          <span className="text-pink-600 dark:text-pink-400">Female: {femaleCount}</span>
          <span aria-hidden="true">|</span>
          <span>Total: {totalCount}</span>
        </div>
      </div>

      {/* Filter / Parameters Bar */}
      <div className="no-print bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
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
            <select
              value={section}
              onChange={(e) => {
                const selected = e.target.value;
                if (selected === "+") {
                  setShowNewSection(true);
                  setNewSection("");
                } else {
                  setSection(selected);
                  setShowNewSection(false);
                }
              }}
              className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors"
            >
              <option value="">Select a section</option>
              {availableSections.map((sec) => (
                <option key={sec} value={sec}>{sec}</option>
              ))}
              <option value="+">+ Add new section...</option>
            </select>
            {showNewSection && (
              <input
                value={newSection}
                onChange={(e) => {
                  setNewSection(e.target.value);
                  setSection(e.target.value);
                }}
                placeholder="Enter section name..."
                className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none mt-2 transition-colors"
              />
            )}
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

        {isSHS && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Track
              </label>
              <select
                value={track}
                onChange={(e) => setTrack(e.target.value)}
                className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors"
              >
                <option value="">Select a track</option>
                <option value="academic">Academic</option>
                <option value="techPro">Tech-Voc (Tech-Pro)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Elective Cluster
              </label>
              <select
                value={cluster}
                onChange={(e) => setCluster(e.target.value)}
                disabled={track !== "techPro"}
                className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">{track === "techPro" ? "Select a cluster" : "N/A (Academic Track)"}</option>
                {electiveClusters.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {loadingClass && (
          <div className="mt-3 text-xs text-primary dark:text-primary-light flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            Loading roster…
          </div>
        )}
      </div>


      {/* Table Container */}
      <div className="no-print bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
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
                <Fragment key={`${learner._id || "new"}-${index}`}>
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
                      {/* Detail panel spanning all data columns */}
                      <td colSpan={9} className="p-4 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex flex-wrap gap-4">

                          {/* Profile section — the SF1 demographic columns. */}
                          <fieldset className="flex-1 min-w-[260px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-lg p-3 shadow-2xs">
                            <legend className="text-xs font-bold text-gray-800 dark:text-gray-200 px-1">Profile</legend>
                            <div className="flex flex-col gap-2 mt-1">
                              <label className="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
                                Mother Tongue
                                <input
                                  className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1.5 text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                                  value={learner.motherTongue}
                                  onChange={(e) => updateLearner(index, "motherTongue", e.target.value)}
                                />
                              </label>
                              <label className="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
                                IP (Ethnic Group)
                                <input
                                  className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1.5 text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                                  value={learner.ipEthnicGroup}
                                  onChange={(e) => updateLearner(index, "ipEthnicGroup", e.target.value)}
                                />
                              </label>
                              <label className="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
                                Religion
                                <input
                                  className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1.5 text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                                  value={learner.religion}
                                  onChange={(e) => updateLearner(index, "religion", e.target.value)}
                                />
                              </label>
                              <label className="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
                                Name Extension (Jr., III, etc.)
                                <input
                                  className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1.5 text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                                  value={learner.nameExtension}
                                  onChange={(e) => updateLearner(index, "nameExtension", e.target.value)}
                                />
                              </label>
                              <label className="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
                                Contact Number of Parent or Guardian
                                <input
                                  className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1.5 text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                                  value={learner.contactNumber}
                                  onChange={(e) => updateLearner(index, "contactNumber", e.target.value)}
                                />
                              </label>
                            </div>
                          </fieldset>

                          {/* Address section */}
                          <fieldset className="flex-1 min-w-[260px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-lg p-3 shadow-2xs">
                            <legend className="text-xs font-bold text-gray-800 dark:text-gray-200 px-1">Address</legend>
                            <div className="flex flex-col gap-2 mt-1">
                              <label className="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
                                House / Street / Sitio / Purok
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
      {/* Status Message */}
      {statusMessage && (
        <div
          className={`no-print animate-fade-in p-3.5 rounded-lg border text-xs font-medium ${
            statusMessage.startsWith("Successfully")
              ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
              : "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300"
          }`}
        >
          {statusMessage}
        </div>
      )}

      {/* Printable School Register (SF1) — pixel-exact replica of the official
          DepEd sheet, rendered straight to the printer. */}
      {showPrintArea && (
        <SF1PrintView
          learners={learners.filter((l) => !isBlankLearner(l))}
          bosyDate={calendar?.[schoolYear]?.terms?.[0]?.startDate || ""}
          eosyDate={calendar?.[schoolYear]?.terms?.slice(-1)[0]?.endDate || ""}
          school={{
            schoolId: config.schoolId || "",
            schoolName: config.schoolName || "",
            region: config.region || "",
            division: config.divisionOffice || config.divisionName || "",
            district: config.district || "",
            schoolYear,
            gradeLevel,
            section,
            // DO 017 SHS sheet-level parameters, printed only when selected.
            track: trackLabel,
            cluster: clusterLabel,
          }}
          preparedBy={config.adviserName || user?.displayName || user?.email || "[Class Adviser Name]"}
          certifiedBy={config.principalName || config.schoolHeadName || "[School Head Name]"}
        />
      )}
    </div>
  );
}

export default SF1;

