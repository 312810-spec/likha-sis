import { useState, useEffect } from "react";
import { collection, getDocs, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { UserPlus, Users, Plus, Trash2, CheckCircle2, AlertCircle, Shield } from "lucide-react";
import { db } from "../firebase";
import { createTeacherAccount } from "../firebaseAdmin";
import { ROLE_OPTIONS, ROLE_LABELS } from "../utils/roles.js";

export default function UserManagement({ user }) {
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

  // Status & Feedback
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Users Directory List
  const [userList, setUserList] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

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
    <div className="font-sans text-gray-900 dark:text-gray-100 space-y-6 max-w-6xl mx-auto pb-12 animate-slide-up">
      {/* Header Banner */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 tracking-tight">
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
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
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
                  <input
                    id="assignGradeInput"
                    type="text"
                    value={assignGrade}
                    onChange={(e) => setAssignGrade(e.target.value)}
                    placeholder="e.g. 10"
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  />
                </div>

                <div>
                  <label htmlFor="assignSectionInput" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Section</label>
                  <div className="flex gap-2">
                    <input
                      id="assignSectionInput"
                      type="text"
                      value={assignSection}
                      onChange={(e) => setAssignSection(e.target.value)}
                      placeholder="e.g. Kindness"
                      className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                    />
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
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
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
                  <th className="py-3 px-4">Full Name</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Roles</th>
                  <th className="py-3 px-4">Assignments</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {userList.map((u) => {
                  const roleString = Array.isArray(u.roles)
                    ? u.roles.map((r) => ROLE_LABELS[r] || r).join(", ")
                    : "No roles assigned";

                  const assignmentList = Array.isArray(u.assignments) ? u.assignments : [];

                  return (
                    <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
