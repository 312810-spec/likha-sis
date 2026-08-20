// src/pages/SF10Importer.jsx
// SF10 Importer — imports Learner's Permanent Academic Record files.
// Uses the same shared import framework + preview UI as the SF1 Bulk Importer.
//
// The SF10 parser is structure-detecting (no fixed row layout assumed). It reads
// learner identity + school context from the worksheet header and extracts
// learning-area grades plus general average from the grades table. Each approved
// SF10 record is linked to the canonical learner by LRN.

import { useRef, useState } from "react";
import { CheckCircle2, Loader2, Upload, X, AlertTriangle } from "lucide-react";
import { db } from "../firebase";
import { analyzeSF10Files } from "../importers/sf10/importSF10.js";
import {
  fetchExistingLearnersByLrn,
  findPriorImport,
  executeSF10Import,
} from "../importers/shared/firestoreImport.js";
import StepIndicator from "../components/import/StepIndicator";
import StatCard from "../components/import/StatCard";
import FileSummaryCard from "../components/import/FileSummaryCard";
import PreviewTable from "../components/import/PreviewTable";
import Button from "../components/Button.jsx";

const STEPS = ["Select Files", "Analyze", "Review", "Import", "Summary"];

const COLUMNS = [
  { key: "lrn", label: "LRN", render: (r) => r.learner?.lrn || "—" },
  {
    key: "name",
    label: "Name",
    render: (r) =>
      [r.learner?.lastName, r.learner?.firstName].filter(Boolean).join(", ") || "—",
  },
  { key: "schoolYear", label: "School Year", render: (r) => r.learner?.schoolYear || "—" },
  { key: "gradeLevel", label: "Grade", render: (r) => r.learner?.gradeLevel || "—" },
  { key: "section", label: "Section", render: (r) => r.learner?.section || "—" },
  {
    key: "learningAreas",
    label: "Learning Areas",
    render: (r) => (r.learner?.learningAreas?.length || 0) || "—",
  },
  { key: "generalAverage", label: "G. Average", render: (r) => r.learner?.generalAverage || "—" },
];

export default function SF10Importer({ user }) {
  const inputRef = useRef(null);
  const [step, setStep] = useState(0);
  const [files, setFiles] = useState([]);
  const [fileModels, setFileModels] = useState([]);
  const [batch, setBatch] = useState(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [priorImport, setPriorImport] = useState(null);

  function addFiles(fileList) {
    const accepted = Array.from(fileList).filter((f) => /\.(xlsx|xls)$/i.test(f.name));
    if (accepted.length !== fileList.length) {
      setError("Only .xls and .xlsx files can be imported. Other files were ignored.");
    } else {
      setError("");
    }
    setFiles((prev) => [...prev, ...accepted]);
  }

  function removeFile(index) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleAnalyze() {
    if (files.length === 0) {
      setError("Select at least one .xls or .xlsx file to analyze.");
      return;
    }
    setError("");
    setBusy(true);
    setStep(1);
    try {
      const existingByLrn = await fetchExistingLearnersByLrn(db);
      const { files: models, batch: batchTotals } = await analyzeSF10Files(files, existingByLrn);
      setFileModels(models);
      setBatch(batchTotals);
      const fingerprints = models.map((m) => m.fingerprint).filter(Boolean);
      let prior = null;
      if (fingerprints.length > 0) {
        try {
          prior = await findPriorImport(db, fingerprints);
        } catch {
          prior = null;
        }
      }
      setPriorImport(prior);
      setStep(2);
    } catch (err) {
      console.error("Analysis failed:", err);
      setError("Analysis failed. Please try again.");
      setStep(0);
    } finally {
      setBusy(false);
    }


    }

  async function handleConfirmImport() {
    if (!batch || !batch.canImport) return;
    setError("");
    setBusy(true);
    setStep(3);
    try {
      const records = fileModels.flatMap((f) => f.records || []);
      const filenames = fileModels.map((f) => f.filename);
      const fingerprints = fileModels.map((f) => f.fingerprint).filter(Boolean);
      const firstValid = fileModels.find((f) => f.school && f.school.schoolId);
      const school = firstValid ? firstValid.school : (fileModels[0]?.school || {});
      const res = await executeSF10Import(db, {
        records,
        documentType: "sf10",
        school,
        filenames,
        fileFingerprints: fingerprints,
        importedByEmail: user?.email || "",
      });
      setResult(res);
      setStep(4);
    } catch (err) {
      console.error("Import failed:", err);
      setError(
        "The import did not complete. Please check the Firestore security rules and try again."
      );
      setStep(2);
    } finally {
      setBusy(false);
    }
  }

  // ---- Render -------------------------------------------------------------
  return (
    <div className="max-w-none w-full space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">SF10 Import</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Learner's Permanent Academic Record (.xls / .xlsx)
        </p>
      </div>

      <StepIndicator steps={STEPS} current={step} />

      {error && (
        <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl px-4 py-3 text-sm animate-fade-in">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {step === 0 && (
        <SF10SelectStep
          busy={busy}
          files={files}
          onAdd={addFiles}
          onRemove={removeFile}
          onAnalyze={handleAnalyze}
          inputRef={inputRef}
        />
      )}

      {step === 1 && <SF10AnalyzingStep />}

      {step === 2 && (
        <SF10ReviewStep
          batch={batch}
          fileModels={fileModels}
          onConfirm={handleConfirmImport}
          onBack={() => setStep(0)}
          busy={busy}
          priorImport={priorImport}
        />
      )}

      {step === 3 && <SF10AnalyzingStep importing />}

      {step === 4 && (
        <SF10ResultStep
          result={result}
          onDone={() => {
            setStep(0);
            setFiles([]);
            setFileModels([]);
            setBatch(null);
            setResult(null);
            setPriorImport(null);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
function SF10SelectStep({ files, onAdd, onRemove, onAnalyze, busy, inputRef }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-card">
      <label
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files?.length) onAdd(e.dataTransfer.files);
        }}
        className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg py-12 px-4 cursor-pointer hover:border-leaf dark:hover:border-leaf-light transition-colors text-center"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xls,.xlsx"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) onAdd(e.target.files);
            e.target.value = "";
          }}
        />
        <div className="w-14 h-14 rounded-full bg-leaf/10 dark:bg-leaf/20 text-leaf dark:text-leaf-light flex items-center justify-center mb-3">
          <Upload size={26} />
        </div>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
          Drag &amp; drop SF10 files here, or click to browse
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">.xls / .xlsx — one learner per form</p>
        <span
          className="mt-4 px-4 py-2 rounded-lg bg-leaf text-white text-sm font-medium shadow-sm hover:bg-leaf-light transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1"
          onClick={(e) => {
            e.preventDefault();
            inputRef.current && inputRef.current.click();
          }}
        >
          Choose Files
        </span>
      </label>

      {files.length > 0 && (
        <ul className="mt-5 space-y-2">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm"
            >
              <span className="min-w-0 break-all text-gray-700 dark:text-gray-200">{f.name}</span>
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 ml-3"
                aria-label={`Remove ${f.name}`}
              >
                <X size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          disabled={busy || files.length === 0}
          onClick={onAnalyze}
          className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-md text-sm font-medium bg-leaf text-white hover:bg-leaf-light transition-colors duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1"
        >
          <CheckCircle2 size={16} /> Analyze Files
        </button>
      </div>
    </div>
  );
}

function SF10AnalyzingStep({ importing = false }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-card py-12 flex flex-col items-center justify-center text-center">
      <Loader2 size={32} className="animate-spin text-leaf mb-3" />
      <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
        {importing ? "Importing approved academic records…" : "Analyzing SF10 workbooks…"}
      </p>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
        Detecting identity header · extracting learning areas &amp; grades · validating
      </p>
    </div>
  );
}

function SF10ReviewStep({ batch, fileModels, onConfirm, onBack, busy, priorImport }) {
  const allRecords = fileModels.flatMap((f) => f.records || []);
  return (
    <div className="space-y-5">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-card">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Import Summary</h3>
        <div className="flex flex-wrap gap-3">
          <StatCard label="Files selected" value={batch.fileCount} />
          <StatCard label="Files analyzed" value={batch.filesAnalyzed} tone="success" />
          <StatCard label="Academic records" value={batch.totalLearners} tone="primary" />
          <StatCard label="Duplicates" value={batch.duplicateCount} tone="warning" />
          <StatCard label="Warnings" value={batch.warningCount} tone="warning" />
          <StatCard label="Errors" value={batch.errorCount} tone="error" />
        </div>
        {priorImport && (
          <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 rounded-xl px-4 py-3 text-sm mt-4">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <span>
              One or more of these files appears to have already been imported
              successfully (previous import {priorImport.id}). Duplicate records will be
              skipped.
            </span>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-card">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">File Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {fileModels.map((f, i) => (
            <FileSummaryCard
              key={`${f.filename}-${i}`}
              file={f}
              selected={false}
              onSelect={() => {}}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Academic Record Preview
          <span className="font-normal text-gray-400 dark:text-gray-500 ml-2">Click a row to inspect issues.</span>
        </h3>
        <PreviewTable records={allRecords} columns={COLUMNS} />
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-card flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="secondary" onClick={onBack}>
          ← Back to file selection
        </Button>
        <div className="flex items-center gap-3">
          {batch.blockingErrors && (
            <span className="text-xs text-red-600 dark:text-red-400">Fix blocking errors before importing.</span>
          )}
          <button
            type="button"
            disabled={busy || !batch.canImport}
            onClick={onConfirm}
            className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-md text-sm font-medium bg-leaf text-white hover:bg-leaf-light transition-colors duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1"
          >
            <CheckCircle2 size={16} /> Confirm Import
          </button>
        </div>
      </div>
    </div>
  );
}

function SF10ResultStep({ result, onDone }) {
  const ok = result && result.status === "success";
  const blocked = result && result.status === "blocked";
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-card text-center animate-fade-in">
      <div
        className={`mx-auto mb-4 w-16 h-16 rounded-full flex items-center justify-center ${
          blocked
            ? "bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400"
            : ok
            ? "bg-green-100 text-green-600 dark:bg-green-950/40 dark:text-green-400"
            : "bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
        }`}
      >
        {blocked ? <AlertTriangle size={30} /> : <CheckCircle2 size={30} />}
      </div>
      {blocked ? (
        <>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Import Blocked</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-md mx-auto">{result.error}</p>
        </>
      ) : ok ? (
        <>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Import Complete</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {result.written} academic record(s) imported.{" "}
            {result.skipped > 0 && `${result.skipped} already-existing record(s) skipped.`}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Import ID: {result.importId}</p>
        </>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400">No import result available.</p>
      )}
      <button
        type="button"
        onClick={onDone}
        className="mt-6 inline-flex items-center justify-center gap-2 h-9 px-4 rounded-md text-sm font-medium bg-leaf text-white hover:bg-leaf-light transition-colors duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1"
      >
        <Upload size={16} /> Import More Files
      </button>
    </div>
  );
}


