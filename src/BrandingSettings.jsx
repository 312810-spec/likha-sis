// src/BrandingSettings.jsx

import { useState, useEffect, useRef } from "react";
import { doc, getDoc, setDoc, updateDoc, deleteField, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import {
  extractThemeSuggestionsFromImage,
  deriveDarkThemeFromLight,
  overrideThemeRole,
  buildTextOnRoles,
} from "./utils/extractTheme.js";
import { resizeImageToCanvas } from "./utils/resizeImage.js";
import ThemeSuggestionPicker from "./components/ThemeSuggestionPicker.jsx";
import {
  Palette,
  Upload,
  Sparkles,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
  ArrowLeft,
  Sun,
  Moon,
} from "lucide-react";

// Preview-only surfaces (not the app's own .dark class), matching the
// Branding & Theme spec's named light/dark surfaces. The preview toggle
// must work regardless of which mode the app itself is currently in, so
// these are applied via inline style rather than Tailwind's dark: variant.
const PREVIEW_SURFACES = {
  light: { page: "#F8FAFC", card: "#FFFFFF", border: "#E2E8F0", text: "#334155", subtext: "#64748B" },
  dark: { page: "#090D16", card: "#131826", border: "#232B3D", text: "#E2E8F0", subtext: "#94A3B8" },
};

/**
 * Ensures a theme object (freshly generated, saved, or loaded from
 * Firestore before dual-mode support existed) always has `.dark` and
 * `.textOn`, so every consumer in this file can rely on both being present.
 */
function ensureDualMode(theme) {
  if (!theme || !theme.primary) return theme;
  const dark = theme.dark || deriveDarkThemeFromLight(theme);
  const textOn = theme.textOn || buildTextOnRoles(theme, dark);
  if (theme.dark && theme.textOn) return theme;
  return { ...theme, dark, textOn };
}

// `embedded` renders this as a tab inside SchoolSettings (no page header, no
// outer page width) instead of as a standalone page.
export default function BrandingSettings({ goBack, embedded = false }) {
  const [currentLogo, setCurrentLogo] = useState(null);
  const [currentTheme, setCurrentTheme] = useState(null);
  const [uploadedLogoUrl, setUploadedLogoUrl] = useState(null);
  const [extractedTheme, setExtractedTheme] = useState(null);
  const [themeSuggestions, setThemeSuggestions] = useState([]);
  const [selectedThemeIndex, setSelectedThemeIndex] = useState(0);
  const [previewMode, setPreviewMode] = useState("light");

  const [loadingDoc, setLoadingDoc] = useState(true);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const fileInputRef = useRef(null);

  useEffect(() => {
    async function loadConfig() {
      try {
        const ref = doc(db, "settings", "schoolConfig");
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          if (data.logo) setCurrentLogo(data.logo);
          if (data.theme) {
            const dualModeTheme = ensureDualMode(data.theme);
            setCurrentTheme(dualModeTheme);
            setExtractedTheme(dualModeTheme);
          }
        }
      } catch (err) {
        console.error("Failed to load branding settings:", err);
      } finally {
        setLoadingDoc(false);
      }
    }
    loadConfig();
  }, []);

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMessage("Please select a valid image file (PNG, JPEG, etc.).");
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    try {
      const resizedDataUrl = await resizeImageToCanvas(file, 200, 200, 0.7);
      setUploadedLogoUrl(resizedDataUrl);
    } catch (err) {
      console.error("Failed to process image:", err);
      setErrorMessage("Could not process the selected image. Please try another file.");
    }
  }

  async function handleGenerateTheme() {
    const imageSrc = uploadedLogoUrl || currentLogo;
    if (!imageSrc) {
      setErrorMessage("Please upload a logo first to generate a theme.");
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");
    setIsExtracting(true);

    try {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imageSrc;
      });

      const suggestions = await extractThemeSuggestionsFromImage(img);
      setThemeSuggestions(suggestions);
      setSelectedThemeIndex(0);
      setExtractedTheme(suggestions[0]?.theme || null);
    } catch (err) {
      console.error("Failed to extract theme from logo:", err);
      setErrorMessage("Failed to extract colors from the image. Please try again or use another image.");
    } finally {
      setIsExtracting(false);
    }
  }

  function handleSelectThemeSuggestion(index) {
    setSelectedThemeIndex(index);
    setExtractedTheme(themeSuggestions[index]?.theme || null);
  }

  function handleOverrideRole(suggestionIndex, role, overrides) {
    setThemeSuggestions((prev) =>
      prev.map((s, i) => (i === suggestionIndex ? { ...s, theme: overrideThemeRole(s.theme, role, overrides) } : s))
    );
    if (themeSuggestions.length === 0 || suggestionIndex === selectedThemeIndex) {
      setExtractedTheme((prev) => overrideThemeRole(prev, role, overrides));
    }
  }

  async function handleSave() {
    if (!uploadedLogoUrl && !extractedTheme) {
      setErrorMessage("No changes to save. Upload a logo or generate a theme first.");
      return;
    }

    setErrorMessage("");
    setIsSaving(true);

    try {
      const ref = doc(db, "settings", "schoolConfig");
      const payload = {
        updatedAt: serverTimestamp(),
      };
      if (uploadedLogoUrl) {
        payload.logo = uploadedLogoUrl;
      }
      if (extractedTheme) {
        payload.theme = extractedTheme;
      }

      await setDoc(ref, payload, { merge: true });
      if (uploadedLogoUrl) setCurrentLogo(uploadedLogoUrl);
      if (extractedTheme) setCurrentTheme(extractedTheme);

      setSuccessMessage(
        "Branding settings saved successfully! It may take a moment to appear across the app."
      );
    } catch (err) {
      console.error("Failed to save branding:", err);
      setErrorMessage("Failed to save branding settings. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleResetDefaults() {
    setErrorMessage("");
    setIsResetting(true);

    try {
      const ref = doc(db, "settings", "schoolConfig");
      await updateDoc(ref, {
        theme: deleteField(),
        updatedAt: serverTimestamp(),
      });

      setCurrentTheme(null);
      setExtractedTheme(null);
      setThemeSuggestions([]);
      setSelectedThemeIndex(0);
      setSuccessMessage("Brand theme has been reset to Tingub NHS default colors.");
    } catch (err) {
      console.error("Failed to reset theme:", err);
      setErrorMessage("Failed to reset theme. Please try again.");
    } finally {
      setIsResetting(false);
    }
  }

  const activeLogo = uploadedLogoUrl || currentLogo || "/Tingub%20National%20High%20School%28clear%29.png";
  const displayTheme = extractedTheme || currentTheme;
  const previewSurface = PREVIEW_SURFACES[previewMode];

  function previewColor(role) {
    if (!displayTheme) return previewSurface.text;
    return previewMode === "dark" ? displayTheme.dark?.[role] || displayTheme[role] : displayTheme[role];
  }

  function previewTextOn(role) {
    if (!displayTheme?.textOn) return "#FFFFFF";
    return displayTheme.textOn[previewMode]?.[role] || "#FFFFFF";
  }

  return (
    <div className={embedded ? "space-y-6" : "max-w-4xl mx-auto space-y-6 pb-12"}>
      {/* Header -- suppressed when embedded as a School Settings tab, which
          supplies its own page header. */}
      {!embedded && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-200 pb-4 dark:border-gray-700">
          <div>
            <div className="flex items-center gap-2">
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
              <h1 className="font-display text-2xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Palette className="text-primary" size={24} />
                School Branding & Dynamic Theme
              </h1>
            </div>
            <p className="text-sm text-gray-500 mt-1 dark:text-gray-400">
              Upload your school logo to extract brand colors and automatically customize LIKHA-SIS theme colors.
            </p>
          </div>
        </div>
      )}

      {/* Alerts */}
      {successMessage && (
        <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-green-800 flex items-start gap-3 dark:bg-green-950/30 dark:border-green-800 dark:text-green-300">
          <CheckCircle2 size={20} className="flex-shrink-0 mt-0.5" />
          <p className="text-sm font-medium">{successMessage}</p>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 flex items-start gap-3 dark:bg-red-950/30 dark:border-red-800 dark:text-red-300">
          <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
          <p className="text-sm font-medium">{errorMessage}</p>
        </div>
      )}

      {/* Main Grid -- extraction controls + swatches on the left, the live
          dual-mode preview on the right on wide screens; stacked below
          that so the preview never has to be scrolled past to be edited. */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start gap-6 space-y-6 lg:space-y-0">
      <div className="space-y-6">
        {/* Step 1: Upload Logo */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-card space-y-4 dark:bg-gray-900 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">
              1
            </span>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              School Logo
            </h2>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Select an image file. It will be resized client-side to a max of 200x200px and converted to a compressed JPEG.
          </p>

          <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 dark:bg-gray-800/50 dark:border-gray-700 space-y-4">
            <div className="w-32 h-32 rounded-lg bg-white shadow-sm border border-gray-200 flex items-center justify-center overflow-hidden p-2 dark:bg-gray-800 dark:border-gray-700">
              {loadingDoc ? (
                <span className="text-xs text-gray-400">Loading...</span>
              ) : activeLogo ? (
                <img
                  src={activeLogo}
                  alt="School logo preview"
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <ImageIcon size={36} className="text-gray-400" />
              )}
            </div>

            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
              id="school-logo-input"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm transition dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <Upload size={16} />
              {uploadedLogoUrl ? "Change Logo" : "Upload Logo"}
            </button>
            {uploadedLogoUrl && (
              <span className="text-xs text-green-600 font-medium dark:text-green-400">
                ✓ Ready for theme generation
              </span>
            )}
          </div>
        </div>

        {/* Step 2: Generate Theme */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-card space-y-4 dark:bg-gray-900 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">
              2
            </span>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Generate Brand Theme
            </h2>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Extracts dominant colors from the uploaded logo, ensures readable contrast, and calculates light/dark variants.
          </p>

          <button
            type="button"
            disabled={isExtracting || (!uploadedLogoUrl && !currentLogo)}
            onClick={handleGenerateTheme}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-light transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            <Sparkles size={16} />
            {isExtracting ? "Extracting Colors..." : "Generate Theme from Logo"}
          </button>

          {/* Color Swatches */}
          {themeSuggestions.length > 0 ? (
            <div className="pt-2">
              <ThemeSuggestionPicker
                suggestions={themeSuggestions}
                selectedIndex={selectedThemeIndex}
                onSelect={handleSelectThemeSuggestion}
                onOverrideRole={handleOverrideRole}
              />
            </div>
          ) : displayTheme ? (
            <div className="pt-2">
              <ThemeSuggestionPicker
                suggestions={[{ label: "Current Theme", theme: displayTheme }]}
                selectedIndex={0}
                onSelect={() => {}}
                onOverrideRole={handleOverrideRole}
              />
            </div>
          ) : (
            <div className="text-center py-6 text-xs text-gray-400 dark:text-gray-500 border border-dashed rounded-lg">
              No theme generated yet. Click "Generate Theme from Logo" to preview.
            </div>
          )}
        </div>
      </div>

      {/* Live Component Preview -- driven entirely by inline styles keyed
          off local previewMode state, not Tailwind's dark: variant, so the
          Light/Dark toggle works regardless of the app's own current theme. */}
      <div
        className="p-6 rounded-xl border space-y-4"
        style={{ backgroundColor: previewSurface.card, borderColor: previewSurface.border }}
      >
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-base font-semibold" style={{ color: previewSurface.text }}>
              Live Component Preview
            </h2>
            <p className="text-xs mt-0.5" style={{ color: previewSurface.subtext }}>
              Preview buttons, badges, and cards in both modes before saving.
            </p>
          </div>

          {/* Light / Dark segment toggle */}
          <div className="relative inline-flex items-center rounded-full p-0.5 bg-gray-100 dark:bg-gray-800 flex-shrink-0">
            <span
              aria-hidden="true"
              className="absolute top-0.5 left-0.5 w-[74px] h-7 rounded-full bg-white shadow-sm dark:bg-gray-700 transition-transform duration-200 ease-out"
              style={{ transform: `translateX(${previewMode === "dark" ? 74 : 0}px)` }}
            />
            <button
              type="button"
              onClick={() => setPreviewMode("light")}
              aria-pressed={previewMode === "light"}
              className={`relative z-10 w-[74px] h-7 flex items-center justify-center gap-1 rounded-full text-xs font-semibold transition-colors duration-150 ${
                previewMode === "light" ? "text-primary dark:text-white" : "text-gray-500 dark:text-gray-400"
              }`}
            >
              <Sun size={13} /> Light
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode("dark")}
              aria-pressed={previewMode === "dark"}
              className={`relative z-10 w-[74px] h-7 flex items-center justify-center gap-1 rounded-full text-xs font-semibold transition-colors duration-150 ${
                previewMode === "dark" ? "text-primary dark:text-white" : "text-gray-500 dark:text-gray-400"
              }`}
            >
              <Moon size={13} /> Dark
            </button>
          </div>
        </div>

        {displayTheme ? (
          <div
            className="p-5 rounded-xl border grid grid-cols-1 sm:grid-cols-2 gap-4 items-center transition-colors duration-200"
            style={{ backgroundColor: previewSurface.page, borderColor: previewSurface.border }}
          >
            {/* Sample Card */}
            <div
              className="rounded-lg shadow-sm border overflow-hidden"
              style={{ backgroundColor: previewSurface.card, borderColor: previewSurface.border }}
            >
              <div
                className="px-4 py-3 flex items-center justify-between"
                style={{ backgroundColor: previewColor("primary"), color: previewTextOn("primary") }}
              >
                <div className="font-semibold text-sm">School Dashboard Card</div>
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-bold"
                  style={{ backgroundColor: previewColor("accent"), color: previewTextOn("accent") }}
                >
                  Active SF9
                </span>
              </div>
              <div className="p-4 space-y-3">
                <p className="text-xs" style={{ color: previewSurface.subtext }}>
                  Learner records and attendance will automatically adopt your custom school colors.
                </p>
                <div className="flex items-center gap-2">
                  <span
                    className="px-2 py-1 rounded-full text-xs font-semibold"
                    style={{ backgroundColor: previewColor("leaf"), color: previewTextOn("leaf") }}
                  >
                    Enrolled: 1,240
                  </span>
                  <button
                    type="button"
                    className="px-3 py-1 rounded text-xs font-semibold"
                    style={{ backgroundColor: previewColor("primary"), color: previewTextOn("primary") }}
                  >
                    Action
                  </button>
                </div>
              </div>
            </div>

            {/* Sample Buttons & Elements */}
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg text-sm font-semibold shadow-sm"
                  style={{ backgroundColor: previewColor("primary"), color: previewTextOn("primary") }}
                >
                  Primary Action
                </button>
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg text-sm font-semibold shadow-sm"
                  style={{ backgroundColor: previewColor("accent"), color: previewTextOn("accent") }}
                >
                  Accent Action
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg text-sm font-semibold shadow-sm"
                  style={{ backgroundColor: previewColor("leaf"), color: previewTextOn("leaf") }}
                >
                  Leaf / Success
                </button>
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg text-sm font-semibold border"
                  style={{ borderColor: previewColor("primary"), color: previewColor("primary") }}
                >
                  Outline Primary
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div
            className="p-8 rounded-xl border border-dashed text-center text-xs"
            style={{ borderColor: previewSurface.border, color: previewSurface.subtext }}
          >
            Generate or select a theme to preview it here in both modes.
          </div>
        )}
      </div>
      </div>

      {/* Action Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          disabled={isResetting || isSaving}
          onClick={handleResetDefaults}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800 transition disabled:opacity-50"
        >
          <RotateCcw size={16} />
          {isResetting ? "Resetting..." : "Reset to Default Colors"}
        </button>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            disabled={isSaving || (!uploadedLogoUrl && !extractedTheme)}
            onClick={handleSave}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-light transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={16} />
            {isSaving ? "Saving..." : "Save Branding Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}
