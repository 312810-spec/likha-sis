// src/components/SchoolIdentityFields.jsx
// The DepEd field-office identity block shared by SchoolSettings.jsx and
// SetupWizard.jsx, so the two never drift apart on what a valid Region /
// Division / District / School Name looks like.
//
// Region and Division Office are true dropdowns cascading off the official
// DepEd directory in data/depedReferenceData.js. District and School Name are
// type-ahead comboboxes instead: there is no stable public machine-readable
// list of the country's ~2,300 districts and ~60,000 schools, and shipping a
// partial snapshot would present stale data as authoritative on every printed
// School Form. Their suggestions come from a referenceData/schoolDirectory doc
// the school maintains itself.
//
// Every dropdown keeps an escape hatch ("Not listed"), because the directory
// does change -- the Negros Island Region's re-establishment is exactly the
// kind of shift that would otherwise lock a school out of its own division.

import { useEffect, useState, useId } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import {
  DEPED_REGIONS,
  getDivisionsForRegion,
  getRegionName,
} from "../data/depedReferenceData.js";

const OTHER = "__other__";

const DEFAULT_INPUT_CLASS =
  "w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary focus:bg-white dark:focus:bg-gray-800 transition-colors";
const DEFAULT_LABEL_CLASS =
  "flex flex-col gap-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300";

/** Matches a stored free-text region back to a directory entry, if it can. */
function resolveRegionCode(values) {
  if (values.regionCode) return values.regionCode;
  const stored = String(values.region || "").trim().toLowerCase();
  if (!stored) return "";
  const match = DEPED_REGIONS.find(
    (r) => r.name.toLowerCase() === stored || r.code.toLowerCase() === stored
  );
  return match ? match.code : "";
}

export default function SchoolIdentityFields({
  values,
  onChange,
  inputClass = DEFAULT_INPUT_CLASS,
  labelClass = DEFAULT_LABEL_CLASS,
}) {
  const idPrefix = useId();
  const [suggestions, setSuggestions] = useState({ districts: [], schools: [] });

  // School-maintained combobox suggestions. A missing doc or a permission
  // error just means no suggestions — the fields stay free text either way,
  // so this must never surface an error to the user.
  useEffect(() => {
    let cancelled = false;
    getDoc(doc(db, "referenceData", "schoolDirectory"))
      .then((snap) => {
        if (cancelled || !snap.exists()) return;
        const data = snap.data() || {};
        setSuggestions({
          districts: Array.isArray(data.districts) ? data.districts : [],
          schools: Array.isArray(data.schools) ? data.schools : [],
        });
      })
      .catch(() => {
        // No suggestions available; the comboboxes still accept typed values.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const regionCode = resolveRegionCode(values);
  const divisions = getDivisionsForRegion(regionCode);
  const storedDivision = String(values.divisionOffice || "").trim();
  // An existing division that isn't in the current directory must still show
  // as selected rather than silently resetting to blank.
  const divisionIsListed = !storedDivision || divisions.includes(storedDivision);

  function handleRegionChange(code) {
    if (code === OTHER) {
      onChange("regionCode", "");
      onChange("region", "");
      return;
    }
    onChange("regionCode", code);
    onChange("region", code ? getRegionName(code) : "");
    // Divisions are region-specific, so a region change invalidates the
    // current division rather than leaving a mismatched pair on the forms.
    onChange("divisionOffice", "");
  }

  return (
    <>
      <label className={labelClass}>
        School Name
        <input
          className={inputClass}
          list={`${idPrefix}-schools`}
          value={values.schoolName || ""}
          onChange={(e) => onChange("schoolName", e.target.value)}
          placeholder="Start typing to search saved schools"
        />
        <datalist id={`${idPrefix}-schools`}>
          {suggestions.schools.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </label>

      <label className={labelClass}>
        School ID
        <input
          className={inputClass}
          inputMode="numeric"
          value={values.schoolId || ""}
          onChange={(e) => onChange("schoolId", e.target.value)}
          placeholder="e.g. 303105"
        />
        <span className="text-[11px] font-normal text-gray-400 dark:text-gray-500">
          Your DepEd School ID. Printed in the header of SF1, SF2, and the SF8 nutrition report.
        </span>
      </label>

      <label className={labelClass}>
        School Address
        <input
          className={inputClass}
          value={values.schoolAddress || ""}
          onChange={(e) => onChange("schoolAddress", e.target.value)}
        />
      </label>

      <label className={labelClass}>
        Region
        <select
          className={inputClass}
          value={regionCode || (values.region ? OTHER : "")}
          onChange={(e) => handleRegionChange(e.target.value)}
        >
          <option value="">Select a region…</option>
          {DEPED_REGIONS.map((r) => (
            <option key={r.code} value={r.code}>
              {r.name}
            </option>
          ))}
          <option value={OTHER}>Not listed / enter manually</option>
        </select>
        {!regionCode && values.region !== undefined && (
          <input
            className={inputClass}
            value={values.region || ""}
            onChange={(e) => onChange("region", e.target.value)}
            placeholder="Region name"
          />
        )}
      </label>

      <label className={labelClass}>
        Division Office
        {regionCode && divisions.length > 0 ? (
          <>
            <select
              className={inputClass}
              value={divisionIsListed ? storedDivision : OTHER}
              onChange={(e) =>
                onChange("divisionOffice", e.target.value === OTHER ? "" : e.target.value)
              }
            >
              <option value="">Select a division…</option>
              {divisions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
              <option value={OTHER}>Not listed / enter manually</option>
            </select>
            {!divisionIsListed && (
              <input
                className={inputClass}
                value={storedDivision}
                onChange={(e) => onChange("divisionOffice", e.target.value)}
                placeholder="Division office name"
              />
            )}
          </>
        ) : (
          <input
            className={inputClass}
            value={values.divisionOffice || ""}
            onChange={(e) => onChange("divisionOffice", e.target.value)}
            placeholder="Select a region first to pick from the list"
          />
        )}
      </label>

      <label className={labelClass}>
        Division Name (full)
        <input
          className={inputClass}
          value={values.divisionName || ""}
          onChange={(e) => onChange("divisionName", e.target.value)}
          placeholder="Department of Education - Division of Mandaue City"
        />
        <span className="text-[11px] font-normal text-gray-400 dark:text-gray-500">
          The full division line printed on certificates, separate from the Division Office above.
        </span>
      </label>

      <label className={labelClass}>
        District
        <input
          className={inputClass}
          list={`${idPrefix}-districts`}
          value={values.district || ""}
          onChange={(e) => onChange("district", e.target.value)}
          placeholder="e.g. Mandaue City District II"
        />
        <datalist id={`${idPrefix}-districts`}>
          {suggestions.districts.map((d) => (
            <option key={d} value={d} />
          ))}
        </datalist>
      </label>

      <label className={labelClass}>
        Municipality / City / Province
        <input
          className={inputClass}
          value={values.municipalityCityProvince || ""}
          onChange={(e) => onChange("municipalityCityProvince", e.target.value)}
        />
      </label>

      <label className={labelClass}>
        Latitude
        <input
          className={inputClass}
          inputMode="decimal"
          value={values.latitude ?? ""}
          onChange={(e) => onChange("latitude", e.target.value)}
          placeholder="10.3554"
        />
        <span className="text-[11px] font-normal text-gray-400 dark:text-gray-500">
          Used for the local weather card and the nearby-earthquake radius.
        </span>
      </label>

      <label className={labelClass}>
        Longitude
        <input
          className={inputClass}
          inputMode="decimal"
          value={values.longitude ?? ""}
          onChange={(e) => onChange("longitude", e.target.value)}
          placeholder="123.935"
        />
        <span className="text-[11px] font-normal text-gray-400 dark:text-gray-500">
          Find both on Google Maps: right-click your school, then click the coordinates to copy.
        </span>
      </label>
    </>
  );
}
