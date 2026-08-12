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
import ViewLearners from "./ViewLearners";
import CertificateGenerator from "./CertificateGenerator";
import IDGenerator from "./IDGenerator";
import SMEAEnrollment from "./SMEAEnrollment";
import ImportCenter from "./pages/ImportCenter";
import SF1Importer from "./pages/SF1Importer";
import SF10Importer from "./pages/SF10Importer";

function App() {
  const [user, setUser] = useState(null);
  const [isChecking, setIsChecking] = useState(true);
  const [currentPage, setCurrentPage] = useState("dashboard");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsChecking(false);
    });
    return () => unsubscribe();
  }, []);

  if (isChecking) {
    return <p style={{ textAlign: "center", marginTop: "80px" }}>Loading...</p>;
  }

  if (!user) {
    return <Login />;
  }

  // Determine page title and content
  let pageTitle;
  let pageContent;

  switch (currentPage) {
    case "sf1":
      pageTitle = "School Form 1 - Learner Information";
      pageContent = <SF1 user={user} goBack={() => setCurrentPage("dashboard")} />;
      break;
    case "sf2":
      pageTitle = "School Form 2 - Attendance";
      pageContent = <SF2 user={user} goBack={() => setCurrentPage("dashboard")} />;
      break;
    case "viewLearners":
      pageTitle = "View Learners";
      pageContent = <ViewLearners user={user} goBack={() => setCurrentPage("dashboard")} />;
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

  return (
    <DashboardShell
      currentPage={currentPage}
      onNavigate={setCurrentPage}
      user={user}
      pageTitle={pageTitle}
    >
      {pageContent}
    </DashboardShell>
  );
}

export default App;