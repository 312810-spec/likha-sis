// scripts/external-calendar/depedSourceDiscovery.mjs
// Finds the official DepEd issuance (Order or Memorandum) that publishes the
// school calendar for a given school year -- instead of depending on a
// hard-coded URL, which DepEd has already retired once (the historical
// deped.gov.ph/school-calendar/ page now 404s).
//
// Verified against the live site while building this (August 2026):
//   - deped.gov.ph/school-calendar/ -- dead, confirms hard-coding is unsafe.
//   - /wp-json/wp/v2/search -- returns 401 (disabled for anonymous callers),
//     so it's attempted but never relied on.
//   - /?s=<query> (on-site search) reliably surfaces the right issuance --
//     e.g. searching "three-term school calendar" returns "April 16, 2026
//     DO 009, s. 2026 - Guidelines on the Implementation of the Three-Term
//     School Calendar in Basic Education" as a top hit.
//   - Individual issuance posts (deped.gov.ph/YYYY/MM/DD/<slug>/) carry the
//     full "Month D, YYYY DO NNN, s. YYYY - Title" text in <h1
//     class="entry-title"> and link their PDF from
//     deped.gov.ph/wp-content/uploads/ -- that link is read from the page,
//     never constructed from a filename guess.
//   - The issuance index pages (/deped-orders/, /deped-memorandum/) use the
//     same entry-title markup and are checked as a supplementary source, but
//     alone are unreliable: they're JS-paginated and don't always surface
//     older issuances on first load.

import * as cheerio from "cheerio";

const ALLOWED_HOSTS = new Set(["deped.gov.ph", "www.deped.gov.ph"]);

/** True only for an https:// URL on DepEd's own domain (spec section 2). */
export function isOfficialDepedUrl(url) {
  if (!url) return false;
  try {
    const { hostname, protocol } = new URL(url);
    return protocol === "https:" && ALLOWED_HOSTS.has(hostname.toLowerCase());
  } catch {
    return false;
  }
}

// Real DepEd issuance titles read "DO 009, s. 2026" / "DM 009, s. 2026" --
// no literal "No." token, confirmed against live post titles while building
// this (e.g. "April 16, 2026 DO 009, s. 2026 - Guidelines on the
// Implementation of the Three-Term School Calendar in Basic Education").
const ISSUANCE_RE = /(DepEd\s+Order|DO|DepEd\s+Memorandum|DM)\s+(?:No\.?\s*)?(\d+),?\s*s\.?\s*(\d{4})/i;

/** Pulls { sourceType, sourceNumber, sourceYear } out of a DepEd issuance title, if present. */
export function extractIssuanceMeta(title) {
  const match = ISSUANCE_RE.exec(title || "");
  if (!match) return null;
  const raw = match[1].toLowerCase();
  const kind = raw.includes("order") || raw === "do" ? "DepEd Order" : "DepEd Memorandum";
  return { sourceType: kind, sourceNumber: match[2], sourceYear: match[3] };
}

const SEARCH_TERMS = (schoolYear) => {
  const [startYear] = schoolYear.split("-");
  return [
    `school calendar ${schoolYear}`,
    `three-term school calendar ${schoolYear}`,
    `school calendar activities ${schoolYear}`,
    `three-term school calendar guidelines basic education ${startYear}`,
    "DepEd Order school calendar",
    "DepEd Memorandum school calendar",
  ];
};

function candidateFromLink(sourceTitle, sourceUrl) {
  const meta = extractIssuanceMeta(sourceTitle);
  return {
    sourceTitle: sourceTitle.trim(),
    sourceUrl,
    sourceType: meta?.sourceType || "",
    sourceNumber: meta?.sourceNumber || "",
    sourceYear: meta?.sourceYear || "",
  };
}

/** Extracts `<h2 class="entry-title"><a href="...">Text</a></h2>` style result links. */
function extractEntryTitleLinks(html) {
  const $ = cheerio.load(html);
  const candidates = [];
  $("h2.entry-title a, a.tpg-post-link").each((_, el) => {
    const href = $(el).attr("href");
    const text = $(el).text();
    if (href && text) candidates.push(candidateFromLink(text, href));
  });
  return candidates;
}

async function tryWpSearch({ schoolYear, fetchImpl }) {
  const query = encodeURIComponent(`school calendar ${schoolYear}`);
  const res = await fetchImpl(`https://www.deped.gov.ph/wp-json/wp/v2/search?search=${query}&per_page=10`);
  if (!res.ok) return []; // known to 401 for anonymous callers -- not fatal
  const results = await res.json();
  if (!Array.isArray(results)) return [];
  return results
    .filter((r) => r?.url && r?.title)
    .map((r) => candidateFromLink(r.title, r.url));
}

async function trySiteSearch({ schoolYear, fetchImpl }) {
  const candidates = [];
  for (const term of SEARCH_TERMS(schoolYear)) {
    const res = await fetchImpl(`https://www.deped.gov.ph/?s=${encodeURIComponent(term)}`);
    if (!res.ok) continue;
    const html = await res.text();
    candidates.push(...extractEntryTitleLinks(html));
  }
  return candidates;
}

async function tryIssuanceIndexPages({ fetchImpl }) {
  const candidates = [];
  for (const url of ["https://www.deped.gov.ph/deped-orders/", "https://www.deped.gov.ph/deped-memorandum/"]) {
    const res = await fetchImpl(url);
    if (!res.ok) continue;
    const html = await res.text();
    candidates.push(...extractEntryTitleLinks(html));
  }
  return candidates;
}

/**
 * Known current official issuance for a school year, used only when live
 * discovery (steps 1-3) finds nothing official. Intentionally NOT the
 * primary mechanism -- a future school year will have a different DepEd
 * Order/Memorandum, and this map is not expected to be kept up to date on
 * its own.
 */
const KNOWN_FALLBACK_ISSUANCES = {
  "2026-2027": {
    sourceTitle: "DepEd Order No. 009, s. 2026 - Guidelines on the Implementation of the Three-Term School Calendar in Basic Education",
    sourceUrl: "https://www.deped.gov.ph/2026/04/16/april-16-2026-do-009-s-2026-guidelines-on-the-implementation-of-the-three-term-school-calendar-in-basic-education/",
    sourcePdfUrl: "https://www.deped.gov.ph/wp-content/uploads/DO_s2026_009r.pdf",
    sourceType: "DepEd Order",
    sourceNumber: "009",
    sourceYear: "2026",
  },
};

function scoreCandidate(candidate, schoolYear) {
  const title = (candidate.sourceTitle || "").toLowerCase();
  const [startYear] = schoolYear.split("-");
  let score = 0;

  if (title.includes(schoolYear)) score += 100;
  else if (title.includes(startYear)) score += 40;

  if (/three-term school calendar/.test(title)) score += 50;
  else if (/school calendar and activities/.test(title)) score += 40;
  else if (/school calendar/.test(title)) score += 30;

  if (candidate.sourceType === "DepEd Order") score += 15;
  else if (candidate.sourceType === "DepEd Memorandum") score += 10;

  if (candidate.sourceYear && Number(candidate.sourceYear) === Number(startYear)) score += 20;

  return score;
}

/**
 * Ranks and returns the single best official DepEd source for a school
 * year's calendar, or null if nothing official was found anywhere
 * (including the fallback). `fetchImpl` is injectable for tests.
 */
export async function discoverDepedCalendarSource({ schoolYear, fetchImpl = fetch } = {}) {
  const gathered = [];
  for (const attempt of [tryWpSearch, trySiteSearch, tryIssuanceIndexPages]) {
    try {
      gathered.push(...(await attempt({ schoolYear, fetchImpl })));
    } catch (error) {
      console.warn(`[depedSourceDiscovery] Discovery step failed, continuing: ${error.message}`);
    }
  }

  const official = gathered.filter((c) => isOfficialDepedUrl(c.sourceUrl));
  if (official.length > 0) {
    official.sort((a, b) => scoreCandidate(b, schoolYear) - scoreCandidate(a, schoolYear));
    return official[0];
  }

  const fallback = KNOWN_FALLBACK_ISSUANCES[schoolYear];
  if (fallback && isOfficialDepedUrl(fallback.sourceUrl) && isOfficialDepedUrl(fallback.sourcePdfUrl)) {
    console.warn(`[depedSourceDiscovery] Live discovery found nothing for ${schoolYear} -- using known fallback issuance.`);
    return fallback;
  }

  return null;
}

/**
 * Given a chosen source candidate, fetches its post page and reads the
 * actual linked PDF URL off it (never constructs a filename guess) plus
 * whether the page itself has an HTML calendar table.
 */
export async function resolveDepedSourceContent({ candidate, fetchImpl = fetch }) {
  if (candidate.sourcePdfUrl) {
    // Fallback entries already carry a verified PDF URL.
    return { ...candidate, html: null };
  }
  if (!candidate.sourceUrl) return { ...candidate, sourcePdfUrl: "", html: null };

  const res = await fetchImpl(candidate.sourceUrl);
  if (!res.ok) return { ...candidate, sourcePdfUrl: "", html: null };
  const html = await res.text();

  const $ = cheerio.load(html);
  let sourcePdfUrl = "";
  $("a[href$='.pdf']").each((_, el) => {
    if (sourcePdfUrl) return;
    const href = $(el).attr("href");
    if (isOfficialDepedUrl(href)) sourcePdfUrl = href;
  });

  return { ...candidate, sourcePdfUrl, html };
}
