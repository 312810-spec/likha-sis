// scripts/external-calendar/pagasaParser.mjs
// Pure text-parsing logic for official PAGASA sources -- no network or
// Firestore calls here. HTML is the primary source (spec section 9); a
// linked bulletin PDF is only a fallback when the HTML page doesn't carry
// the bulletin content inline. Both the HTML-derived text and the
// PDF-extracted text go through the same `parseBulletinText`, since PAGASA's
// bulletin wording is identical either way (verified against a real
// TROPICAL CYCLONE BULLETIN NR. 1 PDF for Tropical Depression Neneng while
// building this).
//
// Verified against the live site while building this (August 2026):
//   - pagasa.dost.gov.ph/tropical-cyclone/severe-weather-bulletin has two
//     independent sections: an "article-header" labelled "Tropical Cyclone
//     Bulletin" (the current status) and a separate one labelled "Archive"
//     (past cyclones, PDF links only). The original Cloud Run implementation
//     picked "the highest-numbered TCB PDF" from the whole page, which would
//     have picked up an *archived* bulletin as if it were current -- this
//     parser scopes strictly to the non-Archive section.
//   - The clean/inactive text is exactly "No Active Tropical Cyclone within
//     the Philippine Area of Responsibility".
//   - pagasa.dost.gov.ph/weather/weather-advisory has a
//     ".weekly-content-adv" block reading exactly "As of today, there is no
//     Weather Advisory issued." when clean.
//   - Regional pages live at /regional-forecast/{ncrprsd,nlprsd,slprsd,
//     visprsd,minprsd} -- the 5 real PAGASA Regional Services Division
//     slugs (not the 17 DepEd administrative regions).

import * as cheerio from "cheerio";

const ALLOWED_HOSTS = new Set(["pagasa.dost.gov.ph", "www.pagasa.dost.gov.ph", "bagong.pagasa.dost.gov.ph", "pubfiles.pagasa.dost.gov.ph"]);

/**
 * Converts a fragment of HTML to text, inserting a newline at block-element
 * boundaries first. cheerio's plain `.text()` concatenates adjacent block
 * elements with no separator at all (`<p>Typhoon AGATON</p><p>Issued at...`
 * becomes `"Typhoon AGATONIssued at..."`), which silently corrupts
 * word-boundary regexes -- this avoids that.
 */
function blockText(html) {
  if (!html) return "";
  return html
    .replace(/<(p|div|li|br|tr|h[1-6]|section|article)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/** True only for an https:// URL on an official PAGASA/DOST-hosted domain. */
export function isOfficialPagasaUrl(url) {
  if (!url) return false;
  try {
    const { hostname, protocol } = new URL(url);
    return protocol === "https:" && ALLOWED_HOSTS.has(hostname.toLowerCase());
  } catch {
    return false;
  }
}

const MONTHS_FULL = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

/** Builds an ISO timestamp in Philippine Standard Time (UTC+8, no DST) from PAGASA's date/time text. */
function toIso(dateText, timeText) {
  const dateMatch = /(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/.exec(dateText || "");
  if (!dateMatch) return "";
  const [, day, monthName, year] = dateMatch;
  const month = MONTHS_FULL[monthName.toLowerCase()];
  if (month === undefined) return "";

  let hour = 0;
  let minute = 0;
  const timeMatch = /(\d{1,2}):(\d{2})\s*([AP]M)/i.exec(timeText || "");
  if (timeMatch) {
    hour = Number(timeMatch[1]) % 12;
    minute = Number(timeMatch[2]);
    if (/PM/i.test(timeMatch[3])) hour += 12;
  }

  const pad = (n) => String(n).padStart(2, "0");
  return `${year}-${pad(month + 1)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00+08:00`;
}

function extractSignalLevels(text) {
  if (/No Wind Signal is currently hoisted/i.test(text)) return [];
  const levels = [];
  const headingRe = /Wind Signal No\.?\s*(\d+)/gi;
  const matches = [...text.matchAll(headingRe)];
  for (let i = 0; i < matches.length; i += 1) {
    const start = matches[i].index + matches[i][0].length;
    const nextHeadingStart = matches[i + 1]?.index ?? text.length;
    const preparedByIdx = text.indexOf("Prepared by", start);
    const end = preparedByIdx !== -1 && preparedByIdx < nextHeadingStart ? preparedByIdx : nextHeadingStart;
    // Areas are grouped under an island-group label, e.g. "Luzon: Cagayan,
    // Isabela, Batanes" -- split on the colon too and drop the label itself.
    const areas = text
      .slice(start, end)
      .split(/[,;:]/)
      .map((s) => s.replace(/\s+/g, " ").trim())
      .filter((s) => s.length > 1 && s.length < 120 && !/^(luzon|visayas|mindanao)$/i.test(s));
    levels.push({ signalNumber: Number(matches[i][1]), areas });
  }
  return levels;
}

/**
 * Parses bulletin text (from either HTML or an extracted PDF) into one
 * advisory per active TCWS signal level.
 *
 * Returns:
 *   - `[]` for a legitimately clean result (no active cyclone, or an active
 *     system with no wind signal hoisted yet) -- both are successful parses.
 *   - `null` when the text doesn't look like a recognizable bulletin at all
 *     -- the caller treats this as a failed/unparseable source.
 */
export function parseBulletinText(text) {
  if (!text) return null;
  const collapsed = text.replace(/\s+/g, " ").trim();

  if (/No Active Tropical Cyclone/i.test(collapsed)) return [];

  const numberMatch = /TROPICAL\s+CYCLONE\s+BULLETIN\s+(?:NR\.?|NO\.?|#)\s*(\d+)/i.exec(collapsed);
  const nameMatch = /(Tropical Depression|Tropical Storm|Severe Tropical Storm|Typhoon|Super Typhoon)\s+([A-Z][A-Za-zÀ-ſ]*)/.exec(collapsed);
  if (!numberMatch && !nameMatch) {
    console.warn("[pagasaParser] Bulletin text has no recognizable bulletin number or cyclone name -- skipping.");
    return null;
  }

  const issuedMatch = /Issued at\s+([\d:]+\s*[AP]M),?\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i.exec(collapsed);
  const bulletinNumber = numberMatch ? Number(numberMatch[1]) : null;
  const cycloneCategory = nameMatch ? nameMatch[1] : "";
  const cycloneName = nameMatch ? nameMatch[2].trim() : "";
  const headline = nameMatch
    ? `${cycloneCategory} ${cycloneName}`.trim()
    : `Tropical Cyclone Bulletin #${bulletinNumber ?? ""}`.trim();
  const issuedAtIso = issuedMatch ? toIso(issuedMatch[2], issuedMatch[1]) : "";

  const signals = extractSignalLevels(collapsed);
  if (signals.length === 0) return []; // active system, but no signal hoisted -- clean, nothing to surface yet

  return signals.map((level) => ({
    advisoryType: "tropicalCyclone",
    bulletinNumber,
    cycloneName,
    cycloneCategory,
    signalNumber: level.signalNumber,
    affectedAreas: level.areas,
    headline,
    issuedAtIso,
    validUntilIso: "",
  }));
}

const TCB_NUMBER_RE = /TCB(?:%23|#)(\d+)_/i;

/** Highest-numbered (= current) bulletin PDF among a set of TCB links. */
export function pickLatestBulletinPdf(pdfLinks = []) {
  let latest = null;
  for (const url of pdfLinks) {
    const match = TCB_NUMBER_RE.exec(url);
    if (!match) continue;
    const number = Number(match[1]);
    if (!latest || number > latest.number) latest = { number, url };
  }
  return latest?.url ?? pdfLinks[0] ?? null;
}

/**
 * Parses the official severe-weather-bulletin page. Scopes strictly to the
 * "Tropical Cyclone Bulletin" section, never the "Archive" section.
 *
 * Returns `{ status, advisories, pdfLinks }`:
 *   - status "none": no active cyclone -- advisories is [], a clean result.
 *   - status "content": the page carried the bulletin text inline --
 *     advisories is already parsed.
 *   - status "pdfOnly": the current section only linked bulletin PDF(s) --
 *     the caller should download+extract-text from `pickLatestBulletinPdf`
 *     and parse that with `parseBulletinText` (spec section 9's fallback).
 *   - status "unknown": section found but unrecognizable -- treat as a
 *     failed fetch/parse (keep last-known-good), not a clean empty result.
 */
export function parseTropicalCycloneBulletinHtml(html) {
  if (!html) return { status: "unknown", advisories: [], pdfLinks: [] };
  const $ = cheerio.load(html);

  let sectionText = "";
  let sectionHtml = "";
  $(".article-header").each((_, el) => {
    if ($(el).text().trim().toLowerCase() !== "tropical cyclone bulletin") return;
    const content = $(el).next(".article-content");
    if (content.length) {
      sectionHtml = content.html() || "";
      sectionText = blockText(sectionHtml);
    }
  });

  if (!sectionText) return { status: "unknown", advisories: [], pdfLinks: [] };
  if (/No Active Tropical Cyclone/i.test(sectionText)) return { status: "none", advisories: [], pdfLinks: [] };

  if (/Issued at/i.test(sectionText) && /TROPICAL\s+CYCLONE\s+BULLETIN/i.test(sectionText)) {
    const advisories = parseBulletinText(sectionText);
    if (advisories !== null) return { status: "content", advisories, pdfLinks: [] };
  }

  const $section = cheerio.load(`<div>${sectionHtml}</div>`);
  const pdfLinks = [];
  $section("a[href$='.pdf']").each((_, el) => {
    const href = $section(el).attr("href");
    if (href && isOfficialPagasaUrl(href)) pdfLinks.push(href);
  });

  if (pdfLinks.length > 0) return { status: "pdfOnly", advisories: [], pdfLinks };
  return { status: "unknown", advisories: [], pdfLinks: [] };
}

/** Parses the official Weather Advisory page. Returns null when none is currently issued (clean). */
export function parseWeatherAdvisoryHtml(html) {
  if (!html) return null;
  const $ = cheerio.load(html);
  const scoped = $(".weather-advisory, .weekly-content-adv").first();
  const text = blockText(scoped.length ? scoped.html() : $("body").html()).replace(/\n/g, " ").trim();

  if (!text || /no weather advisory (is )?issued/i.test(text)) return null;

  const numberMatch = /Weather Advisory\s+(?:No\.?|#)\s*(\d+)/i.exec(text);
  const issuedMatch = /Issued at\s+([\d:]+\s*[AP]M),?\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i.exec(text);

  return {
    advisoryType: "weatherAdvisory",
    bulletinNumber: numberMatch ? Number(numberMatch[1]) : null,
    headline: text.slice(0, 300),
    issuedAtIso: issuedMatch ? toIso(issuedMatch[2], issuedMatch[1]) : "",
    validUntilIso: "",
    affectedAreas: [],
  };
}

const REGIONAL_ADVISORY_TYPES = [
  ["heavyRainfallWarning", /Heavy Rainfall Warning/i],
  ["rainfallAdvisory", /Rainfall Advisory/i],
  // Live regional pages currently say "Thunderstorm Watch" rather than
  // "Thunderstorm Advisory" -- confirmed against a real #VISPRSD warning
  // while building this -- so both wordings map to the same advisory type.
  ["thunderstormAdvisory", /Thunderstorm (?:Advisory|Watch)/i],
];

/**
 * Best-effort scan of a PAGASA Regional Services Division page for rainfall
 * and thunderstorm warnings. These pages are widget-heavy rather than
 * semantic HTML, so this deliberately scans visible text for the known
 * headline phrases rather than depending on a specific DOM structure.
 */
export function parseRegionalWarningHtml(html, { regionSlug = "", regionLabel = "" } = {}) {
  if (!html) return [];
  const $ = cheerio.load(html);
  const text = blockText($("body").html());

  const advisories = [];
  for (const [advisoryType, re] of REGIONAL_ADVISORY_TYPES) {
    const match = re.exec(text);
    if (!match) continue;
    const snippet = text.slice(match.index, match.index + 400).replace(/\s+/g, " ").trim();
    advisories.push({
      advisoryType,
      headline: snippet.slice(0, 240),
      regionSlug,
      regionalLabel: regionLabel,
      issuedAtIso: "",
      validUntilIso: "",
      affectedAreas: [],
    });
  }
  return advisories;
}
