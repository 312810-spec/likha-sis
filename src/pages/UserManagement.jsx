import { useState, useEffect, Fragment } from "react";
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { sendPasswordResetEmail } from "firebase/auth";
import {
  UserPlus,
  Users,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Shield,
  Pencil,
  KeyRound,
  Ban,
  Power,
  X,
  Heart,
  Link2,
  Link2Off,
  Eye,
  IdCard,
} from "lucide-react";
import { db, auth } from "../firebase";
import { createTeacherAccount } from "../firebaseAdmin";
import { ROLE_OPTIONS, ROLE_LABELS } from "../utils/roles.js";
import useSchoolConfig from "../hooks/useSchoolConfig";
import useAvailableSections from "../hooks/useAvailableSections";
import useAcademicCalendar from "../hooks/useAcademicCalendar";
import {
  isAccountActive,
  isEditableUserRow,
  validateUserEditForm,
} from "../utils/userAccountManagement.js";

export default function UserManagement({ user }) {
  const { config } = useSchoolConfig();
  const gradeOptions = (
    config?.gradeLevelsOffered || ["Grade 4", "Grade 5", "Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10"]
  ).map((g) => g.replace(/^Grade\s+/i, ""));
  const { schoolYears } = useAcademicCalendar();
  const currentSchoolYear = schoolYears[0] || "2026-2027";

  // Form State
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [assignments, setAssignments] = useState([]);

  // Assignment Mini-Form State
  const [assignRole, setAssignRole] = useState("subjectTeacher");
  const [assignSubject, setAssignSubject] = useState("");
  const [assignGrade, setAssignGrade] = useState("");
  const [assignSection, setAssignSection] = useState("");
  const { sections: assignSectionOptions } = useAvailableSections(
    assignGrade ? `Grade ${assignGrade}` : "",
    currentSchoolYear
  );

  // Status & Feedback
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Users Directory List
  const [userList, setUserList] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Edit User Panel State
  const [editingUserId, setEditingUserId] = useState(null);
  const [editFullName, setEditFullName] = useState("");
  const [editRoles, setEditRoles] = useState([]);
  const [editAssignments, setEditAssignments] = useState([]);
  const [editAssignRole, setEditAssignRole] = useState("subjectTeacher");
  const [editAssignSubject, setEditAssignSubject] = useState("");
  const [editAssignGrade, setEditAssignGrade] = useState("");
  const [editAssignSection, setEditAssignSection] = useState("");
  const { sections: editAssignSectionOptions } = useAvailableSections(
    editAssignGrade ? `Grade ${editAssignGrade}` : "",
    currentSchoolYear
  );
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [rowActionUserId, setRowActionUserId] = useState(null);
  const [viewingUser, setViewingUser] = useState(null);

  // ---- Parent Account Provisioning State ----
  const [parentName, setParentName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentPassword, setParentPassword] = useState("");
  const [parentLearnerDocId, setParentLearnerDocId] = useState("");
  const [parentLinks, setParentLinks] = useState([]);
  const [loadingParentLinks, setLoadingParentLinks] = useState(true);
  const [parentSubmitting, setParentSubmitting] = useState(false);
  const [parentSuccess, setParentSuccess] = useState("");
  const [parentError, setParentError] = useState("");
  const [revokingParentId, setRevokingParentId] = useState(null);

  // Fetch users function for manual refresh (e.g. after user creation)
  async function refreshUsers() {
    try {
      const snap = await getDocs(collection(db, "users"));
      const usersData = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setUserList(usersData);
    } catch (err) {
      console.error("Failed to fetch users:", err);
    } finally {
      setLoadingUsers(false);
    }
  }

  // Fetch parent links for the Parent Accounts panel
  // Split in two so the mount effect can load without setting state
  // synchronously inside the effect body (which triggers cascading renders).
  // loadingParentLinks already starts true, so the initial load does not need
  // to raise the flag -- only a user-triggered refresh does.
  async function fetchParentLinks() {
    try {
      const snap = await getDocs(collection(db, "parentLinks"));
      setParentLinks(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Failed to fetch parentLinks:", err);
    } finally {
      setLoadingParentLinks(false);
    }
  }

  async function refreshParentLinks() {
    setLoadingParentLinks(true);
    await fetchParentLinks();
  }

  // Initial load on mount
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const snap = await getDocs(collection(db, "users"));
        if (active) {
          const usersData = snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }));
          setUserList(usersData);
        }
      } catch (err) {
        console.error("Failed to fetch users:", err);
      } finally {
        if (active) {
          setLoadingUsers(false);
        }
      }
    })();
    // Also load parent links, in its own async IIFE so it runs in parallel with
    // the users fetch above and no setState happens synchronously in the effect
    // body. fetchParentLinks (not refreshParentLinks) because
    // loadingParentLinks already starts true on mount.
    (async () => {
      if (active) await fetchParentLinks();
    })();
    return () => {
      active = false;
    };
  }, []);

  // Toggle role selection and sync default assignment role
  function handleRoleToggle(roleId) {
    setSelectedRoles((prev) => {
      const next = prev.includes(roleId)
        ? prev.filter((r) => r !== roleId)
        : [...prev, roleId];

      const hasSubject = next.includes("subjectTeacher");
      const hasAdviser = next.includes("adviser");

      if (hasSubject && !hasAdviser) {
        setAssignRole("subjectTeacher");
      } else if (hasAdviser && !hasSubject) {
        setAssignRole("adviser");
      }

      return next;
    });
  }

  // Add assignment to local list
  function handleAddAssignment(e) {
    e.preventDefault();
    setErrorMessage("");

    if (assignRole === "subjectTeacher" && !assignSubject.trim()) {
      setErrorMessage("Please enter a subject for the subject teacher assignment.");
      return;
    }
    if (!assignGrade.trim() || !assignSection.trim()) {
      setErrorMessage("Please enter grade level and section for the assignment.");
      return;
    }

    const newAssignment = {
      role: assignRole,
      subject: assignRole === "subjectTeacher" ? assignSubject.trim() : "",
      gradeLevel: assignGrade.trim(),
      section: assignSection.trim(),
    };

    setAssignments((prev) => [...prev, newAssignment]);
    setAssignSubject("");
    setAssignGrade("");
    setAssignSection("");
  }

  // Remove assignment from local list
  function handleRemoveAssignment(index) {
    setAssignments((prev) => prev.filter((_, i) => i !== index));
  }

  // ---- Edit / Reset Password / Deactivate (User Directory row actions) ----

  function handleStartEdit(targetUser) {
    setSuccessMessage("");
    setErrorMessage("");
    setEditingUserId(targetUser.id);
    setEditFullName(targetUser.fullName || "");
    setEditRoles(Array.isArray(targetUser.roles) ? [...targetUser.roles] : []);
    setEditAssignments(Array.isArray(targetUser.assignments) ? [...targetUser.assignments] : []);
    setEditAssignSubject("");
    setEditAssignGrade("");
    setEditAssignSection("");
  }

  function handleCancelEdit() {
    setEditingUserId(null);
  }

  function handleEditRoleToggle(roleId) {
    setEditRoles((prev) => {
      const next = prev.includes(roleId) ? prev.filter((r) => r !== roleId) : [...prev, roleId];
      const hasSubject = next.includes("subjectTeacher");
      const hasAdviser = next.includes("adviser");
      if (hasSubject && !hasAdviser) {
        setEditAssignRole("subjectTeacher");
      } else if (hasAdviser && !hasSubject) {
        setEditAssignRole("adviser");
      }
      return next;
    });
  }

  function handleAddEditAssignment(e) {
    e.preventDefault();
    setErrorMessage("");

    if (editAssignRole === "subjectTeacher" && !editAssignSubject.trim()) {
      setErrorMessage("Please enter a subject for the subject teacher assignment.");
      return;
    }
    if (!editAssignGrade.trim() || !editAssignSection.trim()) {
      setErrorMessage("Please enter grade level and section for the assignment.");
      return;
    }

    setEditAssignments((prev) => [
      ...prev,
      {
        role: editAssignRole,
        subject: editAssignRole === "subjectTeacher" ? editAssignSubject.trim() : "",
        gradeLevel: editAssignGrade.trim(),
        section: editAssignSection.trim(),
      },
    ]);
    setEditAssignSubject("");
    setEditAssignGrade("");
    setEditAssignSection("");
  }

  function handleRemoveEditAssignment(index) {
    setEditAssignments((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    setSuccessMessage("");
    setErrorMessage("");

    const trimmedFullName = editFullName.trim();
    const { valid, error } = validateUserEditForm({ fullName: trimmedFullName, roles: editRoles });
    if (!valid) {
      setErrorMessage(error);
      return;
    }

    setIsSavingEdit(true);
    try {
      await updateDoc(doc(db, "users", editingUserId), {
        fullName: trimmedFullName,
        roles: editRoles,
        assignments: editAssignments,
      });
      setSuccessMessage("User account updated.");
      setEditingUserId(null);
      await refreshUsers();
    } catch (err) {
      console.error("Failed to update user:", err);
      setErrorMessage(err.message || "Failed to update user. Please try again.");
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function handleResetPassword(targetUser) {
    if (!targetUser.email) return;
    setSuccessMessage("");
    setErrorMessage("");
    setRowActionUserId(targetUser.id);
    try {
      await sendPasswordResetEmail(auth, targetUser.email);
      setSuccessMessage(`Password reset email sent to ${targetUser.email}.`);
    } catch (err) {
      console.error("Failed to send password reset email:", err);
      setErrorMessage(err.message || "Failed to send password reset email. Please try again.");
    } finally {
      setRowActionUserId(null);
    }
  }

  async function handleToggleActive(targetUser) {
    const nextActive = !isAccountActive(targetUser);
    setSuccessMessage("");
    setErrorMessage("");
    setRowActionUserId(targetUser.id);
    try {
      await updateDoc(doc(db, "users", targetUser.id), { active: nextActive });
      setSuccessMessage(
        nextActive
          ? `${targetUser.fullName || targetUser.email} reactivated.`
          : `${targetUser.fullName || targetUser.email} deactivated.`
      );
      await refreshUsers();
    } catch (err) {
      console.error("Failed to update account status:", err);
      setErrorMessage(err.message || "Failed to update account status. Please try again.");
    } finally {
      setRowActionUserId(null);
    }
  }

  // Form Submission
  async function handleSubmit(e) {
    e.preventDefault();
    setSuccessMessage("");
    setErrorMessage("");

    const trimmedFullName = fullName.trim();
    const trimmedEmail = email.trim();

    if (!trimmedFullName) {
      setErrorMessage("Full Name is required.");
      return;
    }
    if (!trimmedEmail) {
      setErrorMessage("Email is required.");
      return;
    }
    if (!password || password.length < 6) {
      setErrorMessage("Temporary password must be at least 6 characters long.");
      return;
    }
    if (selectedRoles.length === 0) {
      setErrorMessage("Please select at least one role for the user.");
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Create Auth Account in secondary Firebase app instance
      const uid = await createTeacherAccount(trimmedEmail, password);

      // 2. Write document to Firestore users/{uid}
      await setDoc(doc(db, "users", uid), {
        fullName: trimmedFullName,
        email: trimmedEmail,
        roles: selectedRoles,
        assignments: assignments,
        createdAt: serverTimestamp(),
        createdByEmail: user?.email || "",
      });

      // 3. Clear form state & display success
      setSuccessMessage(`Teacher account created successfully for ${trimmedEmail}!`);
      setFullName("");
      setEmail("");
      setPassword("");
      setSelectedRoles([]);
      setAssignments([]);
      setAssignSubject("");
      setAssignGrade("");
      setAssignSection("");

      // 4. Refresh user table
      await refreshUsers();
    } catch (err) {
      console.error("Account creation failed:", err);
      if (err.code === "auth/email-already-in-use") {
        setErrorMessage("An account with this email address already exists.");
      } else if (err.code === "auth/invalid-email") {
        setErrorMessage("Please enter a valid email address.");
      } else if (err.code === "auth/weak-password") {
        setErrorMessage("Password should be at least 6 characters long.");
      } else {
        setErrorMessage(err.message || "Failed to create teacher account. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const showAssignmentsSection =
    selectedRoles.includes("adviser") || selectedRoles.includes("subjectTeacher");

  return (
    <div className="font-sans text-gray-900 dark:text-gray-100 space-y-6 max-w-none w-full pb-12">
      {/* Header Banner */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-card flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 tracking-tight">
            <Shield className="text-primary" size={24} /> User Management
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Create teacher accounts, set system roles, and configure class/subject assignments.
          </p>
        </div>
      </div>

      {/* Alert Messages */}
      {successMessage && (
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-xl p-4 flex items-center gap-3 animate-fade-in">
          <CheckCircle2 className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" size={20} />
          <span className="text-sm font-medium">{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 rounded-xl p-4 flex items-center gap-3 animate-fade-in">
          <AlertCircle className="text-rose-600 dark:text-rose-400 flex-shrink-0" size={20} />
          <span className="text-sm font-medium">{errorMessage}</span>
        </div>
      )}

      {/* Create User Form Card */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-card">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-3 mb-5">
          <UserPlus className="text-primary" size={18} /> Create New Teacher Account
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Account Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="fullNameInput" className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                id="fullNameInput"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Maria Santos"
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary focus:bg-white dark:focus:bg-gray-800 transition-colors"
                required
              />
            </div>

            <div>
              <label htmlFor="emailInput" className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                Email Address <span className="text-rose-500">*</span>
              </label>
              <input
                id="emailInput"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. msantos@likhasis.com"
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary focus:bg-white dark:focus:bg-gray-800 transition-colors"
                required
              />
            </div>

            <div>
              <label htmlFor="passwordInput" className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                Temporary Password <span className="text-rose-500">*</span>
              </label>
              <input
                id="passwordInput"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary focus:bg-white dark:focus:bg-gray-800 transition-colors"
                required
                minLength={6}
              />
            </div>
          </div>

          {/* Role Checkboxes */}
          <div>
            <span className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
              Roles <span className="text-rose-500">*</span> (Select one or more)
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              {ROLE_OPTIONS.map((role) => {
                const isChecked = selectedRoles.includes(role.id);
                return (
                  <label
                    key={role.id}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                      isChecked
                        ? "bg-primary/10 border-primary text-primary-dark dark:bg-primary-light/10 dark:border-primary-light dark:text-primary-light"
                        : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleRoleToggle(role.id)}
                      className="rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary h-4 w-4"
                    />
                    <span>{role.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Repeatable Assignment Builder (Visible if Adviser or Subject Teacher checked) */}
          {showAssignmentsSection && (
            <div className="bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-4 animate-fade-in">
              <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-2">
                <h3 className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider">
                  Teacher Assignments
                </h3>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Optional: Add class and subject assignments
                </span>
              </div>

              {/* Add Assignment Mini-Form */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                <div>
                  <label htmlFor="assignRoleSelect" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Assignment Role</label>
                  <select
                    id="assignRoleSelect"
                    value={assignRole}
                    onChange={(e) => setAssignRole(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  >
                    {selectedRoles.includes("subjectTeacher") && (
                      <option value="subjectTeacher">Subject Teacher</option>
                    )}
                    {selectedRoles.includes("adviser") && (
                      <option value="adviser">Adviser</option>
                    )}
                  </select>
                </div>

                {assignRole === "subjectTeacher" ? (
                  <div>
                    <label htmlFor="assignSubjectInput" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Subject</label>
                    <input
                      id="assignSubjectInput"
                      type="text"
                      value={assignSubject}
                      onChange={(e) => setAssignSubject(e.target.value)}
                      placeholder="e.g. Filipino"
                      className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                    />
                  </div>
                ) : (
                  <div>
                    <label htmlFor="assignSubjectDisabled" className="block text-xs font-medium text-gray-400 dark:text-gray-500 mb-1">Subject</label>
                    <input
                      id="assignSubjectDisabled"
                      type="text"
                      disabled
                      placeholder="N/A (Adviser)"
                      className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-400 dark:text-gray-500 cursor-not-allowed"
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="assignGradeInput" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Grade Level</label>
                  <select
                    id="assignGradeInput"
                    value={assignGrade}
                    onChange={(e) => { setAssignGrade(e.target.value); setAssignSection(""); }}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  >
                    <option value="">Select grade...</option>
                    {gradeOptions.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="assignSectionInput" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Section</label>
                  <div className="flex gap-2">
                    <select
                      id="assignSectionInput"
                      value={assignSection}
                      onChange={(e) => setAssignSection(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                    >
                      <option value="">Select section...</option>
                      {assignSectionOptions.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleAddAssignment}
                      className="bg-primary text-white px-3 py-2 rounded-lg text-sm font-medium shadow-sm hover:bg-primary-light active:scale-[0.98] transition-all flex items-center gap-1 flex-shrink-0"
                    >
                      <Plus size={16} /> Add
                    </button>
                  </div>
                </div>
              </div>

              {/* List of Added Assignments */}
              {assignments.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Added Assignments:</div>
                  <div className="space-y-2">
                    {assignments.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-2 rounded-lg text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-primary dark:text-primary-light">
                            {ROLE_LABELS[item.role] || item.role}:
                          </span>
                          {item.role === "subjectTeacher" && item.subject && (
                            <span className="bg-primary/10 text-primary-dark dark:bg-primary-light/10 dark:text-primary-light px-2 py-0.5 rounded text-xs font-medium">
                              {item.subject}
                            </span>
                          )}
                          <span className="text-gray-700 dark:text-gray-300">
                            Grade {item.gradeLevel} — Section {item.section}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveAssignment(idx)}
                          className="text-gray-400 hover:text-rose-600 dark:text-gray-500 dark:hover:text-rose-400 transition-colors p-1"
                          title="Remove assignment"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-primary text-white px-5 py-2.5 rounded-lg text-sm font-semibold shadow-sm hover:bg-primary-light active:scale-[0.99] transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>Creating Account...</>
              ) : (
                <>
                  <UserPlus size={18} /> Create Account
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Users Directory Table */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Users className="text-primary" size={18} /> User Directory
          </h2>
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            Total Accounts: {userList.length}
          </span>
        </div>

        {loadingUsers ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">Loading users...</p>
        ) : userList.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
            <p className="text-sm text-gray-500 dark:text-gray-400">No user documents found in the database.</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Create an account above to populate the directory.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  <th className="py-2.5 px-4">Full Name</th>
                  <th className="py-2.5 px-4">Email</th>
                  <th className="py-2.5 px-4">Roles</th>
                  <th className="py-2.5 px-4">Assignments</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {userList.map((u) => {
                  const roleString = Array.isArray(u.roles)
                    ? u.roles.map((r) => ROLE_LABELS[r] || r).join(", ")
                    : "No roles assigned";

                  const assignmentList = Array.isArray(u.assignments) ? u.assignments : [];
                  const active = isAccountActive(u);
                  const canManage = isEditableUserRow(user?.uid, u.id);
                  const isRowBusy = rowActionUserId === u.id;
                  const isEditingThisRow = editingUserId === u.id;
                  const showEditAssignments =
                    editRoles.includes("adviser") || editRoles.includes("subjectTeacher");

                  return (
                    <Fragment key={u.id}>
                      <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                        <td className="py-3 px-4 font-medium text-gray-900 dark:text-gray-100">
                          {u.fullName || "—"}
                        </td>
                        <td className="py-3 px-4 text-gray-600 dark:text-gray-300">{u.email || "—"}</td>
                        <td className="py-3 px-4">
                          <span className="inline-block bg-primary/10 text-primary-dark dark:bg-primary-light/10 dark:text-primary-light text-xs px-2.5 py-1 rounded-md font-medium">
                            {roleString}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs text-gray-600 dark:text-gray-300">
                          {assignmentList.length === 0 ? (
                            <span className="text-gray-400 dark:text-gray-500 italic">None</span>
                          ) : (
                            <div className="space-y-1">
                              {assignmentList.map((a, i) => (
                                <div key={i} className="truncate max-w-xs">
                                  <span className="font-semibold">
                                    {ROLE_LABELS[a.role] || a.role}:
                                  </span>{" "}
                                  {a.subject ? `${a.subject} (` : ""}
                                  Grade {a.gradeLevel} - {a.section}
                                  {a.subject ? ")" : ""}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-block text-xs px-2.5 py-1 rounded-md font-medium ${
                              active
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                                : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                            }`}
                          >
                            {active ? "Active" : "Deactivated"}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setViewingUser(u)}
                              className="p-1.5 text-gray-500 hover:text-primary hover:bg-primary/10 rounded-md transition-colors dark:text-gray-400 dark:hover:text-primary-light"
                              title="View account details"
                            >
                              <Eye size={15} />
                            </button>
                          {canManage ? (
                            <>
                              <button
                                type="button"
                                onClick={() => (isEditingThisRow ? handleCancelEdit() : handleStartEdit(u))}
                                className="p-1.5 text-gray-500 hover:text-primary hover:bg-primary/10 rounded-md transition-colors dark:text-gray-400 dark:hover:text-primary-light"
                                title={isEditingThisRow ? "Cancel edit" : "Edit user"}
                              >
                                {isEditingThisRow ? <X size={15} /> : <Pencil size={15} />}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleResetPassword(u)}
                                disabled={isRowBusy}
                                className="p-1.5 text-gray-500 hover:text-primary hover:bg-primary/10 rounded-md transition-colors disabled:opacity-50 dark:text-gray-400 dark:hover:text-primary-light"
                                title="Send password reset email"
                              >
                                <KeyRound size={15} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleActive(u)}
                                disabled={isRowBusy}
                                className={`p-1.5 rounded-md transition-colors disabled:opacity-50 ${
                                  active
                                    ? "text-gray-500 hover:text-rose-600 hover:bg-rose-50 dark:text-gray-400 dark:hover:text-rose-400"
                                    : "text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 dark:text-gray-400 dark:hover:text-emerald-400"
                                }`}
                                title={active ? "Deactivate account" : "Reactivate account"}
                              >
                                {active ? <Ban size={15} /> : <Power size={15} />}
                              </button>
                            </>
                          ) : (
                            <span className="text-xs text-gray-400 dark:text-gray-500 italic">This is you</span>
                          )}
                          </div>
                        </td>
                      </tr>

                      {isEditingThisRow && (
                        <tr className="bg-gray-50 dark:bg-gray-800/40">
                          <td colSpan={6} className="p-4">
                            <form onSubmit={handleSaveEdit} className="space-y-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <label htmlFor={`editFullName-${u.id}`} className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                                    Full Name
                                  </label>
                                  <input
                                    id={`editFullName-${u.id}`}
                                    type="text"
                                    value={editFullName}
                                    onChange={(e) => setEditFullName(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                                  />
                                </div>
                                <div>
                                  <span className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                                    Email
                                  </span>
                                  <input
                                    type="email"
                                    value={u.email || ""}
                                    disabled
                                    title="Login email can only be changed by the account owner."
                                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                                  />
                                </div>
                              </div>

                              <div>
                                <span className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
                                  Roles
                                </span>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                                  {ROLE_OPTIONS.map((role) => {
                                    const isChecked = editRoles.includes(role.id);
                                    return (
                                      <label
                                        key={role.id}
                                        className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                                          isChecked
                                            ? "bg-primary/10 border-primary text-primary-dark dark:bg-primary-light/10 dark:border-primary-light dark:text-primary-light"
                                            : "bg-white border-gray-200 text-gray-700 hover:bg-gray-100 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
                                        }`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => handleEditRoleToggle(role.id)}
                                          className="rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary h-4 w-4"
                                        />
                                        <span>{role.label}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>

                              {showEditAssignments && (
                                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
                                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                                    <div>
                                      <label htmlFor={`editAssignRole-${u.id}`} className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Assignment Role</label>
                                      <select
                                        id={`editAssignRole-${u.id}`}
                                        value={editAssignRole}
                                        onChange={(e) => setEditAssignRole(e.target.value)}
                                        className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                                      >
                                        {editRoles.includes("subjectTeacher") && (
                                          <option value="subjectTeacher">Subject Teacher</option>
                                        )}
                                        {editRoles.includes("adviser") && (
                                          <option value="adviser">Adviser</option>
                                        )}
                                      </select>
                                    </div>
                                    <div>
                                      <label htmlFor={`editAssignSubject-${u.id}`} className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Subject</label>
                                      <input
                                        id={`editAssignSubject-${u.id}`}
                                        type="text"
                                        value={editAssignSubject}
                                        onChange={(e) => setEditAssignSubject(e.target.value)}
                                        disabled={editAssignRole !== "subjectTeacher"}
                                        placeholder={editAssignRole === "subjectTeacher" ? "e.g. Filipino" : "N/A (Adviser)"}
                                        className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed dark:disabled:bg-gray-800"
                                      />
                                    </div>
                                    <div>
                                      <label htmlFor={`editAssignGrade-${u.id}`} className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Grade Level</label>
                                      <select
                                        id={`editAssignGrade-${u.id}`}
                                        value={editAssignGrade}
                                        onChange={(e) => { setEditAssignGrade(e.target.value); setEditAssignSection(""); }}
                                        className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                                      >
                                        <option value="">Select grade...</option>
                                        {gradeOptions.map((g) => (
                                          <option key={g} value={g}>{g}</option>
                                        ))}
                                      </select>
                                    </div>
                                    <div>
                                      <label htmlFor={`editAssignSection-${u.id}`} className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Section</label>
                                      <div className="flex gap-2">
                                        <select
                                          id={`editAssignSection-${u.id}`}
                                          value={editAssignSection}
                                          onChange={(e) => setEditAssignSection(e.target.value)}
                                          className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                                        >
                                          <option value="">Select section...</option>
                                          {editAssignSectionOptions.map((s) => (
                                            <option key={s} value={s}>{s}</option>
                                          ))}
                                        </select>
                                        <button
                                          type="button"
                                          onClick={handleAddEditAssignment}
                                          className="bg-primary text-white px-3 py-2 rounded-lg text-sm font-medium shadow-sm hover:bg-primary-light active:scale-[0.98] transition-all flex items-center gap-1 flex-shrink-0"
                                        >
                                          <Plus size={16} />
                                        </button>
                                      </div>
                                    </div>
                                  </div>

                                  {editAssignments.length > 0 && (
                                    <div className="space-y-2">
                                      {editAssignments.map((item, idx) => (
                                        <div
                                          key={idx}
                                          className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-2 rounded-lg text-sm"
                                        >
                                          <div className="flex items-center gap-2">
                                            <span className="font-semibold text-primary dark:text-primary-light">
                                              {ROLE_LABELS[item.role] || item.role}:
                                            </span>
                                            {item.role === "subjectTeacher" && item.subject && (
                                              <span className="bg-primary/10 text-primary-dark dark:bg-primary-light/10 dark:text-primary-light px-2 py-0.5 rounded text-xs font-medium">
                                                {item.subject}
                                              </span>
                                            )}
                                            <span className="text-gray-700 dark:text-gray-300">
                                              Grade {item.gradeLevel} — Section {item.section}
                                            </span>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveEditAssignment(idx)}
                                            className="text-gray-400 hover:text-rose-600 dark:text-gray-500 dark:hover:text-rose-400 transition-colors p-1"
                                            title="Remove assignment"
                                          >
                                            <Trash2 size={16} />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}

                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={handleCancelEdit}
                                  className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="submit"
                                  disabled={isSavingEdit}
                                  className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm hover:bg-primary-light active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {isSavingEdit ? "Saving..." : "Save Changes"}
                                </button>
                              </div>
                            </form>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* ---- Parent Accounts Provisioning Panel ---- */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-card">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-3 mb-5">
          <Heart className="text-rose-500" size={18} /> Parent Accounts
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
          Create parent/guardian accounts and link them to a learner. Parents can only view
          information for their linked child — no staff tools are accessible from the parent portal.
        </p>

        {parentSuccess && (
          <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-xl p-3 flex items-center gap-2 mb-4 text-sm animate-fade-in">
            <CheckCircle2 size={16} className="flex-shrink-0" /> {parentSuccess}
          </div>
        )}
        {parentError && (
          <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 rounded-xl p-3 flex items-center gap-2 mb-4 text-sm animate-fade-in">
            <AlertCircle size={16} className="flex-shrink-0" /> {parentError}
          </div>
        )}

        {/* Create Parent Account Form */}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setParentSuccess("");
            setParentError("");
            const trimName = parentName.trim();
            const trimEmail = parentEmail.trim();
            const trimLearnerId = parentLearnerDocId.trim();
            if (!trimName) { setParentError("Parent/Guardian name is required."); return; }
            if (!trimEmail) { setParentError("Email address is required."); return; }
            if (!parentPassword || parentPassword.length < 6) { setParentError("Temporary password must be at least 6 characters."); return; }
            if (!trimLearnerId) { setParentError("Learner Document ID is required. Obtain it from View Learners."); return; }
            setParentSubmitting(true);
            try {
              const { createTeacherAccount } = await import("../firebaseAdmin");
              const uid = await createTeacherAccount(trimEmail, parentPassword);
              // Write to users/{uid} with role 'parent'
              await setDoc(doc(db, "users", uid), {
                fullName: trimName,
                email: trimEmail,
                roles: ["parent"],
                createdAt: serverTimestamp(),
                createdByEmail: user?.email || "",
              });
              // Write to parentLinks/{uid}
              await setDoc(doc(db, "parentLinks", uid), {
                parentUid: uid,
                parentName: trimName,
                parentEmail: trimEmail,
                learnerIds: [trimLearnerId],
                linkedBy: user?.email || "",
                linkedAt: serverTimestamp(),
              });
              setParentSuccess(`Parent account created for ${trimEmail} and linked to learner.`);
              setParentName("");
              setParentEmail("");
              setParentPassword("");
              setParentLearnerDocId("");
              await refreshParentLinks();
            } catch (err) {
              if (err.code === "auth/email-already-in-use") {
                setParentError("An account with this email already exists.");
              } else {
                setParentError(err.message || "Failed to create parent account.");
              }
            } finally {
              setParentSubmitting(false);
            }
          }}
          className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6"
        >
          <div>
            <label htmlFor="parentNameInput" className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
              Parent / Guardian Name <span className="text-rose-500">*</span>
            </label>
            <input
              id="parentNameInput"
              type="text"
              value={parentName}
              onChange={(e) => setParentName(e.target.value)}
              placeholder="e.g. Juan Dela Cruz"
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
            />
          </div>
          <div>
            <label htmlFor="parentEmailInput" className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
              Email Address <span className="text-rose-500">*</span>
            </label>
            <input
              id="parentEmailInput"
              type="email"
              value={parentEmail}
              onChange={(e) => setParentEmail(e.target.value)}
              placeholder="e.g. jdelacruz@example.com"
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
            />
          </div>
          <div>
            <label htmlFor="parentPasswordInput" className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
              Temporary Password <span className="text-rose-500">*</span>
            </label>
            <input
              id="parentPasswordInput"
              type="password"
              value={parentPassword}
              onChange={(e) => setParentPassword(e.target.value)}
              placeholder="Min. 6 characters"
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
            />
          </div>
          <div>
            <label htmlFor="parentLearnerIdInput" className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
              Learner Document ID <span className="text-rose-500">*</span>
            </label>
            <input
              id="parentLearnerIdInput"
              type="text"
              value={parentLearnerDocId}
              onChange={(e) => setParentLearnerDocId(e.target.value)}
              placeholder="Firestore doc ID from View Learners"
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
            />
            <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">
              Find this in the learner's row in View Learners → copy the document ID.
            </p>
          </div>
          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={parentSubmitting}
              className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2 rounded-lg text-sm font-semibold shadow-sm flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99]"
            >
              <Link2 size={15} />
              {parentSubmitting ? "Creating..." : "Create & Link Parent Account"}
            </button>
          </div>
        </form>

        {/* Existing Parent Links List */}
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
          <Users size={15} /> Linked Parent Accounts ({parentLinks.length})
        </h3>
        {loadingParentLinks ? (
          <p className="text-sm text-gray-400 dark:text-gray-600">Loading...</p>
        ) : parentLinks.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-600">No parent accounts have been created yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider">Parent Name</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider">Email</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider">Linked Learner(s)</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {parentLinks.map((link) => (
                  <tr key={link.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{link.parentName || "—"}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{link.parentEmail || link.id}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs font-mono">
                      {(link.learnerIds || []).join(", ") || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        disabled={revokingParentId === link.id}
                        onClick={async () => {
                          if (!window.confirm(`Revoke portal access for ${link.parentEmail || link.id}? They will no longer be able to view any learner records.`)) return;
                          setRevokingParentId(link.id);
                          try {
                            await deleteDoc(doc(db, "parentLinks", link.id));
                            setParentSuccess(`Access revoked for ${link.parentEmail || link.id}.`);
                            await refreshParentLinks();
                          } catch (err) {
                            setParentError(err.message || "Failed to revoke access.");
                          } finally {
                            setRevokingParentId(null);
                          }
                        }}
                        className="flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 font-semibold transition-colors disabled:opacity-50"
                        title="Revoke parent portal access"
                      >
                        <Link2Off size={13} />
                        {revokingParentId === link.id ? "Revoking..." : "Revoke"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Account Details Modal */}
      {viewingUser && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setViewingUser(null)}
        >
          <div
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3 mb-4">
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <IdCard className="text-primary" size={18} /> Account Details
              </h3>
              <button
                type="button"
                onClick={() => setViewingUser(null)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-md"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <dl className="space-y-3 text-sm">
              {[
                ["Full Name", viewingUser.fullName],
                ["Email", viewingUser.email],
                [
                  "Roles",
                  Array.isArray(viewingUser.roles)
                    ? viewingUser.roles.map((r) => ROLE_LABELS[r] || r).join(", ")
                    : "",
                ],
                ["Employee / DepEd ID Number", viewingUser.employeeNumber],
                ["Position / Designation", viewingUser.position],
                ["Mobile Number", viewingUser.mobileNumber],
                ["Status", isAccountActive(viewingUser) ? "Active" : "Deactivated"],
              ].map(([label, value]) => (
                <div key={label} className="grid grid-cols-3 gap-2">
                  <dt className="col-span-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {label}
                  </dt>
                  <dd className="col-span-2 text-gray-800 dark:text-gray-200 break-words">
                    {value || <span className="text-gray-400 dark:text-gray-500 italic">Not set</span>}
                  </dd>
                </div>
              ))}

              {Array.isArray(viewingUser.assignments) && viewingUser.assignments.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  <dt className="col-span-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Assignments
                  </dt>
                  <dd className="col-span-2 space-y-1">
                    {viewingUser.assignments.map((a, i) => (
                      <div key={i} className="text-gray-800 dark:text-gray-200">
                        <span className="font-semibold">{ROLE_LABELS[a.role] || a.role}:</span>{" "}
                        {a.subject ? `${a.subject} (` : ""}
                        Grade {a.gradeLevel} - {a.section}
                        {a.subject ? ")" : ""}
                      </div>
                    ))}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
