// src/utils/sf1FitScale.js
// Pure math for the Live Register's "Fit to Screen" preview. The official
// SF1 sheet's own columns stay percentage-based (see importers/sf1/sf1Layout.js),
// so scaling never distorts the official proportions -- this only computes how
// much to shrink the whole sheet so it fits the available preview width.

// The sheet's fixed physical width is `.sf1-sheet { width: 11.3in }` in
// components/SF1PrintView.jsx's PRINT_CSS -- A4 landscape minus the real
// workbook's own left/right margins (measured via openpyxl page setup: A4,
// not Legal). 11.3in at the CSS-standard 96px/in is a constant, independent
// of how many learners are on the roster. Keep this in sync if that literal
// ever changes.
export const SF1_SHEET_NATURAL_WIDTH_PX = 11.3 * 96;

/**
 * The CSS zoom factor that fits a sheet of `naturalWidth` px into a container
 * of `containerWidth` px, without ever zooming IN past 100%. Returns 1 when
 * either measurement is missing/invalid, so a not-yet-measured preview
 * renders at true size rather than collapsing to 0.
 */
export function computeFitScale(containerWidth, naturalWidth) {
  if (!containerWidth || !naturalWidth || containerWidth <= 0 || naturalWidth <= 0) return 1;
  return Math.min(1, containerWidth / naturalWidth);
}
