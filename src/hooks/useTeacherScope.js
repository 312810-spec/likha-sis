// src/hooks/useTeacherScope.js
// Canonical hook resolving a teacher's advisory section AND subject-teacher
// assignments into one scope object, so every adviser/subject-teacher-facing
// form filters against a single source instead of re-deriving it.

import { useMemo } from "react";
import useMyAdvisorySectionRaw from "./useMyAdvisorySection";
import { useUserProfile } from "./useUserProfile";
import { buildTeacherScope } from "../utils/teacherScope";

export default function useTeacherScope(user, schoolYear) {
  const { advisorySection, loading: advisoryLoading } = useMyAdvisorySectionRaw(
    user?.uid,
    schoolYear
  );
  const { profile, loading: profileLoading } = useUserProfile(user);

  const scope = useMemo(
    () => buildTeacherScope({ advisorySection, assignments: profile?.assignments }),
    [advisorySection, profile?.assignments]
  );

  return { ...scope, advisorySection, loading: advisoryLoading || profileLoading };
}
