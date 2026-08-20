// src/pages/ParentPortal.jsx
// Read-only dashboard for verified parent accounts.
// Parents can only see the learner record(s) explicitly linked to their
// Firebase Auth UID via the parentLinks/{uid} Firestore document.
// No edit, delete, or navigation to staff tools is possible from this view.

import { useState, useEffect } from "react";
import { doc, getDoc, collection, query, where, getDocs, documentId } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { db, auth } from "../firebase";
import {
  GraduationCap,
  User,
  BookOpen,
  ClipboardList,
  LogOut,
  AlertCircle,
  Loader2,
  Heart,
  Calendar,
  School,
} from "lucide-react";

// Helper: convert a Firestore Timestamp or raw date string to a readable date.
function formatDate(value) {
  if (!value) return "—";
  try {
    if (typeof value.toDate === "function") return value.toDate().toLocaleDateString("en-PH");
    return new Date(value).toLocaleDateString("en-PH");
  } catch {
    return String(value);
  }
}

function InfoRow({ label, value }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider sm:w-44 flex-shrink-0">
        {label}
      </span>
      <span className="text-sm text-gray-800 dark:text-gray-200 font-medium">
        {value || "—"}
      </span>
    </div>
  );
}

function PlaceholderSection({ icon: Icon, title, description }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-card">
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-4">
        <Icon className="text-primary" size={18} />
        {title}
      </h2>
      <div className="flex flex-col items-center justify-center py-8 text-center text-gray-400 dark:text-gray-600">
        <Icon size={36} className="mb-3 opacity-30" />
        <p className="text-sm font-medium">{description}</p>
        <span className="mt-1 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-semibold">
          Coming Soon
        </span>
      </div>
    </div>
  );
}

export default function ParentPortal({ user }) {
  const [learners, setLearners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user?.uid) return;

    let active = true;

    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        // 1. Fetch the parentLinks document for this parent's UID
        const linkSnap = await getDoc(doc(db, "parentLinks", user.uid));
        if (!active) return;

        if (!linkSnap.exists()) {
          setError("No learner has been linked to your account yet. Please contact the school's ICT Coordinator.");
          setLoading(false);
          return;
        }

        const link = linkSnap.data();

        const linkedIds = link.learnerIds || [];
        if (linkedIds.length === 0) {
          setLearners([]);
          setLoading(false);
          return;
        }

        // 2. Fetch the linked learner documents (Firestore `in` query, max 30 per the rules)
        const learnersQuery = query(
          collection(db, "learners"),
          where(documentId(), "in", linkedIds)
        );
        const learnersSnap = await getDocs(learnersQuery);
        if (!active) return;

        setLearners(learnersSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        if (!active) return;
        console.error("ParentPortal load error:", err);
        setError("Unable to load learner information. Please check your connection and try again.");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();
    return () => { active = false; };
  }, [user?.uid]);

  async function handleLogout() {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Logout error:", err);
    }
  }

  return (
    <div
      className="min-h-screen bg-gray-50 dark:bg-gray-950 font-sans text-gray-900 dark:text-gray-100"
      style={{ paddingBottom: "48px" }}
    >
      {/* Top Bar */}
      <header
        style={{
          background: "linear-gradient(135deg, rgb(var(--color-primary)) 0%, rgb(var(--color-primary-dark)) 100%)",
          padding: "0 24px",
          height: "60px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <GraduationCap size={22} color="rgb(var(--color-accent-light))" />
          <span style={{ color: "#ffffff", fontWeight: 700, fontSize: "16px", letterSpacing: "0.02em" }}>
            LIKHA-SIS
          </span>
          <span
            style={{
              backgroundColor: "rgb(var(--color-accent))",
              color: "#ffffff",
              fontSize: "10px",
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: "12px",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            Parent View
          </span>
        </div>
        <button
          onClick={handleLogout}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            color: "#cbd5e1",
            background: "none",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: "8px",
            padding: "6px 12px",
            fontSize: "13px",
            cursor: "pointer",
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.1)";
            e.currentTarget.style.color = "#ffffff";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.color = "#cbd5e1";
          }}
          title="Log out"
        >
          <LogOut size={15} />
          Log Out
        </button>
      </header>

      <main style={{ maxWidth: "800px", margin: "32px auto", padding: "0 16px" }}>
        {/* Welcome */}
        <div className="mb-6">
          <h1 className="font-display text-xl font-semibold text-gray-900 dark:text-gray-100">
            Welcome, {user?.email || "Parent"}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Tingub National High School — Parent Progress Portal
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Loader2 size={32} className="animate-spin mb-3" />
            <p className="text-sm">Loading learner information…</p>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 rounded-xl p-5 flex items-start gap-3">
            <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Learner Cards */}
        {!loading && !error && learners.length === 0 && (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-8 text-center text-gray-400 dark:text-gray-600">
            <School size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No learner records found for your account.</p>
            <p className="text-xs mt-1">Contact the school's ICT Coordinator if you believe this is an error.</p>
          </div>
        )}

        {!loading && !error && learners.map((learner) => {
          const fullName = [learner.lastName, learner.firstName, learner.middleName]
            .filter(Boolean)
            .join(", ");

          return (
            <div key={learner.id} className="space-y-4 mb-8">
              {/* Learner Identity Card */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-card">
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-4 border-b border-gray-100 dark:border-gray-800 pb-3">
                  <User className="text-primary" size={18} />
                  Learner Profile
                </h2>
                <div className="space-y-0">
                  <InfoRow label="Full Name" value={fullName || `${learner.firstName || ""} ${learner.lastName || ""}`.trim()} />
                  <InfoRow label="LRN" value={learner.lrn} />
                  <InfoRow label="Sex" value={learner.sex} />
                  <InfoRow label="Birthdate" value={formatDate(learner.birthdate)} />
                  <InfoRow label="Age" value={learner.age} />
                </div>
              </div>

              {/* Enrollment Card */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-card">
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-4 border-b border-gray-100 dark:border-gray-800 pb-3">
                  <Calendar className="text-primary" size={18} />
                  Current Enrollment
                </h2>
                <div className="space-y-0">
                  <InfoRow label="School Year" value={learner.schoolYear} />
                  <InfoRow label="Grade Level" value={learner.gradeLevel} />
                  <InfoRow label="Section" value={learner.section} />
                  <InfoRow label="Learning Modality" value={learner.learningModality} />
                </div>
              </div>

              {/* Grades — Placeholder */}
              <PlaceholderSection
                icon={BookOpen}
                title="Grades & Academic Progress"
                description="Grade information will be available here once the academic records feature is released."
              />

              {/* Attendance — Placeholder */}
              <PlaceholderSection
                icon={ClipboardList}
                title="Attendance Record"
                description="Attendance summaries will be available here once the attendance feature is released."
              />

              {/* Nutrition — Placeholder */}
              <PlaceholderSection
                icon={Heart}
                title="Health & Nutrition Status"
                description="Nutrition status reports will be available here in a future update."
              />
            </div>
          );
        })}
      </main>
    </div>
  );
}
