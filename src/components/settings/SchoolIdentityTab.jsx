// src/components/settings/SchoolIdentityTab.jsx
// School identity fields (name, address, DepEd hierarchy, principal). These
// feed the headers of SF1/SF2/SF4, certificates, IDs and SF10.
//
// Split into a loader and a form so the form's state can be seeded straight
// from useState initializers -- the form only mounts once the config has
// loaded, which keeps setState out of effects.

import { useState } from "react";
import { Save, LocateFixed } from "lucide-react";
import useSchoolConfigDoc from "./useSchoolConfigDoc.js";
import StatusMessages from "./StatusMessages.jsx";
import { inputClass, labelClass, cardClass, primaryButtonClass } from "./settingsStyles.js";
import {
  autofillSchoolData,
  DEPED_REGIONS,
  KNOWN_SCHOOLS,
  getDivisionsForRegion,
} from "../../utils/depedHierarchy.js";

const DEFAULT_SCHOOL_FIELDS = {
  schoolId: "",
  schoolName: "",
  schoolAddress: "",
  region: "",
  divisionOffice: "",
  district: "",
  municipalityCityProvince: "",
  principalName: "",
  principalPosition: "",
  divisionSuperintendent: "",
  // Coordinates drive the Dashboard weather card and the "earthquake near
  // your school" radius. Weather simply doesn't render when both are absent.
  // Set only via the device's own location -- never typed in.
  latitude: "",
  longitude: "",
};

const TEXT_FIELD_LABELS = [
  ["schoolId", "School ID (6 Digits)"],
  ["schoolName", "School Name"],
  ["schoolAddress", "School Address"],
  ["region", "Region"],
  ["district", "District"],
  ["municipalityCityProvince", "Municipality / City / Province"],
  ["principalName", "Principal / School Head Name"],
  ["principalPosition", "Principal Position / Designation"],
  ["divisionSuperintendent", "Schools Division Superintendent"],
];

const SAVED_FIELDS = ["divisionOffice", "latitude", "longitude", ...TEXT_FIELD_LABELS.map(([f]) => f)];

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
  const [isLocating, setIsLocating] = useState(false);

  function updateField(field, value) {
    setSchoolData((prev) => autofillSchoolData(prev, field, value));
  }

  const availableDivisions = getDivisionsForRegion(schoolData.region);

  function handleUseCurrentLocation() {
    if (!navigator.geolocation) {
      setErrorMessage("This browser doesn't support device location.");
      return;
    }
    setErrorMessage("");
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setSchoolData((prev) => ({
          ...prev,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }));
        setIsLocating(false);
      },
      (err) => {
        setErrorMessage(`Couldn't get device location: ${err.message}`);
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
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
      const patch = {
        divisionSuperintendentPosition: "Schools Division Superintendent",
      };
      for (const field of SAVED_FIELDS) patch[field] = schoolData[field] || "";
      patch.latitude = schoolData.latitude === "" ? null : schoolData.latitude;
      patch.longitude = schoolData.longitude === "" ? null : schoolData.longitude;
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

      <datalist id="deped-school-presets">
        {KNOWN_SCHOOLS.map((s) => (
          <option key={s.schoolId} value={s.schoolName}>
            {`${s.schoolName} (${s.district}, ${s.divisionOffice})`}
          </option>
        ))}
      </datalist>

      <datalist id="deped-regions">
        {DEPED_REGIONS.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>

      <div className={cardClass}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">School Identity</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Selecting or entering a Region, Division Office, District, or School Name will automatically match and autofill related DepEd details.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {TEXT_FIELD_LABELS.map(([field, label]) => {
            const listId =
              field === "schoolName" ? "deped-school-presets" : field === "region" ? "deped-regions" : undefined;

            return (
              <label className={labelClass} key={field}>
                {label}
                <input
                  className={inputClass}
                  list={listId}
                  value={schoolData[field] || ""}
                  onChange={(e) => updateField(field, e.target.value)}
                />
              </label>
            );
          })}

          <label className={labelClass}>
            {'SDO - "Division Office"'}
            <select
              className={inputClass}
              value={schoolData.divisionOffice || ""}
              onChange={(e) => updateField("divisionOffice", e.target.value)}
            >
              <option value="">Select a division…</option>
              {availableDivisions.map((d) => (
                <option key={d.name} value={d.name}>
                  {`${d.name} (${d.cityProvince})`}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className={labelClass}>School Coordinates</div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {schoolData.latitude && schoolData.longitude
                  ? `${Number(schoolData.latitude).toFixed(5)}, ${Number(schoolData.longitude).toFixed(5)}`
                  : "Not set — drives the local weather card and earthquake radius."}
              </p>
            </div>
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={isLocating}
              className={primaryButtonClass}
            >
              <LocateFixed size={16} />
              {isLocating ? "Locating…" : "Use Current Location"}
            </button>
          </div>
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
