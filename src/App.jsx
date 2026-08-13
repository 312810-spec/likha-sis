// src/App.jsx
// Traffic controller: now uses DashboardShell to wrap all authenticated pages
// with Sidebar navigation while preserving all existing functionality.

import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import Login from "./Login";
import DashboardShell from "./components/DashboardShell";
import Dashboard from "./Dashboard";
import SF1 from "./SF1";
import SF2 from "./SF2";
import ClassRecord from "./ClassRecord";
import ConsolidatedGrades from "./ConsolidatedGrades";
import ReportCard from "./ReportCard";
import ViewLearners from "./ViewLearners";
import LardoTracking from "./LardoTracking";
import CertificateGenerator from "./CertificateGenerator";
import IDGenerator from "./IDGenerator";
import SMEAEnrollment from "./SMEAEnrollment";
import ImportCenter from "./pages/ImportCenter";
import SF1Importer from "./pages/SF1Importer";
import SF10Importer from "./pages/SF10Importer";
import UserManagement from "./pages/UserManagement";
import NutritionStatus from "./NutritionStatus";
import TransfersLog from "./TransfersLog";
import { canAccessPage } from "./pageAccess.js";
import { useUserProfile } from "./hooks/useUserProfile.js";

function App() {
  const [user, setUser] = useState(null);
  const [isChecking, setIsChecking] = useState(true);
  const [currentPage, setCurrentPage] = useState("dashboard");

  const { profile, loading: profileLoading } = useUserProfile(user);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsChecking(false);
    });
    return () => unsubscribe();
  }, []);

  if (isChecking || (user && profileLoading)) {
    return <p style={{ textAlign: "center", marginTop: "80px" }}>Loading...</p>;
  }

  if (!user) {
    return <Login />;
  }

  // Determine page title and content
  let pageTitle;
  let pageContent;

  const userRoles = profile?.roles;
  const hasAccess = canAccessPage(currentPage, userRoles);

  if (!hasAccess) {
    pageTitle = "Access Restricted";
    pageContent = (
      <div style={{ textAlign: "center", marginTop: "80px", padding: "0 16px" }}>
        <p style={{ fontSize: "16px", color: "#374151", marginBottom: "16px" }}>
          You don't have access to this page. Contact your ICT Coordinator if you believe this is a mistake.
        </p>
        <button
          onClick={() => setCurrentPage("dashboard")}
          style={{
            padding: "8px 16px",
            backgroundColor: "#1e3a8a",
            color: "#ffffff",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: "500",
          }}
        >
          Go to Dashboard
        </button>
      </div>
    );
  } else {
    switch (currentPage) {
      case "userManagement":
        pageTitle = "User Management";
        pageContent = <UserManagement user={user} />;
        break;
      case "sf1":
        pageTitle = "School Form 1 - Learner Information";
        pageContent = <SF1 user={user} goBack={() => setCurrentPage("dashboard")} />;
        break;
      case "sf2":
        pageTitle = "School Form 2 - Attendance";
        pageContent = <SF2 user={user} goBack={() => setCurrentPage("dashboard")} />;
        break;
      case "classRecord":
        pageTitle = "Class Record";
        pageContent = <ClassRecord user={user} goBack={() => setCurrentPage("dashboard")} />;
        break;
      case "consolidatedGrades":
        pageTitle = "Consolidated Grades";
        pageContent = <ConsolidatedGrades user={user} goBack={() => setCurrentPage("dashboard")} />;
        break;
      case "reportCard":
        pageTitle = "Report Card (SF9)";
        pageContent = <ReportCard user={user} goBack={() => setCurrentPage("dashboard")} />;
        break;
      case "viewLearners":
        pageTitle = "View Learners";
        pageContent = (
          <ViewLearners
            user={user}
            goBack={() => setCurrentPage("dashboard")}
            userRoles={userRoles}
          />
        );
        break;
      case "lardoTracking":
        pageTitle = "LARDO Tracking";
        pageContent = <LardoTracking user={user} goBack={() => setCurrentPage("dashboard")} />;
        break;
      case "nutritionStatus":
        pageTitle = "Nutrition Status";
        pageContent = <NutritionStatus user={user} goBack={() => setCurrentPage("dashboard")} />;
        break;
      case "transfersLog":
        pageTitle = "Transfers Log";
        pageContent = <TransfersLog user={user} goBack={() => setCurrentPage("dashboard")} />;
        break;
      case "certificates":
        pageTitle = "Certificates";
        pageContent = <CertificateGenerator user={user} goBack={() => setCurrentPage("dashboard")} />;
        break;
      case "idGenerator":
        pageTitle = "ID Generator";
        pageContent = <IDGenerator user={user} goBack={() => setCurrentPage("dashboard")} />;
        break;
      case "smeaEnrollment":
        pageTitle = "SMEA — Enrollment";
        pageContent = <SMEAEnrollment />;
        break;
      case "importCenter":
        pageTitle = "Import Center";
        pageContent = <ImportCenter onNavigate={setCurrentPage} />;
        break;
      case "sf1Import":
        pageTitle = "Import Center — SF1 Bulk Import";
        pageContent = <SF1Importer user={user} />;
        break;
      case "sf10Import":
        pageTitle = "Import Center — SF10 Import";
        pageContent = <SF10Importer user={user} />;
        break;
      default:
        // Dashboard
        pageTitle = "Dashboard";
        pageContent = (
          <Dashboard
            user={user}
            goToSF1={() => setCurrentPage("sf1")}
            goToSF2={() => setCurrentPage("sf2")}
            goToViewLearners={() => setCurrentPage("viewLearners")}
            goToCertificates={() => setCurrentPage("certificates")}
            goToIDGenerator={() => setCurrentPage("idGenerator")}
          />
        );
    }
  }

  return (
    <DashboardShell
      currentPage={currentPage}
      onNavigate={setCurrentPage}
      user={user}
      pageTitle={pageTitle}
      userRoles={userRoles}
    >
      {pageContent}
    </DashboardShell>
  );
}

export default App;