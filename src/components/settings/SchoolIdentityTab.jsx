// src/components/settings/SchoolIdentityTab.jsx
// School identity fields (name, address, DepEd hierarchy, principal, clinic
// teacher). These feed the headers of SF1/SF2/SF4, certificates, IDs and SF10.
//
// Split into a loader and a form so the form's state can be seeded straight
// from useState initializers -- the form only mounts once the config has
// loaded, which keeps setState out of effects.

import { useState } from "react";
import { Save } from "lucide-react";
import useSchoolConfigDoc from "./useSchoolConfigDoc.js";
import StatusMessages from "./StatusMessages.jsx";
import { inputClass, labelClass, cardClass, primaryButtonClass } from "./settingsStyles.js";

const DEFAULT_SCHOOL_FIELDS = {
  schoolName: "",
  schoolAddress: "",
  region: "",
  divisionOffice: "",
  district: "",
  municipalityCityProvince: "",
  principalName: "",
  principalPosition: "",
  clinicTeacherName: "",
};

const FIELD_LABELS = [
  ["schoolName", "School Name"],
  ["schoolAddress", "School Address"],
  ["region", "Region"],
  ["divisionOffice", "Division Office"],
  ["district", "District"],
  ["municipalityCityProvince", "Municipality / City / Province"],
  ["principalName", "Principal Name"],
  ["principalPosition", "Principal Position"],
  ["clinicTeacherName", "School Clinic Teacher Name"],
];

export default function SchoolIdentityTab() {
  const { data, loading, loadError, save } = useSchoolConfigDoc();

  if (loading) {
    return <div className="h-40 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />;
  }

  if (loadError) {
    return <StatusMessages errorMessage={loadError} />;
  }

  return <SchoolIdentityForm initial={data} save={save} />;
}

function SchoolIdentityForm({ initial, save }) {
  const [schoolData, setSchoolData] = useState(() => ({ ...DEFAULT_SCHOOL_FIELDS, ...initial }));
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  function updateField(field, value) {
    setSchoolData((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!schoolData.schoolName?.trim()) {
      setErrorMessage("School Name is required.");
      return;
    }
    if (!schoolData.principalName?.trim()) {
      setErrorMessage("Principal Name is required.");
      return;
    }

    setIsSaving(true);
    try {
      // Only the identity fields -- never the whole loaded doc, so branding,
      // SHS config and the calendar written by other tabs stay untouched.
      const patch = {};
      for (const [field] of FIELD_LABELS) patch[field] = schoolData[field] || "";
      await save(patch);
      setSuccessMessage("School identity saved.");
    } catch (err) {
      console.error("Failed to save school identity:", err);
      setErrorMessage("Failed to save school identity. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <StatusMessages successMessage={successMessage} errorMessage={errorMessage} />

      <div className={cardClass}>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">School Identity</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FIELD_LABELS.map(([field, label]) => (
            <label className={labelClass} key={field}>
              {label}
              <input
                className={inputClass}
                value={schoolData[field] || ""}
                onChange={(e) => updateField(field, e.target.value)}
              />
            </label>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={isSaving} className={primaryButtonClass}>
          <Save size={16} />
          {isSaving ? "Saving..." : "Save School Identity"}
        </button>
      </div>
    </form>
  );
}
