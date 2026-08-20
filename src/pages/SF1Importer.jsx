// src/pages/SF1Importer.jsx
// SF1 Bulk Importer — the full import workflow:
//   Select Files → Analyze → Review (detect/structure/extract/normalize/validate/
//   duplicates/preview are performed by the shared importer backend) → Confirm →
//   Import to Firestore → Import Summary.
//
// Records are NEVER imported immediately after file selection. The user must
// review the preview, validation issues, duplicate conflicts and statistics, and
// only then confirm the import. The Confirm button is disabled while any blocking
// validation error exists.
//
// UI and Firestore concerns are kept separate: the parsing/validation/duplicate
// logic lives in src/importers, this file only orchestrates the user flow.

import { useRef, useState } from "react";
import { CheckCircle2, Loader2, Upload, X, AlertTriangle, FileSpreadsheet } from "lucide-react";
import { db } from "../firebase";
import { analyzeSF1Files } from "../importers/sf1/importSF1.js";
import {
  fetchExistingLearnersByLrn,
  findPriorImport,
  executeImport,
} from "../importers/shared/firestoreImport.js";
import StepIndicator from "../components/import/StepIndicator";
import StatCard from "../components/import/StatCard";
import FileSummaryCard from "../components/import/FileSummaryCard";
import PreviewTable from "../components/import/PreviewTable";
import IssueList from "../components/import/IssueList";
import PageHeader from "../components/ui/PageHeader";
import Card from "../components/ui/Card";
import Alert from "../components/ui/Alert";
import Button from "../components/ui/Button";


const STEPS = ["Select Files", "Analyze", "Review", "Import", "Summary"];

// Columns shown in the learner preview table.
const COLUMNS = [
  { key: "lrn", label: "LRN", render: (r) => r.learner?.lrn || "—" },
  {
    key: "name",
    label: "Name",
    render: (r) =>
      [r.learner?.lastName, r.learner?.firstName].filter(Boolean).join(", ") || "—",
  },
  { key: "sex", label: "Sex", render: (r) => r.learner?.sex || "—" },
  { key: "birthDate", label: "Birth Date", render: (r) => r.learner?.birthDate || "—" },
  { key: "gradeLevel", label: "Grade", render: (r) => r.learner?.gradeLevel || "—" },
  { key: "section", label: "Section", render: (r) => r.learner?.section || "—" },
];

export default function SF1Importer({ user }) {
  const inputRef = useRef(null);
  const [step, setStep] = useState(0);
  const [files, setFiles] = useState([]); // selected File objects
  const [fileModels, setFileModels] = useState([]); // analyzed models
  const [batch, setBatch] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [priorImport, setPriorImport] = useState(null);
  const [busy, setBusy] = useState(false);

  // ---- File selection -----------------------------------------------------
  function addFiles(fileList) {
    const accepted = Array.from(fileList).filter((f) =>
      /\.(xlsx|xls)$/i.test(f.name)
    );
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

  // ---- Analyze ------------------------------------------------------------
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
      const { files: models, batch: batchTotals } = await analyzeSF1Files(files, existingByLrn);
      setFileModels(models);
      setBatch(batchTotals);

      // Detect whether any of these files was already imported successfully.
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
      setSelectedIndex(0);
      setStep(2);
    } catch (err) {
      console.error("Analysis failed:", err);
      setError("Analysis failed. Please try again.");
      setStep(0);
    } finally {
      setBusy(false);
    }
  }

  // ---- Confirm import -----------------------------------------------------
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

      const res = await executeImport(db, {
        records,
        documentType: "sf1",
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
        "The import did not complete. Please check the Firestore security rules allow " +
          "writes to the 'learners' and 'importBatches' collections, then try again."
      );
      setStep(2);
    } finally {
      setBusy(false);
    }
  }

  // ---- Render -------------------------------------------------------------
  return (
    <div className="max-w-6xl mx-auto space-y-5 animate-slide-up">
      <PageHeader
        icon={FileSpreadsheet}
        title="SF1 Bulk Import"
        description="School Form 1 — Learner's Information Sheet (.xls / .xlsx)"
        actions={
          <Button variant="ghost" size="compact" onClick={() => setStep(0)}>
            ← Back to file selection
          </Button>
        }
      />

      <StepIndicator steps={STEPS} current={step} />

      {error && <Alert variant="error">{error}</Alert>}

      {step === 0 && (
        <SelectFilesStep
          busy={busy}
          files={files}
          onAdd={addFiles}
          onRemove={removeFile}
          onAnalyze={handleAnalyze}
          inputRef={inputRef}
        />
      )}

      {step === 1 && <AnalyzingStep />}

      {step === 2 && (
        <ReviewStep
          batch={batch}
          fileModels={fileModels}
          selectedIndex={selectedIndex}
          setSelectedIndex={setSelectedIndex}
          onConfirm={handleConfirmImport}
          onBack={() => setStep(0)}
          busy={busy}
          priorImport={priorImport}
        />
      )}

      {step === 3 && <AnalyzingStep importing />}

      {step === 4 && (
        <ResultStep
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
// Select Files step
// ---------------------------------------------------------------------------
function SelectFilesStep({ files, onAdd, onRemove, onAnalyze, busy, inputRef }) {
  return (
    <Card>
      <label
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files?.length) onAdd(e.dataTransfer.files);
        }}
        className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg py-12 px-4 cursor-pointer hover:border-primary dark:hover:border-primary-light transition-colors text-center"
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
        <div className="w-14 h-14 rounded-full bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary-light flex items-center justify-center mb-3">
          <Upload size={26} />
        </div>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
          Drag &amp; drop SF1 files here, or click to browse
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Multiple .xls / .xlsx files allowed in one batch</p>
        <span
          className="mt-4 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium shadow-sm hover:bg-primary-light transition-colors"
          onClick={(e) => {
            e.preventDefault();
            inputRef.current && inputRef.current.click();
          }}
        >
          Choose Files
        </span>
      </label>

      {files.length > 0 && (
        <div className="mt-5">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Selected files ({files.length})
          </h4>
          <ul className="space-y-2">
            {files.map((f, i) => (
              <li
                key={`${f.name}-${i}`}
                className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm"
              >
                <span className="truncate text-gray-700 dark:text-gray-200">{f.name}</span>
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
        </div>
      )}

      <div className="mt-5 flex justify-end">
        <Button variant="primary" disabled={busy || files.length === 0} onClick={onAnalyze}>
          <CheckCircle2 size={16} /> Analyze Files
        </Button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Analyzing / Importing progress step
// ---------------------------------------------------------------------------
function AnalyzingStep({ importing = false }) {
  return (
    <Card className="py-12 flex flex-col items-center justify-center text-center">
      <Loader2 size={32} className="animate-spin text-primary mb-3" />
      <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
        {importing ? "Importing approved records into Firestore…" : "Analyzing workbooks…"}
      </p>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
        Detecting structure · extracting records · validating · checking duplicates
      </p>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Review step
// ---------------------------------------------------------------------------
function ReviewStep({
  batch,
  fileModels,
  selectedIndex,
  setSelectedIndex,
  onConfirm,
  onBack,
  busy,
  priorImport,
}) {
  const allRecords = fileModels.flatMap((f) => f.records || []);
  const visibleRecords =
    selectedIndex === -1 ? allRecords : (fileModels[selectedIndex]?.records || []);
  const summaryWarnings = fileModels.flatMap((f) => f.summaryWarnings || []);

  return (
    <div className="space-y-5">
      {/* Import Summary */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Import Summary</h3>
        <div className="flex flex-wrap gap-3">
          <StatCard label="Files selected" value={batch.fileCount} />
          <StatCard label="Files analyzed" value={batch.filesAnalyzed} tone="success" />
          <StatCard label="Files with errors" value={batch.filesWithErrors} tone="error" />
          <StatCard label="Total learners" value={batch.totalLearners} tone="primary" />
          <StatCard label="Male" value={batch.male} tone="male" />
          <StatCard label="Female" value={batch.female} tone="female" />
          <StatCard label="Duplicates" value={batch.duplicateCount} tone="warning" />
          <StatCard label="Warnings" value={batch.warningCount} tone="warning" />
          <StatCard label="Errors" value={batch.errorCount} tone="error" />
        </div>

        {priorImport && (
          <Alert variant="warning" className="mt-4">
            One or more of these files appears to have already been imported
            successfully (previous import {priorImport.id}). Records that already
            exist (matching LRN) will be skipped rather than duplicated.
          </Alert>
        )}

        {summaryWarnings.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
              Statistics vs. workbook summary
            </h4>
            <IssueList
              issues={summaryWarnings.map((w, i) => ({
                severity: "warning",
                code: "summary-mismatch",
                message: w,
                id: i,
              }))}
            />
          </div>
        )}
      </Card>

      {/* File Summary */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">File Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => setSelectedIndex(-1)}
            className={`text-left px-4 py-3 rounded-md border text-sm transition-colors ${
              selectedIndex === -1
                ? "border-primary bg-primary/5 text-primary dark:border-primary-light dark:bg-primary/10 dark:text-primary-light"
                : "border-gray-200 text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:text-gray-300 dark:hover:border-gray-600"
            }`}
          >
            All files · {allRecords.length} records
          </button>
          {fileModels.map((f, i) => (
            <FileSummaryCard
              key={`${f.filename}-${i}`}
              file={f}
              selected={selectedIndex === i}
              onSelect={() => setSelectedIndex(i)}
            />
          ))}
        </div>
      </Card>

      {/* Learner Preview */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Learner Preview
          <span className="font-normal text-gray-400 dark:text-gray-500 ml-2">
            Click a row to inspect its validation issues.
          </span>
        </h3>
        <PreviewTable records={visibleRecords} columns={COLUMNS} />
      </div>

      {/* Confirm controls */}
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="secondary" onClick={onBack}>
          ← Back to file selection
        </Button>

        <div className="flex items-center gap-3">
          {batch.blockingErrors && (
            <span className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
              <AlertTriangle size={14} />
              Fix blocking errors before importing.
            </span>
          )}
          {!batch.blockingErrors && batch.totalLearners === 0 && (
            <span className="text-xs text-gray-500 dark:text-gray-400">No learner records to import.</span>
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
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Result step
// ---------------------------------------------------------------------------
function ResultStep({ result, onDone }) {
  const ok = result && result.status === "success";
  const blocked = result && result.status === "blocked";
  return (
    <Card className="text-center animate-fade-in">
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
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            No records were written to Firestore. Review the validation issues before
            importing again.
          </p>
        </>
      ) : ok ? (
        <>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Import Complete</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {result.written} learner record(s) imported successfully.{" "}
            {result.skipped > 0 && `${result.skipped} already-existing record(s) skipped.`}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Import ID: {result.importId}</p>
        </>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400">No import result available.</p>
      )}

      <Button variant="primary" onClick={onDone} className="mt-6">
        <Upload size={16} /> Import More Files
      </Button>
    </Card>
  );
}
