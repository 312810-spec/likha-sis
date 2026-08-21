// src/components/sf1/SF1LearnerEditor.jsx
// A single, large, readable form for editing ONE SF1 learner at a time --
// the age-friendly replacement for editing a row inline in a dense
// spreadsheet. Commits its draft back to the caller's in-memory learner list
// only (see SF1.jsx); Firestore is written once, in bulk, by "Save Learner
// Records" on the Edit screen.

import { useEffect, useRef, useState } from "react";
import { X, Save, Trash2 } from "lucide-react";
import { getSf1RecordIssues } from "../../utils/sf1RecordQuality.js";

const FIELD_TEXT = "w-full text-base rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2.5 focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-colors";
const FIELD_LABEL = "block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5";
const GROUP_TITLE = "text-sm font-bold text-gray-900 dark:text-gray-100 mb-3 pb-2 border-b border-gray-200 dark:border-gray-700";

function Field({ label, hint, error, children }) {
  return (
    <label className={FIELD_LABEL}>
      {label}
      {hint && <span className="ml-1.5 font-normal text-gray-500 dark:text-gray-400">{hint}</span>}
      <div className="mt-1.5">{children}</div>
      {error && (
        <span className="mt-1 flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400">
          {error}
        </span>
      )}
    </label>
  );
}

export default function SF1LearnerEditor({
  learner,
  gradeLevel,
  isNew = false,
  onSave,
  onCancel,
  onRemove,
  focusField,
  returnFocusRef,
}) {
  const [draft, setDraft] = useState(() => ({ ...learner }));
  const dialogRef = useRef(null);
  const firstFieldRef = useRef(null);

  const issues = getSf1RecordIssues(draft, gradeLevel);
  const issueByField = Object.fromEntries(issues.map((i) => [i.field, i.label]));

  useEffect(() => {
    const el = focusField
      ? dialogRef.current?.querySelector(`[name="${focusField}"]`)
      : firstFieldRef.current;
    el?.focus();

    // Captured now, not read from the ref at cleanup time -- the caller may
    // reassign returnFocusRef.current before this modal unmounts.
    const elementToRefocus = returnFocusRef?.current;

    function handleKeyDown(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      elementToRefocus?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update(field, value) {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSave(draft);
  }

  function handleRemove() {
    if (window.confirm(`Remove ${draft.lastName || draft.firstName ? `${draft.lastName}, ${draft.firstName}` : "this learner"} from the roster?`)) {
      onRemove();
    }
  }

  const learnerLabel = [draft.lastName, draft.firstName].filter(Boolean).join(", ") || "New Learner";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/50 p-0 sm:p-4 overflow-y-auto"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sf1-editor-title"
        className="w-full sm:max-w-3xl sm:rounded-xl bg-white dark:bg-gray-900 shadow-xl min-h-screen sm:min-h-0 sm:max-h-[90vh] flex flex-col"
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 id="sf1-editor-title" className="text-base font-bold text-gray-900 dark:text-gray-100">
            {isNew ? "Add Learner" : `Edit Learner — ${learnerLabel}`}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close editor"
            className="p-2.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          <fieldset>
            <legend className={GROUP_TITLE}>Learner Information</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="LRN (12 digits)" error={issueByField.lrn}>
                <input
                  ref={firstFieldRef}
                  name="lrn"
                  className={FIELD_TEXT}
                  value={draft.lrn || ""}
                  maxLength={12}
                  onChange={(e) => update("lrn", e.target.value.replace(/\D/g, ""))}
                />
              </Field>
              <Field label="Sex" error={issueByField.sex}>
                <select
                  name="sex"
                  className={FIELD_TEXT}
                  value={draft.sex || ""}
                  onChange={(e) => update("sex", e.target.value)}
                >
                  <option value="">Select…</option>
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                </select>
              </Field>
              <Field label="Last Name" error={issueByField.lastName}>
                <input name="lastName" className={FIELD_TEXT} value={draft.lastName || ""} onChange={(e) => update("lastName", e.target.value)} />
              </Field>
              <Field label="First Name" error={issueByField.firstName}>
                <input name="firstName" className={FIELD_TEXT} value={draft.firstName || ""} onChange={(e) => update("firstName", e.target.value)} />
              </Field>
              <Field label="Middle Name">
                <input name="middleName" className={FIELD_TEXT} value={draft.middleName || ""} onChange={(e) => update("middleName", e.target.value)} />
              </Field>
              <Field label="Name Extension" hint="(Jr., III, etc.)">
                <input name="nameExtension" className={FIELD_TEXT} value={draft.nameExtension || ""} onChange={(e) => update("nameExtension", e.target.value)} />
              </Field>
              <Field label="Birth Date" error={issueByField.birthDate}>
                <input type="date" name="birthDate" className={FIELD_TEXT} value={draft.birthDate || ""} onChange={(e) => update("birthDate", e.target.value)} />
              </Field>
            </div>
          </fieldset>

          <fieldset>
            <legend className={GROUP_TITLE}>Learner Profile</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Mother Tongue" hint="(Grade 1 to 3 Only)">
                <input name="motherTongue" className={FIELD_TEXT} value={draft.motherTongue || ""} onChange={(e) => update("motherTongue", e.target.value)} />
              </Field>
              <Field label="IP / Ethnic Group">
                <input name="ipEthnicGroup" className={FIELD_TEXT} value={draft.ipEthnicGroup || ""} onChange={(e) => update("ipEthnicGroup", e.target.value)} />
              </Field>
              <Field label="Religion">
                <input name="religion" className={FIELD_TEXT} value={draft.religion || ""} onChange={(e) => update("religion", e.target.value)} />
              </Field>
              <Field label="Learning Modality">
                <select name="learningModality" className={FIELD_TEXT} value={draft.learningModality || "Face to Face"} onChange={(e) => update("learningModality", e.target.value)}>
                  <option>Face to Face</option>
                  <option>Blended</option>
                  <option>Online</option>
                  <option>Modular</option>
                </select>
              </Field>
            </div>
          </fieldset>

          <fieldset>
            <legend className={GROUP_TITLE}>Address</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="House # / Street / Sitio / Purok">
                <input name="houseStreetSitio" className={FIELD_TEXT} value={draft.houseStreetSitio || ""} onChange={(e) => update("houseStreetSitio", e.target.value)} />
              </Field>
              <Field label="Barangay">
                <input name="barangay" className={FIELD_TEXT} value={draft.barangay || ""} onChange={(e) => update("barangay", e.target.value)} />
              </Field>
              <Field label="Municipality / City">
                <input name="municipalityCity" className={FIELD_TEXT} value={draft.municipalityCity || ""} onChange={(e) => update("municipalityCity", e.target.value)} />
              </Field>
              <Field label="Province">
                <input name="province" className={FIELD_TEXT} value={draft.province || ""} onChange={(e) => update("province", e.target.value)} />
              </Field>
            </div>
          </fieldset>

          <fieldset>
            <legend className={GROUP_TITLE}>Parents</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Father's Name">
                <input name="fathersName" className={FIELD_TEXT} value={draft.fathersName || ""} onChange={(e) => update("fathersName", e.target.value)} />
              </Field>
              <Field label="Mother's Maiden Name">
                <input name="mothersMaidenName" className={FIELD_TEXT} value={draft.mothersMaidenName || ""} onChange={(e) => update("mothersMaidenName", e.target.value)} />
              </Field>
            </div>
          </fieldset>

          <fieldset>
            <legend className={GROUP_TITLE}>Guardian</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Guardian Name">
                <input name="guardianName" className={FIELD_TEXT} value={draft.guardianName || ""} onChange={(e) => update("guardianName", e.target.value)} />
              </Field>
              <Field label="Relationship to Learner">
                <input name="guardianRelationship" className={FIELD_TEXT} value={draft.guardianRelationship || ""} onChange={(e) => update("guardianRelationship", e.target.value)} />
              </Field>
              <Field label="Contact Number of Parent or Guardian" error={issueByField.contactNumber}>
                <input name="contactNumber" className={FIELD_TEXT} value={draft.contactNumber || ""} onChange={(e) => update("contactNumber", e.target.value)} />
              </Field>
            </div>
          </fieldset>

          <fieldset>
            <legend className={GROUP_TITLE}>Remarks</legend>
            <Field label="Remarks" hint="(indicator codes, notes, etc.)">
              <textarea
                name="remarks"
                className={`${FIELD_TEXT} min-h-[80px] resize-y`}
                value={draft.remarks || ""}
                onChange={(e) => update("remarks", e.target.value)}
              />
            </Field>
          </fieldset>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-t border-gray-200 dark:border-gray-700">
          {!isNew ? (
            <button
              type="button"
              onClick={handleRemove}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors min-h-[44px]"
            >
              <Trash2 size={16} />
              Remove Learner
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-3 ml-auto">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-sm font-semibold transition-colors min-h-[44px]"
            >
              <Save size={16} />
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
