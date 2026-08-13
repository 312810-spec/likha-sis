import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase";
import useSchoolConfig from "./hooks/useSchoolConfig";

const KEY_STAGE_OPTIONS = [
  {
    key: "ks1",
    label: "Key Stage 1: Kindergarten to Grade 3",
    disabled: true,
    gradeLevels: [],
  },
  {
    key: "ks2",
    label: "Key Stage 2: Grades 4 to 6",
    disabled: false,
    gradeLevels: ["Grade 4", "Grade 5", "Grade 6"],
  },
  {
    key: "ks3",
    label: "Key Stage 3: Grades 7 to 10",
    disabled: false,
    gradeLevels: ["Grade 7", "Grade 8", "Grade 9", "Grade 10"],
  },
  {
    key: "ks4",
    label: "Key Stage 4: Grades 11 to 12 (Senior High)",
    disabled: true,
    gradeLevels: [],
  },
];

function getGradeLevelsFromStages(stages) {
  const gradeLevels = [];
  if (stages.ks2) gradeLevels.push(...KEY_STAGE_OPTIONS[1].gradeLevels);
  if (stages.ks3) gradeLevels.push(...KEY_STAGE_OPTIONS[2].gradeLevels);
  return gradeLevels;
}

function SetupWizard() {
  const { config: initialConfig } = useSchoolConfig();
  const defaultGradeLevels = [
    "Grade 4",
    "Grade 5",
    "Grade 6",
    "Grade 7",
    "Grade 8",
    "Grade 9",
    "Grade 10",
  ];
  const initialGradeLevels = initialConfig?.gradeLevelsOffered || defaultGradeLevels;

  const [step, setStep] = useState(1);
  const [schoolData, setSchoolData] = useState({
    ...initialConfig,
    gradeLevelsOffered: initialGradeLevels,
  });
  const [selectedKeyStages, setSelectedKeyStages] = useState(() => ({
    ks1: false,
    ks2: initialGradeLevels.some((grade) => ["Grade 4", "Grade 5", "Grade 6"].includes(grade)),
    ks3: initialGradeLevels.some((grade) => ["Grade 7", "Grade 8", "Grade 9", "Grade 10"].includes(grade)),
    ks4: false,
  }));
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleKeyStageToggle(stageKey) {
    if (stageKey === "ks1" || stageKey === "ks4") return;
    setSelectedKeyStages((prev) => ({
      ...prev,
      [stageKey]: !prev[stageKey],
    }));
  }

  function validateStep1() {
    const e = {};
    if (!schoolData.schoolName || !schoolData.schoolName.trim()) {
      e.schoolName = "School name is required.";
    }
    if (!schoolData.principalName || !schoolData.principalName.trim()) {
      e.principalName = "Principal name is required.";
    }

    const gradeLevelsOffered = getGradeLevelsFromStages(selectedKeyStages);
    if (gradeLevelsOffered.length === 0) {
      e.gradeLevelsOffered = "Please select at least one of Key Stage 2 or Key Stage 3.";
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function validateStep2() {
    const e = {};
    if (!fullName.trim()) e.fullName = "Full name is required.";
    if (!email.trim()) e.email = "Email is required.";
    if (!password) e.password = "Password is required.";
    if (password && password.length < 6) e.password = "Password must be at least 6 characters.";
    if (password !== confirmPassword) e.confirmPassword = "Passwords do not match.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleFinalSubmit(e) {
    e.preventDefault();
    setSubmitError("");
    if (!validateStep2()) return;

    const gradeLevelsOffered = getGradeLevelsFromStages(selectedKeyStages);
    if (gradeLevelsOffered.length === 0) {
      setErrors((prev) => ({
        ...prev,
        gradeLevelsOffered: "Please select at least one of Key Stage 2 or Key Stage 3.",
      }));
      return;
    }

    setIsSubmitting(true);
    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCred.user.uid;

      await setDoc(doc(db, "users", uid), {
        fullName,
        email,
        roles: ["ictCoordinator"],
        assignments: [],
        createdAt: serverTimestamp(),
        createdByEmail: email,
      });

      await setDoc(doc(db, "settings", "schoolConfig"), {
        ...schoolData,
        gradeLevelsOffered,
        setupCompletedAt: serverTimestamp(),
      });

      // Success: Auth automatically signs in the new user. Let app route handle the rest.
    } catch (err) {
      setSubmitError(err.message || "Failed to create account.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-primary flex items-center justify-center px-4">
      <div className="w-full max-w-lg bg-white rounded-xl shadow-lg p-8">
        <div className="mb-4 text-center">
          <h2 className="text-2xl font-bold text-primary">LIKHA-SIS Setup</h2>
          <p className="text-sm text-gray-500 mt-1">Step {step} of 2</p>
        </div>

        {step === 1 && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (validateStep1()) setStep(2);
            }}
          >
            <div className="grid grid-cols-1 gap-3">
              <label className="text-sm">School Name</label>
              <input
                className="border p-2 rounded"
                value={schoolData.schoolName}
                onChange={(e) => setSchoolData({ ...schoolData, schoolName: e.target.value })}
              />
              {errors.schoolName && <p className="text-red-600 text-sm">{errors.schoolName}</p>}

              <label className="text-sm">School Address</label>
              <input
                className="border p-2 rounded"
                value={schoolData.schoolAddress}
                onChange={(e) => setSchoolData({ ...schoolData, schoolAddress: e.target.value })}
              />

              <label className="text-sm">Region</label>
              <input
                className="border p-2 rounded"
                value={schoolData.region}
                onChange={(e) => setSchoolData({ ...schoolData, region: e.target.value })}
              />

              <label className="text-sm">Division Office</label>
              <input
                className="border p-2 rounded"
                value={schoolData.divisionOffice}
                onChange={(e) => setSchoolData({ ...schoolData, divisionOffice: e.target.value })}
              />

              <label className="text-sm">District</label>
              <input
                className="border p-2 rounded"
                value={schoolData.district}
                onChange={(e) => setSchoolData({ ...schoolData, district: e.target.value })}
              />

              <label className="text-sm">Municipality / City / Province</label>
              <input
                className="border p-2 rounded"
                value={schoolData.municipalityCityProvince}
                onChange={(e) => setSchoolData({ ...schoolData, municipalityCityProvince: e.target.value })}
              />

              <label className="text-sm">Principal Name</label>
              <input
                className="border p-2 rounded"
                value={schoolData.principalName}
                onChange={(e) => setSchoolData({ ...schoolData, principalName: e.target.value })}
              />
              {errors.principalName && <p className="text-red-600 text-sm">{errors.principalName}</p>}

              <label className="text-sm">Principal Position</label>
              <input
                className="border p-2 rounded"
                value={schoolData.principalPosition}
                onChange={(e) => setSchoolData({ ...schoolData, principalPosition: e.target.value })}
              />
            </div>

            <div className="mt-6">
              <p className="text-sm font-medium text-gray-700 mb-2">Which grade levels does your school offer?</p>
              <div className="space-y-2">
                {KEY_STAGE_OPTIONS.map((stage) => (
                  <label
                    key={stage.key}
                    className={`flex items-center gap-3 rounded border p-2 ${stage.disabled ? "bg-gray-100 opacity-70" : "bg-white"}`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedKeyStages[stage.key] || false}
                      disabled={stage.disabled}
                      onChange={() => handleKeyStageToggle(stage.key)}
                    />
                    <span className="text-sm text-gray-700">{stage.label}</span>
                    {stage.disabled && (
                      <span className="inline-flex items-center rounded bg-gray-200 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                        Coming soon
                      </span>
                    )}
                  </label>
                ))}
              </div>
              {errors.gradeLevelsOffered && (
                <p className="text-red-600 text-sm mt-2">{errors.gradeLevelsOffered}</p>
              )}
            </div>

            <div className="mt-6 flex justify-between">
              <div />
              <button
                type="submit"
                className="bg-primary text-white px-4 py-2 rounded"
              >
                Continue
              </button>
            </div>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleFinalSubmit}>
            <p className="text-sm text-gray-600 mb-4">
              This account will have full ICT Coordinator access to set up the rest of your school's system.
            </p>

            <label className="text-sm">Full Name</label>
            <input className="border p-2 rounded w-full mb-2" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            {errors.fullName && <p className="text-red-600 text-sm">{errors.fullName}</p>}

            <label className="text-sm">Email</label>
            <input className="border p-2 rounded w-full mb-2" value={email} onChange={(e) => setEmail(e.target.value)} />
            {errors.email && <p className="text-red-600 text-sm">{errors.email}</p>}

            <label className="text-sm">Password</label>
            <input type="password" className="border p-2 rounded w-full mb-2" value={password} onChange={(e) => setPassword(e.target.value)} />
            {errors.password && <p className="text-red-600 text-sm">{errors.password}</p>}

            <label className="text-sm">Confirm Password</label>
            <input type="password" className="border p-2 rounded w-full mb-2" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            {errors.confirmPassword && <p className="text-red-600 text-sm">{errors.confirmPassword}</p>}

            {submitError && <p className="text-red-600 text-sm mt-2">{submitError}</p>}

            <div className="mt-6 flex justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 rounded border"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-primary text-white px-4 py-2 rounded"
              >
                {isSubmitting ? "Creating account..." : "Create account & Finish Setup"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default SetupWizard;
