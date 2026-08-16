// src/AccountSettings.jsx
// Self-service account management: edit your own display name, view your
// email/roles, and change your own password. Open to every signed-in role
// (unlike SchoolSettings.jsx, which is ictCoordinator/principal only) --
// this is personal, not school-wide configuration.

import { useEffect, useState } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { updateProfile, reauthenticateWithCredential, updatePassword, EmailAuthProvider } from "firebase/auth";
import { db, auth } from "./firebase";
import { ROLE_OPTIONS, ROLE_LABELS } from "./utils/roles.js";
import { validateSelfRoleEdit } from "./utils/userAccountManagement.js";
import { ArrowLeft, UserCircle, Save, KeyRound, CheckCircle2, AlertCircle } from "lucide-react";

const inputClass = "w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary focus:bg-white dark:focus:bg-gray-800 transition-colors";
const labelClass = "flex flex-col gap-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300";

function friendlyPasswordError(err) {
  switch (err?.code) {
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Current password is incorrect.";
    case "auth/weak-password":
      return "New password must be at least 6 characters.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a moment and try again.";
    default:
      return "Failed to change password. Please try again.";
  }
}

export default function AccountSettings({ user, goBack }) {
  const [profile, setProfile] = useState(null);
  const [fullName, setFullName] = useState("");
  const [editableRoles, setEditableRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    async function loadProfile() {
      if (!user?.uid) {
        setLoading(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          const data = snap.data();
          setProfile(data);
          setFullName(data.fullName || "");
          setEditableRoles(Array.isArray(data.roles) ? [...data.roles] : []);
        }
      } catch (err) {
        console.error("Failed to load account profile:", err);
        setProfileError("Could not load your account. Please refresh and try again.");
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [user?.uid]);

  const isIctCoordinator = Array.isArray(profile?.roles) && profile.roles.includes("ictCoordinator");

  function handleRoleToggle(roleId) {
    if (roleId === "ictCoordinator") return; // locked: can't remove your own admin access
    setEditableRoles((prev) =>
      prev.includes(roleId) ? prev.filter((r) => r !== roleId) : [...prev, roleId]
    );
  }

  async function handleSaveProfile(e) {
    e.preventDefault();
    setProfileError("");
    setProfileMessage("");

    if (!fullName.trim()) {
      setProfileError("Full name is required.");
      return;
    }

    const updates = { fullName: fullName.trim() };
    if (isIctCoordinator) {
      const { valid, error } = validateSelfRoleEdit(editableRoles);
      if (!valid) {
        setProfileError(error);
        return;
      }
      updates.roles = editableRoles;
    }

    setIsSavingProfile(true);
    try {
      await updateDoc(doc(db, "users", user.uid), updates);
      // Also keep the Auth profile's displayName in sync -- DashboardShell's
      // "Welcome, ..." header reads from the Auth object, not Firestore.
      await updateProfile(auth.currentUser, { displayName: fullName.trim() });
      setProfileMessage("Profile updated.");
    } catch (err) {
      console.error("Failed to update profile:", err);
      setProfileError("Failed to save changes. Please try again.");
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setPasswordError("");
    setPasswordMessage("");

    if (!currentPassword || !newPassword) {
      setPasswordError("Please fill in your current and new password.");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }

    setIsChangingPassword(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPassword);
      setPasswordMessage("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      console.error("Failed to change password:", err);
      setPasswordError(friendlyPasswordError(err));
    } finally {
      setIsChangingPassword(false);
    }
  }

  const roleLabels = (profile?.roles || []).map((r) => ROLE_LABELS[r] || r).join(", ") || "No roles assigned";

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto animate-slide-up">
        <div className="space-y-3 p-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="h-6 w-48 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
          <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12 animate-slide-up">
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 pb-4">
        {goBack && (
          <button
            type="button"
            onClick={goBack}
            className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Back to dashboard"
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <UserCircle className="text-primary" size={24} />
            Account Settings
          </h1>
          <p className="text-sm text-gray-500 mt-1 dark:text-gray-400">
            Manage your own name and password.
          </p>
        </div>
      </div>

      {/* Profile */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Profile</h2>

        {profileMessage && (
          <div className="mb-4 flex items-start gap-2 p-3 bg-green-50 border border-green-100 rounded-lg text-green-700 text-sm dark:bg-green-950/30 dark:border-green-900/50 dark:text-green-400 animate-fade-in">
            <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5" />
            <span>{profileMessage}</span>
          </div>
        )}
        {profileError && (
          <div className="mb-4 flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-lg text-red-700 text-sm dark:bg-red-950/30 dark:border-red-900/50 dark:text-red-400 animate-fade-in">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <span>{profileError}</span>
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <label className={labelClass}>
            Full Name
            <input className={inputClass} value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className={labelClass}>
              Email
              <input className={`${inputClass} opacity-70 cursor-not-allowed`} value={user?.email || ""} disabled />
            </label>
            {!isIctCoordinator && (
              <label className={labelClass}>
                Role(s)
                <input className={`${inputClass} opacity-70 cursor-not-allowed`} value={roleLabels} disabled />
              </label>
            )}
          </div>

          {isIctCoordinator && (
            <div>
              <span className={labelClass}>
                Role(s)
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-1.5">
                {ROLE_OPTIONS.map((role) => {
                  const isChecked = editableRoles.includes(role.id);
                  const isLocked = role.id === "ictCoordinator";
                  return (
                    <label
                      key={role.id}
                      title={isLocked ? "You can't remove your own ICT Coordinator role." : undefined}
                      className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-medium transition-colors ${
                        isLocked ? "cursor-not-allowed opacity-80" : "cursor-pointer"
                      } ${
                        isChecked
                          ? "bg-primary/10 border-primary text-primary-dark dark:bg-primary-light/10 dark:border-primary-light dark:text-primary-light"
                          : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={isLocked}
                        onChange={() => handleRoleToggle(role.id)}
                        className="rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary h-4 w-4 disabled:cursor-not-allowed"
                      />
                      <span>{role.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSavingProfile}
              className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm hover:bg-primary-light active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Save size={15} />
              {isSavingProfile ? "Saving..." : "Save Profile"}
            </button>
          </div>
        </form>
      </div>

      {/* Password */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <KeyRound size={16} className="text-primary" /> Change Password
        </h2>

        {passwordMessage && (
          <div className="mb-4 flex items-start gap-2 p-3 bg-green-50 border border-green-100 rounded-lg text-green-700 text-sm dark:bg-green-950/30 dark:border-green-900/50 dark:text-green-400 animate-fade-in">
            <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5" />
            <span>{passwordMessage}</span>
          </div>
        )}
        {passwordError && (
          <div className="mb-4 flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-lg text-red-700 text-sm dark:bg-red-950/30 dark:border-red-900/50 dark:text-red-400 animate-fade-in">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <span>{passwordError}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4">
          <label className={labelClass}>
            Current Password
            <input type="password" className={inputClass} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className={labelClass}>
              New Password
              <input type="password" className={inputClass} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </label>
            <label className={labelClass}>
              Confirm New Password
              <input type="password" className={inputClass} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </label>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isChangingPassword}
              className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm hover:bg-primary-light active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <KeyRound size={15} />
              {isChangingPassword ? "Changing..." : "Change Password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
