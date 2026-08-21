import { canAccessPage } from './pageAccess.js';
import useAcademicCalendar from './hooks/useAcademicCalendar';
import useTeacherScope from './hooks/useTeacherScope';
import useSchoolConfig from './hooks/useSchoolConfig';
import { getDashboardCapabilities, getQuickActions } from './utils/dashboardRoleConfig.js';
import Button from './components/Button.jsx';
import { SectionCard, EmptyState } from './components/dashboard/primitives.jsx';
import DashboardHeader from './components/dashboard/DashboardHeader.jsx';
import CommonPanel from './components/dashboard/CommonPanel.jsx';
import {
  AdvisoryClassCard,
  AdviserAttendanceCard,
  AdviserLardoCard,
  AdviserNutritionCard,
  SchoolFormsQuickActions,
} from './components/dashboard/AdviserWidgets.jsx';
import { TeachingAssignmentsCard, MyClassesList, ClassRecordOverview } from './components/dashboard/SubjectTeacherWidgets.jsx';
import { SchoolOverviewCard } from './components/dashboard/PrincipalWidgets.jsx';
import { UserAccountsCard, AssignmentHealthCard, ImportsStatusCard, SystemConfigCard } from './components/dashboard/IctWidgets.jsx';
import { MonitoringOverviewCard } from './components/dashboard/SmeaWidgets.jsx';
import { GuidanceSupportCard } from './components/dashboard/GuidanceWidgets.jsx';
import { MasterTeacherOverviewCard } from './components/dashboard/MasterTeacherWidgets.jsx';

// Pages already reachable through a role-specific widget's own link/button --
// excluded from the generic Quick Actions row so nothing is offered twice
// (spec §12: "do not display the same metric/action twice").
function excludedQuickActionPages(capabilities) {
  const excluded = new Set();
  if (capabilities.isAdviser) {
    ['sf1', 'sf2', 'sf4', 'reportCard', 'sf10Generate'].forEach((p) => excluded.add(p));
    if (capabilities.lardoOverview) excluded.add('lardoTracking');
  }
  if (capabilities.isSubjectTeacher) excluded.add('classRecord');
  return excluded;
}

function Dashboard({
  user,
  userRoles,
  goToSF1,
  goToSF2,
  goToViewLearners,
  goToCertificates,
  goToIDGenerator,
  goToLardo,
  goToSchoolSettings,
  onNavigate,
}) {
  const capabilities = getDashboardCapabilities(userRoles);
  const canEditSchoolSettings = canAccessPage('schoolSettings', userRoles);

  // Live school year options come from School Settings > Academic Calendar
  // (layered over the built-in fallback) via the shared hook.
  const { calendar, schoolYears, loading: calendarLoading } = useAcademicCalendar();
  const currentSchoolYear = schoolYears?.[0] || null;

  // The canonical adviser/subject-teacher scope, derived from
  // users/{uid}.assignments[] -- this is the SAME hook every School
  // Forms/Class Record page already uses. Its own reads are the signed-in
  // user's own profile doc and their own adviserId-scoped schedule lookup,
  // not another learner's data, so calling it here (even for roles that
  // never render an adviser/subject-teacher widget) does not violate the
  // "no learner/private queries for unauthorized roles" requirement --
  // every widget that DOES read learners/attendance/lardoRecords/
  // nutritionRecords is a separate component mounted only when the
  // matching capability is true, and React never runs an unmounted
  // component's effect.
  const teacherScope = useTeacherScope(user, currentSchoolYear);
  const { config: schoolConfig } = useSchoolConfig();

  const displayName =
    teacherScope.profile?.fullName || user?.displayName || (user?.email ? user.email.split('@')[0] : 'there');

  function navigate(page, payload) {
    if (page === 'sf1' && goToSF1) return goToSF1();
    if (page === 'sf2' && goToSF2) return goToSF2();
    if (page === 'viewLearners' && goToViewLearners) return goToViewLearners();
    if (page === 'certificates' && goToCertificates) return goToCertificates();
    if (page === 'idGenerator' && goToIDGenerator) return goToIDGenerator();
    if (page === 'lardoTracking' && goToLardo) return goToLardo();
    if (page === 'schoolSettings' && goToSchoolSettings) return goToSchoolSettings();
    return onNavigate?.(page, payload);
  }

  const excluded = excludedQuickActionPages(capabilities);
  const quickActions = getQuickActions(userRoles).filter((a) => !excluded.has(a.page));
  const hasAnyWidget = Object.values(capabilities).some(Boolean);

  return (
    <div className="font-sans text-gray-900 dark:text-gray-100">
      <DashboardHeader
        displayName={displayName}
        userRoles={userRoles}
        adviser={teacherScope.adviser}
        schoolYear={currentSchoolYear}
        calendar={calendar}
        calendarLoading={calendarLoading}
      />

      <section className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 mt-6">
        <div className="space-y-4">
          {capabilities.schoolOverview && <SchoolOverviewCard schoolYear={currentSchoolYear} />}

          {capabilities.systemOverview && (
            <>
              <UserAccountsCard />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <AssignmentHealthCard />
                <ImportsStatusCard />
              </div>
              <SystemConfigCard schoolConfigReady={!!schoolConfig?.schoolName} schoolYearCount={schoolYears.length} />
            </>
          )}

          {capabilities.smeaOverview && <MonitoringOverviewCard schoolYear={currentSchoolYear} />}

          {capabilities.guidanceOverview && <GuidanceSupportCard schoolYear={currentSchoolYear} />}

          {capabilities.masterTeacherOverview && (
            <div className="flex flex-wrap gap-3">
              <MasterTeacherOverviewCard schoolYear={currentSchoolYear} />
            </div>
          )}

          {capabilities.isAdviser && (
            <>
              <AdvisoryClassCard adviser={teacherScope.adviser} />
              <AdviserAttendanceCard adviser={teacherScope.adviser} />
              {capabilities.lardoOverview && <AdviserLardoCard adviser={teacherScope.adviser} onNavigate={navigate} />}
              {capabilities.nutritionOverview && (
                <AdviserNutritionCard adviser={teacherScope.adviser} schoolYear={currentSchoolYear} />
              )}
              <SchoolFormsQuickActions userRoles={userRoles} onNavigate={navigate} goToSF1={goToSF1} goToSF2={goToSF2} />
            </>
          )}

          {capabilities.isSubjectTeacher && (
            <>
              <TeachingAssignmentsCard subjectMap={teacherScope.subjectMap} classRecordCombos={teacherScope.classRecordCombos} />
              <MyClassesList classRecordHierarchy={teacherScope.classRecordHierarchy} />
              <ClassRecordOverview
                classRecordCombos={teacherScope.classRecordCombos}
                schoolYear={currentSchoolYear}
                onNavigate={navigate}
              />
            </>
          )}

          {!hasAnyWidget && quickActions.length === 0 && (
            <EmptyState text="No dashboard content is available for your account yet. Contact your ICT Coordinator if this seems wrong." />
          )}

          {quickActions.length > 0 && (
            <SectionCard>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Quick Actions</h4>
              <div className="flex flex-wrap gap-2 mt-3">
                {quickActions.map((a) => (
                  <Button key={a.page} variant="secondary" size="small" onClick={() => navigate(a.page)}>
                    {a.label}
                  </Button>
                ))}
              </div>
            </SectionCard>
          )}
        </div>

        <CommonPanel onOpenSettings={canEditSchoolSettings ? goToSchoolSettings : undefined} />
      </section>
    </div>
  );
}

export default Dashboard;
