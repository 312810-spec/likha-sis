// src/components/sf2/SF2RemarksDialog.jsx
// The Remarks pop-up for one learner: a simple Status choice (None /
// Transferred In / Transferred Out / Dropped Out + reason) instead of the
// old narrow in-table dropdown. Writes the exact same string values SF2 has
// always stored, so historical records keep matching (CLAUDE.md §14).

import { useEffect, useRef, useState } from "react";
import { X, Save } from "lucide-react";
import { DROPOUT_REASONS, dropoutLabel } from "../../utils/sf2Layout.js";

const RADIO_ROW = "flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 has-[:checked]:border-primary has-[:checked]:bg-primary/5 dark:has-[:checked]:bg-primary/10 min-h-[44px]";

function parseRemark(remark) {
  const r = String(remark || "").trim();
  if (!r) return { status: "none", reasonCode: "", legacyRaw: "" };
  if (r === "Transferred In") return { status: "transferredIn", reasonCode: "", legacyRaw: "" };
  if (r === "Transferred Out") return { status: "transferredOut", reasonCode: "", legacyRaw: "" };
  const dropMatch = /^Dropped Out - (\w+):/.exec(r);
  if (dropMatch && DROPOUT_REASONS.some((x) => x.code === dropMatch[1])) {
    return { status: "droppedOut", reasonCode: dropMatch[1], legacyRaw: "" };
  }
  // An older/unrecognized stored string -- kept verbatim unless the teacher
  // deliberately picks a different status below.
  return { status: "legacy", reasonCode: "", legacyRaw: r };
}

function buildRemark(status, reasonCode, legacyRaw) {
  if (status === "none") return "";
  if (status === "transferredIn") return "Transferred In";
  if (status === "transferredOut") return "Transferred Out";
  if (status === "droppedOut") return dropoutLabel(reasonCode || DROPOUT_REASONS[0].code);
  if (status === "legacy") return legacyRaw || "";
  return "";
}

export default function SF2RemarksDialog({
  learner,
  currentRemark,
  transferredOutHint = false,
  onSave,
  onCancel,
  returnFocusRef,
}) {
  const parsed = parseRemark(currentRemark);
  // A learner Transfers Log already marked "transferred-out", with no SF2
  // remark recorded yet, gets a helpful (non-destructive) default -- the
  // teacher can still change it before saving.
  const initialStatus = parsed.status === "none" && transferredOutHint ? "transferredOut" : parsed.status;

  const [status, setStatus] = useState(initialStatus);
  const [reasonCode, setReasonCode] = useState(parsed.reasonCode || DROPOUT_REASONS[0].code);
  const dialogRef = useRef(null);
  const firstFieldRef = useRef(null);

  useEffect(() => {
    firstFieldRef.current?.focus();
    function handleKeyDown(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    const elementToRefocus = returnFocusRef?.current;
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      elementToRefocus?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSubmit(e) {
    e.preventDefault();
    onSave(buildRemark(status, reasonCode, parsed.legacyRaw));
  }

  const learnerLabel = [learner?.lastName, learner?.firstName].filter(Boolean).join(", ") || "this learner";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sf2-remarks-title"
        className="w-full max-w-md rounded-xl bg-white dark:bg-gray-900 shadow-xl"
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 id="sf2-remarks-title" className="text-base font-bold text-gray-900 dark:text-gray-100">
              Remarks
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">{learnerLabel}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close remarks"
            className="p-2.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-5 space-y-4">
          {transferredOutHint && parsed.status === "none" && (
            <p className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
              Transfers Log shows this learner as Transferred Out. Change the status below if that's not correct.
            </p>
          )}

          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Status</legend>
            {[
              { value: "none", label: "None" },
              { value: "transferredIn", label: "Transferred In" },
              { value: "transferredOut", label: "Transferred Out" },
              { value: "droppedOut", label: "Dropped Out" },
              ...(parsed.status === "legacy" ? [{ value: "legacy", label: `As recorded: ${parsed.legacyRaw}` }] : []),
            ].map((opt, i) => (
              <label key={opt.value} className={RADIO_ROW}>
                <input
                  ref={i === 0 ? firstFieldRef : undefined}
                  type="radio"
                  name="sf2-remark-status"
                  value={opt.value}
                  checked={status === opt.value}
                  onChange={() => setStatus(opt.value)}
                  className="w-5 h-5 accent-primary"
                />
                <span className="text-base text-gray-800 dark:text-gray-100">{opt.label}</span>
              </label>
            ))}
          </fieldset>

          {status === "droppedOut" && (
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
              Reason
              <select
                value={reasonCode}
                onChange={(e) => setReasonCode(e.target.value)}
                className="mt-1.5 w-full text-base rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2.5 focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
              >
                {DROPOUT_REASONS.map((r) => (
                  <option key={r.code} value={r.code}>{r.label}</option>
                ))}
              </select>
            </label>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-sm font-semibold transition-colors min-h-[44px]"
            >
              <Save size={16} />
              Save Remarks
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
