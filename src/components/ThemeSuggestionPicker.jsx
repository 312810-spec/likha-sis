// src/components/ThemeSuggestionPicker.jsx
// Renders up to 3 candidate brand themes (see extractThemeSuggestionsFromImage)
// as selectable cards, each showing Primary/Accent/Leaf swatches with their
// light/dark variants, so the ICT Coordinator can pick the combination that
// best represents the school's logo instead of being locked into one guess.
// Each swatch also shows WCAG contrast badges for both modes and, when
// `onOverrideRole` is provided, a popover to manually tweak the light/dark
// hex value.

import { useEffect, useRef, useState } from "react";
import { Check, Pencil } from "lucide-react";
import { getContrastRatio, getWcagLevel } from "../utils/colorTheory.js";

// Matches the surfaces named in the Branding & Theme spec: light-mode
// swatches are checked against the app's light surface, dark-mode
// swatches against the app's near-black dark surface.
const LIGHT_SURFACE = "#F8FAFC";
const DARK_SURFACE = "#090D16";

function ContrastBadge({ label, ratio }) {
  const level = getWcagLevel(ratio);
  const tone =
    level === "AAA"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
      : level === "AA"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
        : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400";

  return (
    <span
      title={`${label}: contrast ${ratio.toFixed(1)}:1`}
      className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[8px] font-bold leading-none ${tone}`}
    >
      {label} {level === "FAIL" ? "✕" : "✓"} {level !== "FAIL" ? level : ""}
    </span>
  );
}

function SwatchOverridePopover({ roleLabel, lightHex, darkHex, onApply, onClose }) {
  const [lightValue, setLightValue] = useState(lightHex);
  const [darkValue, setDarkValue] = useState(darkHex);
  const popoverRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const hexPattern = /^#[0-9A-Fa-f]{6}$/;

  function commit() {
    const overrides = {};
    if (hexPattern.test(lightValue) && lightValue.toUpperCase() !== lightHex.toUpperCase()) {
      overrides.light = lightValue;
    }
    if (hexPattern.test(darkValue) && darkValue.toUpperCase() !== darkHex.toUpperCase()) {
      overrides.dark = darkValue;
    }
    if (overrides.light || overrides.dark) onApply(overrides);
    onClose();
  }

  return (
    <div
      ref={popoverRef}
      onClick={(e) => e.stopPropagation()}
      className="absolute z-30 top-full left-1/2 -translate-x-1/2 mt-1.5 w-44 p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg space-y-2 animate-fade-in"
    >
      <div className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        Override {roleLabel}
      </div>
      <label className="block">
        <span className="text-[9px] text-gray-500 dark:text-gray-400">Light mode hex</span>
        <input
          type="text"
          value={lightValue}
          onChange={(e) => setLightValue(e.target.value)}
          className="mt-0.5 w-full text-[11px] font-mono px-1.5 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-primary/40 focus:border-primary outline-none"
        />
      </label>
      <label className="block">
        <span className="text-[9px] text-gray-500 dark:text-gray-400">Dark mode hex</span>
        <input
          type="text"
          value={darkValue}
          onChange={(e) => setDarkValue(e.target.value)}
          className="mt-0.5 w-full text-[11px] font-mono px-1.5 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-primary/40 focus:border-primary outline-none"
        />
      </label>
      <div className="flex gap-1.5 pt-0.5">
        <button
          type="button"
          onClick={commit}
          className="flex-1 text-[10px] font-semibold px-2 py-1 rounded bg-primary text-white hover:bg-primary-light transition-colors"
        >
          Apply
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex-1 text-[10px] font-semibold px-2 py-1 rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function RoleSwatch({ roleKey, roleLabel, theme, compact, onOverrideRole }) {
  const [popoverOpen, setPopoverOpen] = useState(false);

  const lightHex = theme[roleKey];
  const darkHex = theme.dark?.[roleKey] || lightHex;
  const tintLight = theme[`${roleKey}Light`];
  const tintDark = theme[`${roleKey}Dark`];

  const lightRatio = getContrastRatio(lightHex, LIGHT_SURFACE);
  const darkRatio = getContrastRatio(darkHex, DARK_SURFACE);

  return (
    <div
      className={`relative rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-center ${
        compact ? "p-1.5 space-y-1" : "p-2.5 space-y-1.5"
      }`}
    >
      <div className="relative">
        <div
          className={`w-full rounded shadow-inner ${compact ? "h-6" : "h-9"}`}
          style={{ backgroundColor: lightHex }}
        />
        {onOverrideRole && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPopoverOpen((v) => !v);
            }}
            aria-label={`Override ${roleLabel} colors`}
            className="absolute top-0.5 right-0.5 w-4 h-4 rounded flex items-center justify-center bg-black/25 text-white opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity"
          >
            <Pencil size={9} />
          </button>
        )}
      </div>

      <div className={`font-bold text-gray-800 dark:text-gray-200 ${compact ? "text-[10px]" : "text-xs"}`}>
        {roleLabel}
      </div>
      <div className={`text-gray-500 dark:text-gray-400 font-mono ${compact ? "text-[8px]" : "text-[10px]"}`}>
        {lightHex}
      </div>

      <div className="flex gap-1 justify-center pt-0.5">
        <div
          className={compact ? "w-2.5 h-2.5 rounded" : "w-3.5 h-3.5 rounded"}
          title={`Light tint: ${tintLight}`}
          style={{ backgroundColor: tintLight }}
        />
        <div
          className={compact ? "w-2.5 h-2.5 rounded" : "w-3.5 h-3.5 rounded"}
          title={`Dark tint: ${tintDark}`}
          style={{ backgroundColor: tintDark }}
        />
      </div>

      <div className="flex flex-wrap gap-1 justify-center pt-0.5">
        <ContrastBadge label="☀" ratio={lightRatio} />
        <ContrastBadge label="🌙" ratio={darkRatio} />
      </div>

      {popoverOpen && onOverrideRole && (
        <SwatchOverridePopover
          roleLabel={roleLabel}
          lightHex={lightHex}
          darkHex={darkHex}
          onClose={() => setPopoverOpen(false)}
          onApply={(overrides) => onOverrideRole(roleKey, overrides)}
        />
      )}
    </div>
  );
}

/**
 * `suggestions`: array of { label, theme } from extractThemeSuggestionsFromImage.
 * `selectedIndex`: index of the currently chosen suggestion.
 * `onSelect(index)`: called when the user picks a different suggestion.
 * `onOverrideRole(suggestionIndex, role, { light, dark })`: optional; when
 * given, each swatch gets a manual-override popover for that suggestion.
 * `compact`: tighter sizing for the narrower SetupWizard column.
 */
export default function ThemeSuggestionPicker({
  suggestions,
  selectedIndex,
  onSelect,
  onOverrideRole,
  compact = false,
}) {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      <h4
        className={`font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 ${
          compact ? "text-[11px]" : "text-xs"
        }`}
      >
        {suggestions.length > 1 ? "Choose a Palette" : "Extracted Palette"}
      </h4>

      <div
        className={`grid gap-2 ${
          suggestions.length > 1 && !compact ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1"
        }`}
      >
        {suggestions.map(({ label, theme }, idx) => {
          const isSelected = idx === selectedIndex;
          return (
            <div
              key={label}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(idx)}
              onKeyDown={(e) => {
                // Don't hijack Enter/Space typed into a nested override
                // popover (hex inputs, Apply/Cancel buttons) -- only the
                // card surface itself should toggle selection.
                if (e.target.tagName === "INPUT" || e.target.tagName === "BUTTON") return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(idx);
                }
              }}
              aria-pressed={isSelected}
              className={`relative text-left rounded-xl border-2 transition-all duration-150 cursor-pointer ${
                compact ? "p-2" : "p-3"
              } ${
                isSelected
                  ? "border-primary bg-primary/5 shadow-card dark:bg-primary/10"
                  : "border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-800/40 hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-card"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span
                  className={`font-semibold ${compact ? "text-[11px]" : "text-xs"} ${
                    isSelected ? "text-primary dark:text-primary-light" : "text-gray-600 dark:text-gray-300"
                  }`}
                >
                  {label}
                </span>
                {isSelected && (
                  <span className="w-4 h-4 rounded-full bg-primary text-white flex items-center justify-center animate-fade-in">
                    <Check size={11} strokeWidth={3} />
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-1">
                <RoleSwatch
                  roleKey="primary"
                  roleLabel="Primary"
                  theme={theme}
                  compact={compact}
                  onOverrideRole={onOverrideRole ? (role, overrides) => onOverrideRole(idx, role, overrides) : null}
                />
                <RoleSwatch
                  roleKey="accent"
                  roleLabel="Accent"
                  theme={theme}
                  compact={compact}
                  onOverrideRole={onOverrideRole ? (role, overrides) => onOverrideRole(idx, role, overrides) : null}
                />
                <RoleSwatch
                  roleKey="leaf"
                  roleLabel="Leaf"
                  theme={theme}
                  compact={compact}
                  onOverrideRole={onOverrideRole ? (role, overrides) => onOverrideRole(idx, role, overrides) : null}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
