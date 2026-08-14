// src/BrandingSettings.jsx

import { useState, useEffect, useRef } from "react";
import { doc, getDoc, setDoc, updateDoc, deleteField, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { extractThemeFromImage } from "./utils/extractTheme.js";
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
} from "lucide-react";

/**
 * Resizes an image file to max width/height preserving aspect ratio
 * and returns a compressed JPEG data URL (quality 0.7).
 */
function resizeImageToCanvas(file, maxWidth = 200, maxHeight = 200, quality = 0.7) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
      img.src = readerEvent.target.result;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

export default function BrandingSettings({ goBack }) {
  const [currentLogo, setCurrentLogo] = useState(null);
  const [currentTheme, setCurrentTheme] = useState(null);
  const [uploadedLogoUrl, setUploadedLogoUrl] = useState(null);
  const [extractedTheme, setExtractedTheme] = useState(null);

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
            setCurrentTheme(data.theme);
            setExtractedTheme(data.theme);
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

      const theme = await extractThemeFromImage(img);
      setExtractedTheme(theme);
    } catch (err) {
      console.error("Failed to extract theme from logo:", err);
      setErrorMessage("Failed to extract colors from the image. Please try again or use another image.");
    } finally {
      setIsExtracting(false);
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

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Palette className="text-primary" size={24} />
              School Branding & Dynamic Theme
            </h1>
          </div>
          <p className="text-sm text-gray-500 mt-1 dark:text-gray-400">
            Upload your school logo to extract brand colors and automatically customize LIKHA-SIS theme colors.
          </p>
        </div>
      </div>

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

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Step 1: Upload Logo */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4 dark:bg-gray-900 dark:border-gray-700">
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
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4 dark:bg-gray-900 dark:border-gray-700">
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
          {displayTheme ? (
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Extracted Color Palette
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {/* Primary Swatch */}
                <div className="p-2.5 rounded-lg border border-gray-200 bg-gray-50 dark:bg-gray-800 dark:border-gray-700 text-center space-y-1.5">
                  <div
                    className="w-full h-10 rounded shadow-inner"
                    style={{ backgroundColor: displayTheme.primary }}
                  />
                  <div className="text-xs font-bold text-gray-800 dark:text-gray-200">Primary</div>
                  <div className="text-[10px] text-gray-500 font-mono">{displayTheme.primary}</div>
                  <div className="flex gap-1 justify-center pt-1">
                    <div
                      className="w-4 h-4 rounded"
                      title={`Light: ${displayTheme.primaryLight}`}
                      style={{ backgroundColor: displayTheme.primaryLight }}
                    />
                    <div
                      className="w-4 h-4 rounded"
                      title={`Dark: ${displayTheme.primaryDark}`}
                      style={{ backgroundColor: displayTheme.primaryDark }}
                    />
                  </div>
                </div>

                {/* Accent Swatch */}
                <div className="p-2.5 rounded-lg border border-gray-200 bg-gray-50 dark:bg-gray-800 dark:border-gray-700 text-center space-y-1.5">
                  <div
                    className="w-full h-10 rounded shadow-inner"
                    style={{ backgroundColor: displayTheme.accent }}
                  />
                  <div className="text-xs font-bold text-gray-800 dark:text-gray-200">Accent</div>
                  <div className="text-[10px] text-gray-500 font-mono">{displayTheme.accent}</div>
                  <div className="flex gap-1 justify-center pt-1">
                    <div
                      className="w-4 h-4 rounded"
                      title={`Light: ${displayTheme.accentLight}`}
                      style={{ backgroundColor: displayTheme.accentLight }}
                    />
                    <div
                      className="w-4 h-4 rounded"
                      title={`Dark: ${displayTheme.accentDark}`}
                      style={{ backgroundColor: displayTheme.accentDark }}
                    />
                  </div>
                </div>

                {/* Leaf Swatch */}
                <div className="p-2.5 rounded-lg border border-gray-200 bg-gray-50 dark:bg-gray-800 dark:border-gray-700 text-center space-y-1.5">
                  <div
                    className="w-full h-10 rounded shadow-inner"
                    style={{ backgroundColor: displayTheme.leaf }}
                  />
                  <div className="text-xs font-bold text-gray-800 dark:text-gray-200">Leaf</div>
                  <div className="text-[10px] text-gray-500 font-mono">{displayTheme.leaf}</div>
                  <div className="flex gap-1 justify-center pt-1">
                    <div
                      className="w-4 h-4 rounded"
                      title={`Light: ${displayTheme.leafLight}`}
                      style={{ backgroundColor: displayTheme.leafLight }}
                    />
                    <div
                      className="w-4 h-4 rounded"
                      title={`Dark: ${displayTheme.leafDark}`}
                      style={{ backgroundColor: displayTheme.leafDark }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-xs text-gray-400 dark:text-gray-500 border border-dashed rounded-lg">
              No theme generated yet. Click "Generate Theme from Logo" to preview.
            </div>
          )}
        </div>
      </div>

      {/* Live Component Preview */}
      {displayTheme && (
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4 dark:bg-gray-900 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Live Component Preview
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Preview how buttons, badges, and cards look with the extracted theme before saving.
          </p>

          <div className="p-5 rounded-xl border border-gray-200 bg-gray-50 dark:bg-gray-800/60 dark:border-gray-700 grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            {/* Sample Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden dark:bg-gray-900 dark:border-gray-700">
              <div
                className="px-4 py-3 text-white flex items-center justify-between"
                style={{ backgroundColor: displayTheme.primary }}
              >
                <div className="font-semibold text-sm">School Dashboard Card</div>
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-bold"
                  style={{
                    backgroundColor: displayTheme.accent,
                    color: displayTheme.primaryDark,
                  }}
                >
                  Active SF9
                </span>
              </div>
              <div className="p-4 space-y-3">
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  Learner records and attendance will automatically adopt your custom school colors.
                </p>
                <div className="flex items-center gap-2">
                  <span
                    className="px-2 py-1 rounded-full text-xs font-semibold text-white"
                    style={{ backgroundColor: displayTheme.leaf }}
                  >
                    Enrolled: 1,240
                  </span>
                  <button
                    type="button"
                    className="px-3 py-1 rounded text-xs font-semibold text-white"
                    style={{ backgroundColor: displayTheme.primary }}
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
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-sm"
                  style={{ backgroundColor: displayTheme.primary }}
                >
                  Primary Action
                </button>
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg text-sm font-semibold shadow-sm"
                  style={{
                    backgroundColor: displayTheme.accent,
                    color: displayTheme.primaryDark,
                  }}
                >
                  Accent Action
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-sm"
                  style={{ backgroundColor: displayTheme.leaf }}
                >
                  Leaf / Success
                </button>
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg text-sm font-semibold border"
                  style={{
                    borderColor: displayTheme.primary,
                    color: displayTheme.primary,
                  }}
                >
                  Outline Primary
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
