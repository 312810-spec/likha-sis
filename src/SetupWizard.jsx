import { useState, useRef } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase";
import useSchoolConfig from "./hooks/useSchoolConfig";
import { extractThemeFromImage } from "./utils/extractTheme.js";
import {
  KEY_STAGE_OPTIONS,
  getGradeLevelsFromStages,
  makeDefaultShsSubjects,
  makeDefaultShsClusters,
} from "./utils/keyStagesConfig.js";
import { toCoordinate } from "./utils/coordinates.js";
import { makeDefaultShift } from "./utils/scheduleModel.js";
import SF1Importer from "./pages/SF1Importer";
import SF10Importer from "./pages/SF10Importer";
import { hashSettingsKey, validateSettingsKey, SETTINGS_KEY_MIN_LENGTH } from "./utils/settingsLock.js";
import {
  autofillSchoolData,
  DEPED_REGIONS,
  KNOWN_SCHOOLS,
  getDivisionsForRegion,
} from "./utils/depedHierarchy.js";
import {
  Upload,
  Sparkles,
  Image as ImageIcon,
  FileSpreadsheet,
  FileText,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

/**
 * Resizes an image file to max width/height preserving aspect ratio
 * and returns a compressed JPEG data URL (quality 0.7).
 */
function resizeImageToCanvas(file, maxWidth = 200, maxHeight = 200, quality = 0.7) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
      img.src = readerEvent.target.result;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

function SetupWizard({ onComplete }) {
  const { config: initialConfig } = useSchoolConfig();
  const defaultGradeLevels = [
    "Grade 4",
    "Grade 5",
    "Grade 6",
    "Grade 7",
    "Grade 8",
    "Grade 9",
    "Grade 10",
  ];
  const initialGradeLevels = initialConfig?.gradeLevelsOffered || defaultGradeLevels;

  const [step, setStep] = useState(1);
  const [schoolData, setSchoolData] = useState({
    ...initialConfig,
    gradeLevelsOffered: initialGradeLevels,
  });
  const [selectedKeyStages, setSelectedKeyStages] = useState(() => ({
    ks1: false,
    ks2: initialGradeLevels.some((grade) => ["Grade 4", "Grade 5", "Grade 6"].includes(grade)),
    ks3: initialGradeLevels.some((grade) => ["Grade 7", "Grade 8", "Grade 9", "Grade 10"].includes(grade)),
    ks4: initialGradeLevels.some((grade) => ["Grade 11", "Grade 12"].includes(grade)),
  }));

  // DO 017 SHS configuration, revealed once Key Stage 4 is checked. Seeded
  // with school-configurable placeholders (never DepEd's actual curriculum
  // names, which this app doesn't have) or the school's existing config.
  const [shsSubjects, setShsSubjects] = useState(() =>
    initialConfig?.shs?.subjects?.length ? initialConfig.shs.subjects : makeDefaultShsSubjects()
  );
  const [shsClusters, setShsClusters] = useState(() =>
    initialConfig?.shs?.electiveClusters?.length ? initialConfig.shs.electiveClusters : makeDefaultShsClusters()
  );

  // Shifts (how many sessions the school runs) and, once at least one shift
  // exists, sections per grade level -- both editable in full later from
  // School Settings > Sections & Shifts. Kept lightweight here since no
  // teacher accounts exist yet to assign as advisers.
  const [shifts, setShifts] = useState(() =>
    initialConfig?.shifts?.length ? initialConfig.shifts : [makeDefaultShift("Whole Day")]
  );
  const [sectionsByGrade, setSectionsByGrade] = useState({});
  const [newSectionName, setNewSectionName] = useState({});
  const [newSectionShift, setNewSectionShift] = useState({});

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  // The School Settings key -- a SECOND secret, separate from the login
  // password, required later before any school setting can be edited.
  const [settingsKey, setSettingsKey] = useState("");
  const [confirmSettingsKey, setConfirmSettingsKey] = useState("");
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 3: Branding State
  const [uploadedLogoUrl, setUploadedLogoUrl] = useState(null);
  const [extractedTheme, setExtractedTheme] = useState(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSavingBranding, setIsSavingBranding] = useState(false);
  const [brandingError, setBrandingError] = useState("");
  const fileInputRef = useRef(null);

  // Step 4: Import Learners State
  const [activeImporter, setActiveImporter] = useState(null);

  function handleKeyStageToggle(stageKey) {
    if (stageKey === "ks1") return;
    setSelectedKeyStages((prev) => ({
      ...prev,
      [stageKey]: !prev[stageKey],
    }));
  }

  function updateCoreSubjectName(index, name) {
    setShsSubjects((prev) => prev.map((s, i) => (i === index ? { ...s, name } : s)));
  }

  function updateClusterName(clusterIndex, name) {
    setShsClusters((prev) => prev.map((c, i) => (i === clusterIndex ? { ...c, name } : c)));
  }

  function addCluster() {
    setShsClusters((prev) => [
      ...prev,
      { id: `cluster_${Date.now()}`, name: `[Elective Cluster ${prev.length + 1}]`, subjects: [] },
    ]);
  }

  function removeCluster(clusterIndex) {
    setShsClusters((prev) => prev.filter((_, i) => i !== clusterIndex));
  }

  function addClusterSubject(clusterIndex) {
    setShsClusters((prev) =>
      prev.map((c, i) =>
        i === clusterIndex
          ? { ...c, subjects: [...c.subjects, { id: `${c.id}_s_${Date.now()}`, name: "", weightProfile: "techPro" }] }
          : c
      )
    );
  }

  function updateClusterSubject(clusterIndex, subjectIndex, patch) {
    setShsClusters((prev) =>
      prev.map((c, i) =>
        i === clusterIndex
          ? { ...c, subjects: c.subjects.map((s, si) => (si === subjectIndex ? { ...s, ...patch } : s)) }
          : c
      )
    );
  }

  function removeClusterSubject(clusterIndex, subjectIndex) {
    setShsClusters((prev) =>
      prev.map((c, i) =>
        i === clusterIndex ? { ...c, subjects: c.subjects.filter((_, si) => si !== subjectIndex) } : c
      )
    );
  }

  function updateShiftLabel(index, label) {
    setShifts((prev) => prev.map((s, i) => (i === index ? { ...s, label } : s)));
  }

  function addShift() {
    setShifts((prev) => [...prev, makeDefaultShift(`Shift ${prev.length + 1}`)]);
  }

  function removeShift(index) {
    const removed = shifts[index];
    setShifts((prev) => prev.filter((_, i) => i !== index));
    // Sections pointed at the removed shift fall back to whatever shift is
    // first afterward, so "Add" never silently points at a shift that no
    // longer exists.
    setSectionsByGrade((prev) => {
      const next = {};
      Object.entries(prev).forEach(([grade, list]) => {
        next[grade] = list.map((s) => (s.shiftId === removed?.id ? { ...s, shiftId: "" } : s));
      });
      return next;
    });
  }

  function addSection(gradeLevel) {
    const name = (newSectionName[gradeLevel] || "").trim();
    if (!name) return;
    const shiftId = newSectionShift[gradeLevel] || shifts[0]?.id || "";
    const id = `${gradeLevel}_${name}`.toLowerCase().replace(/\s+/g, "-");
    setSectionsByGrade((prev) => ({
      ...prev,
      [gradeLevel]: [...(prev[gradeLevel] || []), { id, gradeLevel, name, shiftId }],
    }));
    setNewSectionName((prev) => ({ ...prev, [gradeLevel]: "" }));
  }

  function removeSection(gradeLevel, sectionId) {
    setSectionsByGrade((prev) => ({
      ...prev,
      [gradeLevel]: (prev[gradeLevel] || []).filter((s) => s.id !== sectionId),
    }));
  }

  function validateStep1() {
    const e = {};
    if (!schoolData.schoolName || !schoolData.schoolName.trim()) {
      e.schoolName = "School name is required.";
    }
    if (!schoolData.principalName || !schoolData.principalName.trim()) {
      e.principalName = "Principal name is required.";
    }

    const gradeLevelsOffered = getGradeLevelsFromStages(selectedKeyStages);
    if (gradeLevelsOffered.length === 0) {
      e.gradeLevelsOffered = "Please select at least one of Key Stage 2, Key Stage 3, or Key Stage 4.";
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function validateStep2() {
    const e = {};
    if (!fullName.trim()) e.fullName = "Full name is required.";
    if (!email.trim()) e.email = "Email is required.";
    if (!password) e.password = "Password is required.";
    if (password && password.length < 6) e.password = "Password must be at least 6 characters.";
    if (password !== confirmPassword) e.confirmPassword = "Passwords do not match.";

    const settingsKeyError = validateSettingsKey(settingsKey, confirmSettingsKey);
    if (settingsKeyError) e.settingsKey = settingsKeyError;

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleStep2Submit(e) {
    e.preventDefault();
    setSubmitError("");
    if (!validateStep2()) return;

    const gradeLevelsOffered = getGradeLevelsFromStages(selectedKeyStages);
    if (gradeLevelsOffered.length === 0) {
      setErrors((prev) => ({
        ...prev,
        gradeLevelsOffered: "Please select at least one of Key Stage 2, Key Stage 3, or Key Stage 4.",
      }));
      return;
    }

    setIsSubmitting(true);
    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCred.user.uid;

      await setDoc(doc(db, "users", uid), {
        fullName,
        email,
        roles: ["ictCoordinator"],
        assignments: [],
        createdAt: serverTimestamp(),
        createdByEmail: email,
      });

      // Store the School Settings key BEFORE schoolConfig: writing
      // setupCompletedAt below flips isSetupComplete() in firestore.rules, and
      // this write is simplest while first-run bootstrap access still applies.
      // Only the PBKDF2 hash is persisted -- never the key itself.
      const hashedSettingsKey = await hashSettingsKey(settingsKey);
      await setDoc(doc(db, "settings", "security"), {
        ...hashedSettingsKey,
        updatedAt: serverTimestamp(),
        updatedByEmail: email,
      });

      // Only persist SHS configuration when Key Stage 4 is actually enabled --
      // otherwise write the empty default rather than unused placeholder junk.
      const shs = selectedKeyStages.ks4
        ? { subjects: shsSubjects, electiveClusters: shsClusters }
        : { subjects: [], electiveClusters: [] };

      await setDoc(doc(db, "settings", "schoolConfig"), {
        ...schoolData,
        // Coordinates are typed as text but consumed as numbers by the weather
        // card and the nearby-earthquake radius, so normalize on write.
        latitude: toCoordinate(schoolData.latitude),
        longitude: toCoordinate(schoolData.longitude),
        gradeLevelsOffered,
        shs,
        shifts,
        setupCompletedAt: serverTimestamp(),
      });

      // Sections live in schedules/{schoolYear}/sections -- the same
      // collection Class Program Generator reads -- keyed to the built-in
      // default school year until Academic Calendar is configured. Written
      // after users/{uid} above so hasAnyRole(["ictCoordinator"]) already
      // resolves for this account.
      const allSections = Object.values(sectionsByGrade).flat();
      await Promise.all(
        allSections.map((section) =>
          setDoc(doc(db, "schedules", "2026-2027", "sections", section.id), section)
        )
      );

      // Advance to Step 3 (Branding)
      setStep(3);
    } catch (err) {
      setSubmitError(err.message || "Failed to create account.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLogoChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setBrandingError("Please select a valid image file (PNG, JPEG, etc.).");
      return;
    }

    setBrandingError("");
    try {
      const resizedDataUrl = await resizeImageToCanvas(file, 200, 200, 0.7);
      setUploadedLogoUrl(resizedDataUrl);
    } catch (err) {
      console.error("Failed to process image:", err);
      setBrandingError("Could not process the selected image. Please try another file.");
    }
  }

  async function handleGenerateTheme() {
    if (!uploadedLogoUrl) {
      setBrandingError("Please upload a logo first to generate a theme.");
      return;
    }

    setBrandingError("");
    setIsExtracting(true);

    try {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = uploadedLogoUrl;
      });

      const theme = await extractThemeFromImage(img);
      setExtractedTheme(theme);
    } catch (err) {
      console.error("Failed to extract theme from logo:", err);
      setBrandingError("Failed to extract colors from the image. Please try again or use another image.");
    } finally {
      setIsExtracting(false);
    }
  }

  async function handleSaveBranding() {
    if (!uploadedLogoUrl && !extractedTheme) {
      setStep(4);
      return;
    }

    setBrandingError("");
    setIsSavingBranding(true);

    try {
      const payload = {
        updatedAt: serverTimestamp(),
      };
      if (uploadedLogoUrl) payload.logo = uploadedLogoUrl;
      if (extractedTheme) payload.theme = extractedTheme;

      await setDoc(doc(db, "settings", "schoolConfig"), payload, { merge: true });
      setStep(4);
    } catch (err) {
      console.error("Failed to save branding:", err);
      setBrandingError("Failed to save branding settings. Please try again.");
    } finally {
      setIsSavingBranding(false);
    }
  }

  function handleSkipBranding() {
    setStep(4);
  }

  function handleFinishSetup() {
    if (onComplete) {
      onComplete();
      return;
    }
    if (typeof window !== "undefined" && window.location?.reload) {
      try {
        window.location.reload();
      } catch {
        // Fallback for test / non-browser environments
      }
    }
  }

  const importCards = [
    {
      key: "sf1",
      title: "SF1 Bulk Import",
      description:
        "Upload existing DepEd SF1 (Learner's Information Sheet) .xls/.xlsx files in a batch. The system analyzes each workbook, detects its structure, extracts and validates learner records, flags duplicates and conflicts, and imports approved records into Firestore.",
      icon: FileSpreadsheet,
      accent: "bg-primary",
      fileNote: ".xls · .xlsx · batch upload",
    },
    {
      key: "sf10",
      title: "SF10 Import",
      description:
        "Upload SF10 (Learner's Permanent Academic Record) files. Extract learner identity and learning-area grades, validate them, then import approved academic records linked to each learner by LRN.",
      icon: FileText,
      accent: "bg-leaf",
      fileNote: ".xls · .xlsx",
    },
  ];

  const containerMaxWidth =
    step === 4 ? "max-w-4xl" : step === 3 ? "max-w-2xl" : "max-w-lg";

  return (
    <div className="min-h-screen bg-primary flex items-center justify-center p-4">
      <div className={`w-full ${containerMaxWidth} bg-white rounded-xl shadow-lg p-6 sm:p-8 transition-all duration-200`}>
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold text-primary">LIKHA-SIS Setup</h2>
          <p className="text-sm text-gray-500 mt-1">Step {step} of 4</p>
        </div>

        {step === 1 && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (validateStep1()) setStep(2);
            }}
          >
            <datalist id="wizard-school-presets">
              {KNOWN_SCHOOLS.map((s) => (
                <option key={s.schoolId} value={s.schoolName}>
                  {`${s.schoolName} (${s.district}, ${s.divisionOffice})`}
                </option>
              ))}
            </datalist>

            <datalist id="wizard-regions">
              {DEPED_REGIONS.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>

            <datalist id="wizard-divisions">
              {getDivisionsForRegion(schoolData.region).map((d) => (
                <option key={d.name} value={d.name}>
                  {d.cityProvince}
                </option>
              ))}
            </datalist>

            <div className="grid grid-cols-1 gap-3">
              <label className="text-sm">School ID (6 Digits)</label>
              <input
                className="border p-2 rounded"
                value={schoolData.schoolId || ""}
                placeholder="e.g. 302975"
                onChange={(e) => setSchoolData(autofillSchoolData(schoolData, "schoolId", e.target.value))}
              />

              <label className="text-sm">School Name</label>
              <input
                className="border p-2 rounded"
                list="wizard-school-presets"
                value={schoolData.schoolName || ""}
                onChange={(e) => setSchoolData(autofillSchoolData(schoolData, "schoolName", e.target.value))}
              />
              {errors.schoolName && <p className="text-red-600 text-sm">{errors.schoolName}</p>}

              <label className="text-sm">School Address</label>
              <input
                className="border p-2 rounded"
                value={schoolData.schoolAddress || ""}
                onChange={(e) => setSchoolData(autofillSchoolData(schoolData, "schoolAddress", e.target.value))}
              />

              <label className="text-sm">Region</label>
              <input
                className="border p-2 rounded"
                list="wizard-regions"
                value={schoolData.region || ""}
                onChange={(e) => setSchoolData(autofillSchoolData(schoolData, "region", e.target.value))}
              />

              <label className="text-sm">SDO - Division Office</label>
              <input
                className="border p-2 rounded"
                list="wizard-divisions"
                value={schoolData.divisionOffice || ""}
                onChange={(e) => setSchoolData(autofillSchoolData(schoolData, "divisionOffice", e.target.value))}
              />

              <label className="text-sm">District</label>
              <input
                className="border p-2 rounded"
                value={schoolData.district || ""}
                onChange={(e) => setSchoolData(autofillSchoolData(schoolData, "district", e.target.value))}
              />

              <label className="text-sm">Municipality / City / Province</label>
              <input
                className="border p-2 rounded"
                value={schoolData.municipalityCityProvince || ""}
                onChange={(e) => setSchoolData(autofillSchoolData(schoolData, "municipalityCityProvince", e.target.value))}
              />

              <label className="text-sm">Principal Name</label>
              <input
                className="border p-2 rounded"
                value={schoolData.principalName || ""}
                onChange={(e) => setSchoolData(autofillSchoolData(schoolData, "principalName", e.target.value))}
              />
              {errors.principalName && <p className="text-red-600 text-sm">{errors.principalName}</p>}

              <label className="text-sm">Principal Position</label>
              <input
                className="border p-2 rounded"
                value={schoolData.principalPosition}
                onChange={(e) => setSchoolData({ ...schoolData, principalPosition: e.target.value })}
              />
            </div>

            <div className="mt-6">
              <p className="text-sm font-medium text-gray-700 mb-2">Which grade levels does your school offer?</p>
              <div className="space-y-2">
                {KEY_STAGE_OPTIONS.map((stage) => (
                  <label
                    key={stage.key}
                    className={`flex items-center gap-3 rounded border p-2 ${stage.disabled ? "bg-gray-100 opacity-70" : "bg-white"}`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedKeyStages[stage.key] || false}
                      disabled={stage.disabled}
                      onChange={() => handleKeyStageToggle(stage.key)}
                    />
                    <span className="text-sm text-gray-700">{stage.label}</span>
                    {stage.disabled && (
                      <span className="inline-flex items-center rounded bg-gray-200 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                        Coming soon
                      </span>
                    )}
                  </label>
                ))}
              </div>
              {errors.gradeLevelsOffered && (
                <p className="text-red-600 text-sm mt-2">{errors.gradeLevelsOffered}</p>
              )}
            </div>

            {selectedKeyStages.ks4 && (
              <div className="mt-6 border-t border-gray-200 pt-5 space-y-5">
                <div>
                  <p className="text-sm font-medium text-gray-700">SHS Configuration (DO 017, s.2026)</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Edit these to match your school's actual DepEd-approved offerings — the names below are
                    placeholders only.
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                    Grade 11 Core Subjects (5 mandatory)
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {shsSubjects.map((subj, i) => (
                      <input
                        key={subj.id}
                        className="border p-2 rounded text-sm"
                        value={subj.name}
                        onChange={(e) => updateCoreSubjectName(i, e.target.value)}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      Tech-Pro Track Elective Clusters
                    </p>
                    <button
                      type="button"
                      onClick={addCluster}
                      className="text-xs font-medium text-primary hover:text-primary-light"
                    >
                      + Add Cluster
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-400 mb-2">
                    Keep each cluster to around 3–5 subjects — the printed Report Card is a fixed single
                    page, and a learner's 5 core subjects plus a long cluster subject list can overflow it.
                  </p>

                  <div className="space-y-3">
                    {shsClusters.map((cluster, ci) => (
                      <div key={cluster.id} className="border rounded-lg p-3 bg-gray-50/70">
                        <div className="flex items-center gap-2">
                          <input
                            className="border p-1.5 rounded text-sm flex-1"
                            value={cluster.name}
                            onChange={(e) => updateClusterName(ci, e.target.value)}
                          />
                          <button
                            type="button"
                            onClick={() => removeCluster(ci)}
                            className="text-xs text-red-600 hover:text-red-700 px-2"
                          >
                            Remove
                          </button>
                        </div>

                        <div className="mt-2 space-y-1.5">
                          {cluster.subjects.map((subj, si) => (
                            <div key={subj.id} className="flex items-center gap-1.5">
                              <input
                                className="border p-1 rounded text-xs flex-1"
                                placeholder="Subject name"
                                value={subj.name}
                                onChange={(e) => updateClusterSubject(ci, si, { name: e.target.value })}
                              />
                              <select
                                className="border p-1 rounded text-xs"
                                value={subj.weightProfile}
                                onChange={(e) => updateClusterSubject(ci, si, { weightProfile: e.target.value })}
                              >
                                <option value="techPro">Tech-Pro (20/80/0)</option>
                                <option value="immersion">Work Immersion (15/65/20)</option>
                              </select>
                              <button
                                type="button"
                                onClick={() => removeClusterSubject(ci, si)}
                                className="text-xs text-red-600 hover:text-red-700 px-1"
                              >
                                &times;
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => addClusterSubject(ci)}
                            className="text-xs font-medium text-primary hover:text-primary-light"
                          >
                            + Add Subject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {getGradeLevelsFromStages(selectedKeyStages).length > 0 && (
              <div className="mt-6 border-t border-gray-200 pt-5 space-y-5">
                <div>
                  <p className="text-sm font-medium text-gray-700">Shifts &amp; Sections</p>
                  <p className="text-xs text-gray-500 mt-1">
                    How many shifts does the school run, and how many sections per grade level? You can
                    fine-tune shift start times and periods later in School Settings.
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Shifts</p>
                  <div className="space-y-1.5">
                    {shifts.map((shift, i) => (
                      <div key={shift.id} className="flex items-center gap-1.5">
                        <input
                          className="flex-1 border p-1.5 rounded text-sm"
                          value={shift.label}
                          onChange={(e) => updateShiftLabel(i, e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => removeShift(i)}
                          className="text-xs text-red-600 hover:text-red-700 px-1"
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={addShift}
                    className="text-xs font-medium text-primary hover:text-primary-light mt-1.5"
                  >
                    + Add Shift
                  </button>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    Sections per Grade Level
                  </p>
                  {getGradeLevelsFromStages(selectedKeyStages).map((gradeLevel) => (
                    <div key={gradeLevel} className="border rounded-lg p-3 bg-gray-50/70">
                      <p className="text-xs font-semibold text-gray-600 mb-1.5">{gradeLevel}</p>
                      {(sectionsByGrade[gradeLevel] || []).length > 0 && (
                        <ul className="flex flex-wrap gap-1.5 mb-1.5">
                          {sectionsByGrade[gradeLevel].map((s) => (
                            <li
                              key={s.id}
                              className="flex items-center gap-1.5 text-xs font-medium bg-white text-gray-700 border border-gray-200 rounded-full px-2.5 py-1"
                            >
                              {s.name}
                              <button
                                type="button"
                                onClick={() => removeSection(gradeLevel, s.id)}
                                className="text-red-500 hover:text-red-700"
                              >
                                &times;
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <input
                          className="flex-1 min-w-[100px] border p-1.5 rounded text-xs"
                          placeholder="Section name"
                          value={newSectionName[gradeLevel] || ""}
                          onChange={(e) =>
                            setNewSectionName((prev) => ({ ...prev, [gradeLevel]: e.target.value }))
                          }
                        />
                        <select
                          className="border p-1.5 rounded text-xs"
                          value={newSectionShift[gradeLevel] || shifts[0]?.id || ""}
                          onChange={(e) =>
                            setNewSectionShift((prev) => ({ ...prev, [gradeLevel]: e.target.value }))
                          }
                          disabled={shifts.length === 0}
                        >
                          {shifts.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => addSection(gradeLevel)}
                          disabled={shifts.length === 0}
                          className="text-xs font-semibold text-white bg-primary hover:bg-primary-light disabled:opacity-50 rounded px-2.5 py-1.5"
                        >
                          + Add
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-between">
              <div />
              <button
                type="submit"
                className="bg-primary text-white px-4 py-2 rounded"
              >
                Continue
              </button>
            </div>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleStep2Submit}>
            <p className="text-sm text-gray-600 mb-4">
              This account will have full ICT Coordinator access to set up the rest of your school's system.
            </p>

            <label className="text-sm">Full Name</label>
            <input className="border p-2 rounded w-full mb-2" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            {errors.fullName && <p className="text-red-600 text-sm">{errors.fullName}</p>}

            <label className="text-sm">Email</label>
            <input className="border p-2 rounded w-full mb-2" value={email} onChange={(e) => setEmail(e.target.value)} />
            {errors.email && <p className="text-red-600 text-sm">{errors.email}</p>}

            <label className="text-sm">Password</label>
            <input type="password" className="border p-2 rounded w-full mb-2" value={password} onChange={(e) => setPassword(e.target.value)} />
            {errors.password && <p className="text-red-600 text-sm">{errors.password}</p>}

            <label className="text-sm">Confirm Password</label>
            <input type="password" className="border p-2 rounded w-full mb-2" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            {errors.confirmPassword && <p className="text-red-600 text-sm">{errors.confirmPassword}</p>}

            <div className="mt-5 pt-4 border-t border-gray-200">
              <p className="text-sm font-medium text-gray-700">School Settings Key</p>
              <p className="text-xs text-gray-500 mt-1 mb-3">
                A second secret, separate from the password above. It will be required before school
                identity, grade levels, branding or the academic calendar can ever be changed. Minimum{" "}
                {SETTINGS_KEY_MIN_LENGTH} characters — store it somewhere safe, it cannot be recovered.
              </p>

              <label className="text-sm">School Settings Key</label>
              <input
                type="password"
                autoComplete="off"
                className="border p-2 rounded w-full mb-2"
                value={settingsKey}
                onChange={(e) => setSettingsKey(e.target.value)}
              />

              <label className="text-sm">Confirm School Settings Key</label>
              <input
                type="password"
                autoComplete="off"
                className="border p-2 rounded w-full mb-2"
                value={confirmSettingsKey}
                onChange={(e) => setConfirmSettingsKey(e.target.value)}
              />
              {errors.settingsKey && <p className="text-red-600 text-sm">{errors.settingsKey}</p>}
            </div>

            {submitError && <p className="text-red-600 text-sm mt-2">{submitError}</p>}

            <div className="mt-6 flex justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 rounded border"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-primary text-white px-4 py-2 rounded"
              >
                {isSubmitting ? "Creating account..." : "Create account & Continue"}
              </button>
            </div>
          </form>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <p className="text-sm text-gray-600">
              Upload your school logo to extract brand colors and customize your system theme. You can also configure this later in Branding Settings.
            </p>

            {brandingError && (
              <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-800 flex items-start gap-2.5 text-xs font-medium">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{brandingError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Logo Upload */}
              <div className="bg-gray-50/70 p-5 rounded-xl border border-gray-200 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">
                    1
                  </span>
                  <h3 className="text-sm font-semibold text-gray-900">School Logo</h3>
                </div>
                <p className="text-xs text-gray-500">
                  Upload an image file (PNG, JPG). It will be resized client-side to 200x200px.
                </p>

                <div className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg bg-white space-y-3">
                  <div className="w-28 h-28 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center overflow-hidden p-2">
                    {uploadedLogoUrl ? (
                      <img
                        src={uploadedLogoUrl}
                        alt="School logo preview"
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <ImageIcon size={32} className="text-gray-400" />
                    )}
                  </div>

                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="hidden"
                    id="setup-logo-input"
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 shadow-sm transition"
                  >
                    <Upload size={14} />
                    {uploadedLogoUrl ? "Change Logo" : "Upload Logo"}
                  </button>
                  {uploadedLogoUrl && (
                    <span className="text-[11px] text-green-600 font-medium flex items-center gap-1">
                      <CheckCircle2 size={12} /> Ready for theme generation
                    </span>
                  )}
                </div>
              </div>

              {/* Theme Generation */}
              <div className="bg-gray-50/70 p-5 rounded-xl border border-gray-200 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">
                    2
                  </span>
                  <h3 className="text-sm font-semibold text-gray-900">Brand Theme</h3>
                </div>
                <p className="text-xs text-gray-500">
                  Extracts dominant colors from your logo with readable contrast.
                </p>

                <button
                  type="button"
                  disabled={isExtracting || !uploadedLogoUrl}
                  onClick={handleGenerateTheme}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-light transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  <Sparkles size={14} />
                  {isExtracting ? "Extracting Colors..." : "Generate Theme from Logo"}
                </button>

                {extractedTheme ? (
                  <div className="space-y-2 pt-1">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                      Extracted Palette
                    </h4>
                    <div className="grid grid-cols-3 gap-1.5">
                      {/* Primary Swatch */}
                      <div className="p-2 rounded-lg border border-gray-200 bg-white text-center space-y-1">
                        <div
                          className="w-full h-7 rounded shadow-inner"
                          style={{ backgroundColor: extractedTheme.primary }}
                        />
                        <div className="text-[11px] font-bold text-gray-800">Primary</div>
                        <div className="text-[9px] text-gray-500 font-mono">{extractedTheme.primary}</div>
                        <div className="flex gap-1 justify-center pt-0.5">
                          <div
                            className="w-3 h-3 rounded"
                            title={`Light: ${extractedTheme.primaryLight}`}
                            style={{ backgroundColor: extractedTheme.primaryLight }}
                          />
                          <div
                            className="w-3 h-3 rounded"
                            title={`Dark: ${extractedTheme.primaryDark}`}
                            style={{ backgroundColor: extractedTheme.primaryDark }}
                          />
                        </div>
                      </div>

                      {/* Accent Swatch */}
                      <div className="p-2 rounded-lg border border-gray-200 bg-white text-center space-y-1">
                        <div
                          className="w-full h-7 rounded shadow-inner"
                          style={{ backgroundColor: extractedTheme.accent }}
                        />
                        <div className="text-[11px] font-bold text-gray-800">Accent</div>
                        <div className="text-[9px] text-gray-500 font-mono">{extractedTheme.accent}</div>
                        <div className="flex gap-1 justify-center pt-0.5">
                          <div
                            className="w-3 h-3 rounded"
                            title={`Light: ${extractedTheme.accentLight}`}
                            style={{ backgroundColor: extractedTheme.accentLight }}
                          />
                          <div
                            className="w-3 h-3 rounded"
                            title={`Dark: ${extractedTheme.accentDark}`}
                            style={{ backgroundColor: extractedTheme.accentDark }}
                          />
                        </div>
                      </div>

                      {/* Leaf Swatch */}
                      <div className="p-2 rounded-lg border border-gray-200 bg-white text-center space-y-1">
                        <div
                          className="w-full h-7 rounded shadow-inner"
                          style={{ backgroundColor: extractedTheme.leaf }}
                        />
                        <div className="text-[11px] font-bold text-gray-800">Leaf</div>
                        <div className="text-[9px] text-gray-500 font-mono">{extractedTheme.leaf}</div>
                        <div className="flex gap-1 justify-center pt-0.5">
                          <div
                            className="w-3 h-3 rounded"
                            title={`Light: ${extractedTheme.leafLight}`}
                            style={{ backgroundColor: extractedTheme.leafLight }}
                          />
                          <div
                            className="w-3 h-3 rounded"
                            title={`Dark: ${extractedTheme.leafDark}`}
                            style={{ backgroundColor: extractedTheme.leafDark }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 text-[11px] text-gray-400 border border-dashed rounded-lg bg-white">
                    No theme generated yet. Upload a logo and click generate.
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={handleSkipBranding}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                Skip for Now
              </button>
              <button
                type="button"
                disabled={isSavingBranding}
                onClick={handleSaveBranding}
                className="bg-primary text-white px-6 py-2 rounded-lg text-sm font-semibold hover:bg-primary-light transition shadow-sm disabled:opacity-50"
              >
                {isSavingBranding ? "Saving..." : "Save and Continue"}
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <p className="text-sm text-gray-600">
              You can bulk-import your student roster now using DepEd SF1 or SF10 spreadsheets, or skip and do this later from the Import Center.
            </p>

            {!activeImporter ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {importCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <button
                      key={card.key}
                      type="button"
                      onClick={() => setActiveImporter(card.key)}
                      className="text-left bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:border-primary hover:shadow-md transition-all group"
                    >
                      <div className="flex items-start gap-3.5">
                        <div
                          className={`w-10 h-10 rounded-lg ${card.accent} text-white flex items-center justify-center shrink-0`}
                        >
                          <Icon size={20} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-gray-900">{card.title}</h3>
                            <ArrowRight
                              size={16}
                              className="text-gray-300 group-hover:text-primary transition-colors"
                            />
                          </div>
                          <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{card.description}</p>
                          <p className="text-[11px] text-gray-400 mt-2 font-medium">{card.fileNote}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-3">
                  <button
                    type="button"
                    onClick={() => setActiveImporter(null)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary-light"
                  >
                    <ArrowLeft size={14} /> Back to Importer Options
                  </button>
                  <span className="text-xs text-gray-500 font-medium">
                    {activeImporter === "sf1" ? "SF1 Bulk Importer" : "SF10 Importer"}
                  </span>
                </div>

                <div className="border rounded-xl p-4 bg-gray-50/50">
                  {activeImporter === "sf1" && <SF1Importer user={auth.currentUser} />}
                  {activeImporter === "sf10" && <SF10Importer user={auth.currentUser} />}
                </div>
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={handleFinishSetup}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                Skip for Now
              </button>
              <button
                type="button"
                onClick={handleFinishSetup}
                className="bg-primary text-white px-6 py-2 rounded-lg text-sm font-semibold hover:bg-primary-light transition shadow-sm"
              >
                Finish Setup
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SetupWizard;
