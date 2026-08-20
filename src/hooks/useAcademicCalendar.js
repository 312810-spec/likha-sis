// src/hooks/useAcademicCalendar.js
// Reads the school-edited academic calendar (School Settings > Academic
// Calendar, stored at settings/schoolConfig.academicCalendar) layered over the
// built-in SY 2026-2027 fallback in academicCalendar.js.
//
// Components must read school years through this hook rather than importing
// the static `academicCalendar` object, otherwise edits made in Settings never
// reach the UI.

import { useMemo } from "react";
import useSchoolConfig from "./useSchoolConfig";
import { mergeAcademicCalendar, listSchoolYears } from "../academicCalendar";

export default function useAcademicCalendar() {
  const { config, loading } = useSchoolConfig();
  const stored = config?.academicCalendar;

  const calendar = useMemo(() => mergeAcademicCalendar(stored), [stored]);
  const schoolYears = useMemo(() => listSchoolYears(calendar), [calendar]);

  return { calendar, schoolYears, loading };
}
