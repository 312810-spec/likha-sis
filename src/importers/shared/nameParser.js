// src/importers/shared/nameParser.js
// Splits the single combined name cell used by DepEd LIS exports into discrete
// name parts. SF1 stores a learner as one string in the NAME column, e.g.
//
//   "SANTIAGO,MARIA ELENA, RIVERA"   -> last / first / middle
//   "BAUTISTA,ANA MARIE, -"          -> a "-" means "no middle name"
//   "DELGADO,RAMON, JR. SALAZAR"     -> the suffix rides along with the middle
//   "MERCADO,LUIS MIGUEL, III NAVARRO" -> same, with a roman-numeral suffix
//   "TOLENTINO,CARMEN,,"             -> trailing empty segments are noise
//
// Parent names use the same column but frequently carry only ONE comma, with
// the given and middle names separated by spaces ("MERCADO, ROMEO VILLAR JR").
// Both shapes are handled here so callers never re-implement the rules.
//
// The examples above are invented. Never copy learner names, LRNs or birth
// dates out of a real DepEd export into this repository — see the note in
// sf1LisLayout.test.js.

/** Name-extension tokens DepEd uses. Compared case-insensitively, dots ignored. */
const SUFFIX_TOKENS = new Set([
  "JR", "SR", "II", "III", "IV", "V", "VI", "VII", "VIII",
]);

/** Placeholder values LIS writes when a name part is simply absent. */
const PLACEHOLDERS = new Set(["", "-", "--", "---", "N/A", "NA", "NONE", "."]);

/** Strip a token down to letters/numbers so "JR." and "Jr" compare equal. */
function suffixKey(token) {
  return String(token).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** True when a token is a recognized name extension such as JR. or III. */
export function isSuffixToken(token) {
  return SUFFIX_TOKENS.has(suffixKey(token));
}

/** Collapse whitespace and treat LIS placeholders as empty. */
function clean(value) {
  if (value === null || value === undefined) return "";
  const s = String(value).replace(/\s+/g, " ").trim();
  return PLACEHOLDERS.has(s.toUpperCase()) ? "" : s;
}

/**
 * Pull a name extension out of a free-text segment. The suffix may lead the
 * segment ("JR. SALAZAR") or trail it ("ROMEO VILLAR JR"), so both ends are
 * checked. Never strips the ONLY token, so a lone "JR" stays as the name.
 * @returns {{ suffix: string, rest: string }}
 */
export function extractSuffix(segment) {
  const tokens = clean(segment).split(" ").filter((t) => clean(t) !== "");
  if (tokens.length < 2) return { suffix: "", rest: tokens.join(" ") };

  if (isSuffixToken(tokens[0])) {
    return { suffix: tokens[0], rest: tokens.slice(1).join(" ") };
  }
  const lastToken = tokens[tokens.length - 1];
  if (isSuffixToken(lastToken)) {
    return { suffix: lastToken, rest: tokens.slice(0, -1).join(" ") };
  }
  return { suffix: "", rest: tokens.join(" ") };
}

/**
 * Parse a combined DepEd name string into its parts.
 *
 * @param {string} value - the raw cell text
 * @returns {{ lastName, firstName, middleName, nameExtension, raw }}
 */
export function parsePersonName(value) {
  const raw = value === null || value === undefined ? "" : String(value).trim();
  const empty = {
    lastName: "",
    firstName: "",
    middleName: "",
    nameExtension: "",
    raw,
  };
  if (clean(raw) === "") return empty;

  // Split on commas, drop placeholder/empty segments from the tail.
  // The ORIGINAL comma count decides how to read what is left: LIS writes a
  // learner as "LAST,FIRST,MIDDLE" (2+ commas) but a parent as "LAST, FIRST
  // MIDDLE" (1 comma). Without this distinction "CAL,JOHN PAUL, -" would lose
  // its second given name to the parent-style space split.
  const commaCount = (raw.match(/,/g) || []).length;
  const parts = raw.split(",").map(clean);
  while (parts.length > 0 && parts[parts.length - 1] === "") parts.pop();
  if (parts.length === 0) return empty;

  const lastName = parts[0];

  // Comma-delimited learner shape, even if the middle segment was a placeholder.
  if (commaCount >= 2 && parts.length >= 2) {
    const firstSeg = extractSuffix(parts[1]);
    const middleSeg = extractSuffix(parts.slice(2).filter(Boolean).join(" "));
    return {
      ...empty,
      lastName,
      firstName: firstSeg.rest,
      middleName: middleSeg.rest,
      // A suffix can sit on either segment; the middle one wins because that is
      // where LIS actually puts it ("RAMON, JR. SALAZAR").
      nameExtension: middleSeg.suffix || firstSeg.suffix,
    };
  }

  // Only a surname was supplied.
  if (parts.length === 1) {
    // A single comma-free string may still hide a suffix ("CRUZ JR").
    const { suffix, rest } = extractSuffix(lastName);
    return { ...empty, lastName: rest || lastName, nameExtension: suffix };
  }

  // One comma: "LAST, FIRST [MIDDLE] [SUFFIX]" — the parent-name shape, where
  // the given and middle names are separated by spaces rather than a comma.
  const { suffix, rest } = extractSuffix(parts[1]);
  const tokens = rest.split(" ").filter(Boolean);
  if (tokens.length <= 1) {
    return { ...empty, lastName, firstName: tokens[0] || "", nameExtension: suffix };
  }
  // The trailing token is conventionally the middle name.
  return {
    ...empty,
    lastName,
    firstName: tokens.slice(0, -1).join(" "),
    middleName: tokens[tokens.length - 1],
    nameExtension: suffix,
  };
}

/**
 * Render name parts back into the official SF1 display form
 * "LAST, FIRST MIDDLE" (with the extension appended to the first name).
 */
export function formatPersonName({ lastName, firstName, middleName, nameExtension } = {}) {
  const first = [clean(firstName), clean(nameExtension)].filter(Boolean).join(" ");
  const tail = [first, clean(middleName)].filter(Boolean).join(" ");
  const last = clean(lastName);
  if (!last) return tail;
  if (!tail) return last;
  return `${last}, ${tail}`;
}
