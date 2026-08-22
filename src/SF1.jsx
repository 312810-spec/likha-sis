// src/SF1.jsx
// School Form 1 — Learner's Information Sheet (official DepEd register fields).
//
// Default view is the LIVE REGISTER: the official SF1 sheet, always on screen,
// no button needed to reveal it. Editing lives behind its own "Edit Learner
// Records" screen (see components/sf1/SF1LearnerList.jsx and
// SF1LearnerEditor.jsx) so a teacher never lands inside a dense spreadsheet by
// accident. Printing renders the exact same official register replica via
// components/SF1PrintView.jsx — screen and print never drift apart.

import { useState, useEffect, useRef } from "react";
import { Printer, Save, ArrowLeft, ClipboardList, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import useSchoolConfig from "./hooks/useSchoolConfig";
import useAvailableSections from "./hooks/useAvailableSections";
import useTeacherScope from "./hooks/useTeacherScope";
import useAcademicCalendar from "./hooks/useAcademicCalendar";
import SF1PrintView from "./components/SF1PrintView";
import SF1LearnerList from "./components/sf1/SF1LearnerList";
import SF1LearnerEditor from "./components/sf1/SF1LearnerEditor";
import { calculateSf1Age } from "./utils/sf1Age.js";
import { getSf1RecordIssues, needsSexAssignment } from "./utils/sf1RecordQuality.js";
import { computeFitScale, SF1_SHEET_NATURAL_WIDTH_PX } from "./utils/sf1FitScale.js";

const REQUIRED_SCHOOL_SETTINGS = [
  { key: "schoolId", label: "School ID" },
  { key: "schoolName", label: "School Name" },
  { key: "region", label: "Region" },
  { key: "divisionOffice", label: "Division" },
  { key: "principalName", label: "Principal / School Head" },
];

// The importer stores sex as "Male"/"Female"; the form and register use M/F.
function sexLetter(sex) {
  const s = String(sex || "").trim().toUpperCase();
  if (s.startsWith("M")) return "M";
  if (s.startsWith("F")) return "F";
  return "";
}

// One empty learner, seeded for a brand-new Add Male/Female Learner entry.
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

// A row with no LRN, no last name and no first name is just blank filler --
// kept as a defensive filter even though the editor no longer creates these.
function isBlankLearner(l) {
  return (
    !String(l.lrn || "").trim() &&
    !String(l.lastName || "").trim() &&
    !String(l.firstName || "").trim()
  );
}

// Map a Firestore learner doc (written by the SF1 editor OR the Bulk Importer)
// onto the editable shape.
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

function hasValue(...vals) {
  return vals.some((v) => String(v || "").trim());
}

// Editable fields written back to Firestore for a learner (an `updateDoc`
// merge, so enrollment/import metadata is preserved).
function editableFields(l, isSHS, track, cluster, gradeLevel, section, schoolYear) {
  return {
    lrn: String(l.lrn || "").trim(),
    lastName: String(l.lastName || "").trim(),
    firstName: String(l.firstName || "").trim(),
    middleName: String(l.middleName || "").trim(),
    nameExtension: String(l.nameExtension || "").trim(),
    sex: sexLetter(l.sex),
    birthDate: l.birthDate || "",
    age: calculateSf1Age(l.birthDate, schoolYear),
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
  const { calendar, schoolYears } = useAcademicCalendar();
  const gradeOptions =
    config?.gradeLevelsOffered ||
    ["Grade 4", "Grade 5", "Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10"];
  const [gradeLevelChoice, setGradeLevel] = useState(gradeOptions[0] || "");
  // useSchoolConfig() resolves asynchronously, so gradeLevelChoice above is
  // seeded from the fallback grade list before the real (possibly narrower)
  // gradeLevelsOffered loads. Deriving the effective value at render time
  // (rather than syncing it back via an effect) keeps it always valid.
  const gradeLevel = gradeOptions.includes(gradeLevelChoice)
    ? gradeLevelChoice
    : gradeOptions[0] || "";
  const [section, setSection] = useState("");
  const [schoolYear, setSchoolYear] = useState("2026-2027");
  const yearOptions = schoolYears.includes(schoolYear) ? schoolYears : [schoolYear, ...schoolYears];

  // An assigned adviser is hard-locked to their own advisory section on
  // SF1 -- never exposed to another section via the grade/section pickers.
  const { adviser, roles, profile, loading: scopeLoading } = useTeacherScope(user, schoolYear);
  const isAdviserRole = roles.includes("adviser");
  const isIctCoordinator = roles.includes("ictCoordinator");
  useEffect(() => {
    if (!adviser || (gradeLevelChoice === adviser.gradeLevel && section === adviser.section)) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGradeLevel(adviser.gradeLevel);
    setSection(adviser.section);
  }, [adviser, gradeLevelChoice, section]);

  // DO 017 SHS: one SF1 sheet is one grade+section, so track/cluster are
  // sheet-level, not per learner.
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

  const [learners, setLearners] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [loadingClass, setLoadingClass] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // "live" shows the official register; "edit" shows the learner list/editor.
  const [pageMode, setPageMode] = useState("live");
  // SF1 Record Check starts collapsed -- only the compact totals show by
  // default so the Live Register stays the main content on the page.
  const [recordCheckOpen, setRecordCheckOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  // null | { mode: "existing", index, focusField? } | { mode: "new", sex }
  const [editorState, setEditorState] = useState(null);
  const returnFocusRef = useRef(null);

  const [fitMode, setFitMode] = useState("fit");
  const previewContainerRef = useRef(null);
  const [previewWidth, setPreviewWidth] = useState(0);
  useEffect(() => {
    const el = previewContainerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      setPreviewWidth(entries[0]?.contentRect?.width || 0);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [pageMode]);
  const fitScale = fitMode === "actual" ? 1 : computeFitScale(previewWidth, SF1_SHEET_NATURAL_WIDTH_PX);

  // Load the existing roster for the selected grade + section + school year so
  // imported (and previously saved) learners reflect on this page.
  useEffect(() => {
    let cancelled = false;

    async function loadClass() {
      if (!gradeLevel.trim() || !schoolYear.trim() || !section.trim()) {
        setLearners([]);
        setLoadingClass(false);
        return;
      }
      if (showNewSection) {
        setLearners([]);
        setLoadingClass(false);
        return;
      }

      setLoadingClass(true);
      try {
        const snapshot = await getDocs(
          query(
            collection(db, "learners"),
            where("gradeLevel", "==", gradeLevel),
            where("section", "==", section),
            where("schoolYear", "==", schoolYear)
          )
        );
        if (cancelled) return;
        const rows = [];
        snapshot.forEach((docSnap) => {
          rows.push(toFormLearner(docSnap.id, docSnap.data()));
        });
        rows.sort((a, b) =>
          learnerName(a).localeCompare(learnerName(b), undefined, { sensitivity: "base" })
        );
        setLearners(rows);
        setIsDirty(false);
        setStatusMessage("");
      } catch (err) {
        console.error("Error loading class roster:", err);
        if (!cancelled) {
          setStatusMessage(
            "Could not load the existing roster for this class. A blank list is shown instead."
          );
          setLearners([]);
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
  // add learners to the currently open class.
  useEffect(() => {
    function handleRosterChanged(event) {
      if (event.key !== "sf1:rosterChanged") return;
      setReloadKey((k) => k + 1);
      setSectionsRefreshKey((k) => k + 1);
    }
    window.addEventListener("storage", handleRosterChanged);
    return () => window.removeEventListener("storage", handleRosterChanged);
  }, []);

  const learnerEntries = learners.map((learner, index) => ({ learner, index }));
  const nonBlankEntries = learnerEntries.filter(({ learner: l }) => !isBlankLearner(l));
  const byName = (a, b) => learnerName(a.learner).localeCompare(learnerName(b.learner));
  const maleEntries = nonBlankEntries.filter(({ learner: l }) => sexLetter(l.sex) === "M").sort(byName);
  const femaleEntries = nonBlankEntries.filter(({ learner: l }) => sexLetter(l.sex) === "F").sort(byName);
  const unresolvedSexEntries = nonBlankEntries.filter(({ learner: l }) => needsSexAssignment(l));

  const maleCount = maleEntries.length;
  const femaleCount = femaleEntries.length;
  const totalCount = nonBlankEntries.length;
  const hasUnresolvedSex = unresolvedSexEntries.length > 0;

  // Record Check: grade-aware completeness, per learner, index-aware so the
  // "Fix" action can jump the editor straight to that learner/field.
  const recordCheckEntries = nonBlankEntries.map(({ learner: l, index }) => ({
    index,
    learner: l,
    issues: getSf1RecordIssues(l, gradeLevel),
    missingSex: needsSexAssignment(l),
  }));
  const completeCount = recordCheckEntries.filter((e) => e.issues.length === 0 && !e.missingSex).length;
  const needAttentionEntries = recordCheckEntries.filter((e) => e.issues.length > 0 || e.missingSex);
  const fieldIssueEntries = needAttentionEntries.filter((e) => e.issues.length > 0);

  const missingSchoolSettings = REQUIRED_SCHOOL_SETTINGS.filter((f) => {
    if (f.key === "divisionOffice") return !hasValue(config.divisionOffice, config.divisionName);
    return !hasValue(config[f.key]);
  });

  const trackLabel =
    track === "techPro" ? "Tech-Voc (Tech-Pro)" : track === "academic" ? "Academic" : track || "";
  const selectedCluster = electiveClusters.find((c) => c.id === cluster);
  const clusterLabel = selectedCluster?.name || cluster || "";

  const preparedBy = adviser
    ? profile?.fullName || user?.displayName || user?.email || "[Class Adviser Name]"
    : config.adviserName || user?.displayName || user?.email || "[Class Adviser Name]";
  const certifiedBy = config.principalName || config.schoolHeadName || "[School Head Name]";

  function openEditor(nextState, triggerEl) {
    returnFocusRef.current = triggerEl || document.activeElement;
    setEditorState(nextState);
  }

  function handleAddLearner(sex) {
    setPageMode("edit");
    openEditor({ mode: "new", sex });
  }

  function handleEditLearner(index, focusField) {
    openEditor({ mode: "existing", index, focusField });
  }

  function handleFixLearner(index, focusField) {
    setPageMode("edit");
    openEditor({ mode: "existing", index, focusField });
  }

  function handleQuickSex(index, sex) {
    setLearners((prev) => prev.map((l, i) => (i === index ? { ...l, sex } : l)));
    setIsDirty(true);
  }

  function handleEditorSave(draftLearner) {
    if (editorState.mode === "new") {
      setLearners((prev) => [...prev, draftLearner]);
    } else {
      setLearners((prev) => prev.map((l, i) => (i === editorState.index ? { ...l, ...draftLearner } : l)));
    }
    setIsDirty(true);
    setEditorState(null);
  }

  function handleEditorRemove() {
    if (editorState.mode === "existing") {
      setLearners((prev) => prev.filter((_, i) => i !== editorState.index));
      setIsDirty(true);
    }
    setEditorState(null);
  }

  function handleBackToLiveRegister() {
    if (isDirty) {
      setShowLeaveConfirm(true);
      return;
    }
    setPageMode("live");
  }

  function confirmLeaveWithoutSaving() {
    setReloadKey((k) => k + 1);
    setIsDirty(false);
    setShowLeaveConfirm(false);
    setPageMode("live");
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
        return `${learnerName(l) || `Row ${i + 1}`}: LRN, Last Name, First Name, Sex, and Birth Date are all required.`;
      }
      if (!/^\d{12}$/.test(l.lrn.trim())) {
        return `${learnerName(l)}: LRN must be exactly 12 digits.`;
      }
    }
    const lrns = rows.map((l) => l.lrn.trim());
    if (new Set(lrns).size !== lrns.length) {
      return "Two or more learners have the same LRN. Each learner needs a unique LRN.";
    }
    return null;
  }

  // Saves every learner. Rows loaded from Firestore (they carry an `_id`) are
  // UPDATED in place; brand-new rows are INSERTED.
  async function handleSaveAll() {
    if (adviser && (gradeLevel !== adviser.gradeLevel || section !== adviser.section)) {
      setStatusMessage("You may only edit your own advisory section.");
      return;
    }
    const validationError = validateLearners();
    if (validationError) {
      setStatusMessage(validationError);
      return;
    }

    setIsSaving(true);
    setStatusMessage("");

    try {
      for (const l of learners) {
        if (isBlankLearner(l)) continue;
        const fields = editableFields(l, isSHS, track, cluster, gradeLevel, section, schoolYear);
        if (l._id) {
          await updateDoc(doc(db, "learners", l._id), fields);
        } else {
          await addDoc(collection(db, "learners"), {
            ...fields,
            addedByTeacherEmail: user.email,
            createdAt: serverTimestamp(),
          });
        }
      }
      setShowNewSection(false);
      setIsDirty(false);
      setStatusMessage("Learner records saved.");
      setReloadKey((k) => k + 1);
    } catch (error) {
      console.error("Error saving learners:", error);
      setStatusMessage("Something went wrong while saving. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  function handlePrint() {
    if (hasUnresolvedSex) return;
    window.print();
  }

  if (isAdviserRole && !scopeLoading && !adviser) {
    return (
      <div className="max-w-lg mx-auto mt-12 text-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-6">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
          No advisory class is assigned to your account. Please contact the ICT Coordinator.
        </p>
      </div>
    );
  }

  const printableLearners = learners
    .filter((l) => !isBlankLearner(l))
    .map((l) => ({ ...l, age: calculateSf1Age(l.birthDate, schoolYear) || l.age || "" }));

  const printViewProps = {
    learners: printableLearners,
    bosyDate: calendar?.[schoolYear]?.terms?.[0]?.startDate || "",
    eosyDate: calendar?.[schoolYear]?.terms?.slice(-1)[0]?.endDate || "",
    generatedOn: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    school: {
      schoolId: config.schoolId || "",
      schoolName: config.schoolName || "",
      region: config.region || "",
      division: config.divisionOffice || config.divisionName || "",
      district: config.district || "",
      schoolYear,
      gradeLevel,
      section,
      track: trackLabel,
      cluster: clusterLabel,
    },
    preparedBy,
    certifiedBy,
  };

  return (
    <div className="space-y-6 max-w-none w-full">
      {/* Print CSS — every piece of LIKHA-SIS screen chrome is hidden so only
          the SF1 replica reaches the printer. The sheet's own geometry and
          colours (including .sf1-print-view's own positioning) live entirely
          in components/SF1PrintView.jsx -- this file only hides chrome the
          print view has no knowledge of (nav/sidebar/buttons/inputs). */}
      <style>{`
        @media print {
          .no-print,
          nav,
          .sidebar,
          button,
          input:not([type="hidden"]),
          select,
          textarea { display: none !important; }

          body * { visibility: hidden !important; }
          .sf1-print-view, .sf1-print-view * { visibility: visible !important; }

          /* The Fit to Screen preview zoom is a screen-only convenience --
             print always renders the register at true, official size. */
          .sf1-fit-wrapper { zoom: 1 !important; }
        }
      `}</style>

      {statusMessage && (
        <div
          className={`no-print animate-fade-in p-3.5 rounded-lg border text-sm font-medium ${
            statusMessage === "Learner records saved."
              ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
              : "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300"
          }`}
        >
          {statusMessage}
        </div>
      )}

      {pageMode === "live" ? (
        <>
          {/* Summary card */}
          <div className="no-print bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {adviser ? (
                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Advisory Class
                  </label>
                  <div className="w-full text-base rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2.5">
                    {adviser.gradeLevel} — {adviser.section}
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Grade Level
                    </label>
                    <select
                      value={gradeLevel}
                      onChange={(e) => setGradeLevel(e.target.value)}
                      className="w-full text-base rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors"
                    >
                      {gradeOptions.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
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
                      className="w-full text-base rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors"
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
                        className="w-full text-base rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none mt-2 transition-colors"
                      />
                    )}
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  School Year
                </label>
                <select
                  value={schoolYear}
                  onChange={(e) => setSchoolYear(e.target.value)}
                  className="w-full text-base rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors"
                >
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            </div>

            {isSHS && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Track
                  </label>
                  <select
                    value={track}
                    onChange={(e) => setTrack(e.target.value)}
                    className="w-full text-base rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors"
                  >
                    <option value="">Select a track</option>
                    <option value="academic">Academic</option>
                    <option value="techPro">Tech-Voc (Tech-Pro)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Elective Cluster
                  </label>
                  <select
                    value={cluster}
                    onChange={(e) => setCluster(e.target.value)}
                    disabled={track !== "techPro"}
                    className="w-full text-base rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
              <div className="text-sm text-primary dark:text-primary-light flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                Loading roster…
              </div>
            )}

            <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-gray-200 dark:border-gray-700">
              <div className="inline-flex items-center gap-2 text-sm font-semibold px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200" role="status">
                <span className="text-blue-600 dark:text-blue-400">Male: {maleCount}</span>
                <span aria-hidden="true">|</span>
                <span className="text-pink-600 dark:text-pink-400">Female: {femaleCount}</span>
                <span aria-hidden="true">|</span>
                <span>Total: {totalCount}</span>
              </div>
              <div className="ml-auto flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPageMode("edit")}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors min-h-[44px]"
                >
                  Edit Learner Records
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  disabled={hasUnresolvedSex}
                  title={hasUnresolvedSex ? "Resolve the learners needing Male/Female information before printing." : undefined}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-sm font-semibold transition-colors min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Printer size={16} />
                  Print SF1
                </button>
              </div>
            </div>
          </div>

          {/* SF1 Record Check */}
          <div className="no-print bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="flex items-center gap-2 mb-1.5">
              <ClipboardList size={18} className="text-primary dark:text-primary-light" />
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">SF1 Record Check</h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {totalCount} Learner{totalCount === 1 ? "" : "s"} · {completeCount} Complete · {needAttentionEntries.length} Need Attention
            </p>

            {hasUnresolvedSex && (
              <p className="mt-2 text-sm font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <AlertTriangle size={15} />
                {unresolvedSexEntries.length} learner{unresolvedSexEntries.length === 1 ? "" : "s"} need Male/Female information before SF1 can be finalized. Go to Edit Learner Records to fix.
              </p>
            )}

            {needAttentionEntries.length > 0 && (
              <button
                type="button"
                onClick={() => setRecordCheckOpen((open) => !open)}
                aria-expanded={recordCheckOpen}
                aria-controls="sf1-record-check-details"
                className="mt-3 w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors min-h-[44px]"
              >
                {recordCheckOpen ? "Hide Details" : "Show Details"}
                {recordCheckOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            )}

            <div id="sf1-record-check-details">
              {recordCheckOpen && fieldIssueEntries.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {fieldIssueEntries.map(({ index, learner, issues }) => (
                    <li key={index} className="flex flex-wrap items-center justify-between gap-2 text-sm rounded-lg bg-gray-50 dark:bg-gray-800 px-3 py-2">
                      <span className="text-gray-800 dark:text-gray-200">
                        <span className="font-semibold">{learnerName(learner) || "(No name entered)"}</span>
                        {" — "}
                        {issues.map((i) => i.label).join(", ")}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleFixLearner(index, issues[0].field)}
                        className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-700 transition-colors min-h-[36px]"
                      >
                        Fix
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {missingSchoolSettings.length > 0 && (
            <div className="no-print rounded-xl border-2 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-4">
              <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                <AlertTriangle size={16} />
                SF1 Setup Needs Attention
              </h3>
              <p className="text-sm text-amber-800 dark:text-amber-300 mt-1.5">Missing:</p>
              <ul className="mt-1 space-y-0.5">
                {missingSchoolSettings.map((f) => (
                  <li key={f.key} className="text-sm text-amber-800 dark:text-amber-300">• {f.label}</li>
                ))}
              </ul>
              <p className="text-sm text-amber-800 dark:text-amber-300 mt-2">
                {isIctCoordinator
                  ? "Update these in School Settings before printing."
                  : "Please contact the ICT Coordinator."}
              </p>
            </div>
          )}

          {/* Live Register preview */}
          <div className="no-print flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setFitMode("fit")}
              aria-pressed={fitMode === "fit"}
              className={`px-3.5 py-2 rounded-lg text-sm font-semibold border transition-colors min-h-[44px] ${
                fitMode === "fit"
                  ? "bg-primary text-white border-primary"
                  : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              Fit to Screen
            </button>
            <button
              type="button"
              onClick={() => setFitMode("actual")}
              aria-pressed={fitMode === "actual"}
              className={`px-3.5 py-2 rounded-lg text-sm font-semibold border transition-colors min-h-[44px] ${
                fitMode === "actual"
                  ? "bg-primary text-white border-primary"
                  : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              Actual Size
            </button>
          </div>
          <div ref={previewContainerRef} className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-x-auto bg-gray-50 dark:bg-gray-950 p-3">
            <div className="sf1-fit-wrapper" style={{ zoom: fitScale }}>
              <SF1PrintView {...printViewProps} />
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Edit Mode */}
          <div className="no-print bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Edit SF1 Learners</h2>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5">
                {gradeLevel} — {section || "No section selected"} · SY {schoolYear}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleBackToLiveRegister}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors min-h-[44px]"
              >
                <ArrowLeft size={16} />
                Back to Live Register
              </button>
              <button
                type="button"
                onClick={handleSaveAll}
                disabled={isSaving}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-sm font-semibold transition-colors min-h-[44px] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Save size={16} />
                {isSaving ? "Saving…" : "Save Learner Records"}
              </button>
            </div>
          </div>

          <SF1LearnerList
            males={maleEntries}
            females={femaleEntries}
            unresolvedSex={unresolvedSexEntries}
            schoolYear={schoolYear}
            onEditLearner={handleEditLearner}
            onAddLearner={handleAddLearner}
            onQuickSex={handleQuickSex}
          />
        </>
      )}

      {showLeaveConfirm && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation">
          <div role="alertdialog" aria-modal="true" aria-labelledby="sf1-leave-title" className="w-full max-w-md rounded-xl bg-white dark:bg-gray-900 shadow-xl p-5">
            <h2 id="sf1-leave-title" className="text-base font-bold text-gray-900 dark:text-gray-100">
              You have changes that have not been saved.
            </h2>
            <div className="mt-4 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowLeaveConfirm(false)}
                className="px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors min-h-[44px]"
              >
                Continue Editing
              </button>
              <button
                type="button"
                onClick={confirmLeaveWithoutSaving}
                className="px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors min-h-[44px]"
              >
                Leave Without Saving
              </button>
            </div>
          </div>
        </div>
      )}

      {editorState && (
        <SF1LearnerEditor
          learner={editorState.mode === "new" ? { ...createBlankLearner(), sex: editorState.sex } : learners[editorState.index]}
          gradeLevel={gradeLevel}
          isNew={editorState.mode === "new"}
          focusField={editorState.focusField}
          returnFocusRef={returnFocusRef}
          onSave={handleEditorSave}
          onCancel={() => setEditorState(null)}
          onRemove={handleEditorRemove}
        />
      )}
    </div>
  );
}

export default SF1;
