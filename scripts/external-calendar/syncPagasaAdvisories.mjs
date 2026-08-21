#!/usr/bin/env node
// scripts/external-calendar/syncPagasaAdvisories.mjs
// Entry point run by .github/workflows/sync-official-calendar.yml (every 2
// hours). Fetches the official PAGASA Tropical Cyclone Bulletin, Weather
// Advisory, and (for the school's PRSD region) rainfall/thunderstorm
// warning pages, and upserts weatherAdvisories. A source that fails to
// fetch or parse leaves its previously-synced advisories untouched instead
// of being interpreted as "no advisory" (spec section 13).

import { getFirestoreDb, upsertPagasaAdvisories } from "./lib/firestoreWriter.mjs";
import { matchSchoolPrsd } from "./lib/schoolLocation.mjs";
import {
  parseTropicalCycloneBulletinHtml,
  parseBulletinText,
  pickLatestBulletinPdf,
  parseWeatherAdvisoryHtml,
  parseRegionalWarningHtml,
  isOfficialPagasaUrl,
} from "./pagasaParser.mjs";

const BULLETIN_URL = "https://www.pagasa.dost.gov.ph/tropical-cyclone/severe-weather-bulletin";
const WEATHER_ADVISORY_URL = "https://www.pagasa.dost.gov.ph/weather/weather-advisory";

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.text();
}

async function fetchPdfText(url) {
  if (!isOfficialPagasaUrl(url)) return "";
  const res = await fetch(url);
  if (!res.ok) return "";
  const buffer = Buffer.from(await res.arrayBuffer());
  const { default: pdfParse } = await import("pdf-parse");
  const parsed = await pdfParse(buffer);
  return parsed.text || "";
}

/** Tropical Cyclone Bulletin: HTML first, PDF only as a fallback (spec section 9). */
async function syncTropicalCyclone() {
  try {
    const html = await fetchText(BULLETIN_URL);
    const result = parseTropicalCycloneBulletinHtml(html);

    if (result.status === "none" || result.status === "content") {
      return { ok: true, advisories: result.advisories.map((a) => ({ ...a, sourceUrl: BULLETIN_URL })) };
    }

    if (result.status === "pdfOnly") {
      const pdfUrl = pickLatestBulletinPdf(result.pdfLinks);
      if (!pdfUrl) return { ok: true, advisories: [] };
      const pdfText = await fetchPdfText(pdfUrl);
      const advisories = parseBulletinText(pdfText);
      if (advisories === null) {
        console.warn("[syncPagasaAdvisories] Bulletin PDF fallback did not parse -- keeping last-known-good cyclone data.");
        return { ok: false };
      }
      return { ok: true, advisories: advisories.map((a) => ({ ...a, sourceUrl: pdfUrl })) };
    }

    console.warn("[syncPagasaAdvisories] Tropical Cyclone Bulletin section had unrecognized structure -- keeping last-known-good cyclone data.");
    return { ok: false };
  } catch (error) {
    console.error(`[syncPagasaAdvisories] Tropical Cyclone Bulletin fetch/parse failed: ${error.message}`);
    return { ok: false };
  }
}

async function syncWeatherAdvisory() {
  try {
    const html = await fetchText(WEATHER_ADVISORY_URL);
    const advisory = parseWeatherAdvisoryHtml(html);
    return { ok: true, advisories: advisory ? [{ ...advisory, sourceUrl: WEATHER_ADVISORY_URL }] : [] };
  } catch (error) {
    console.error(`[syncPagasaAdvisories] Weather Advisory fetch/parse failed: ${error.message}`);
    return { ok: false };
  }
}

async function syncRegionalWarnings(locationMatch) {
  if (!locationMatch.matched) return { ok: true, advisories: [] };
  const url = `https://www.pagasa.dost.gov.ph/regional-forecast/${locationMatch.prsdSlug}`;
  try {
    const html = await fetchText(url);
    const advisories = parseRegionalWarningHtml(html, {
      regionSlug: locationMatch.prsdSlug,
      regionLabel: locationMatch.regionalLabel,
    }).map((a) => ({ ...a, sourceUrl: url, isLocalMatch: true }));
    return { ok: true, advisories };
  } catch (error) {
    console.error(`[syncPagasaAdvisories] Regional (${locationMatch.prsdSlug}) fetch/parse failed: ${error.message}`);
    return { ok: false };
  }
}

async function getSchoolLocation(db) {
  try {
    const doc = await db.collection("settings").doc("schoolConfig").get();
    const data = doc.exists ? doc.data() : {};
    return matchSchoolPrsd({ region: data?.region, municipalityCityProvince: data?.municipalityCityProvince });
  } catch (error) {
    console.warn(`[syncPagasaAdvisories] Could not read school location, skipping regional warnings: ${error.message}`);
    return { matched: false, prsdSlug: null, regionalLabel: "" };
  }
}

async function main() {
  const db = getFirestoreDb();
  const locationMatch = await getSchoolLocation(db);
  if (locationMatch.matched) console.log(`[syncPagasaAdvisories] School region matched to PRSD: ${locationMatch.prsdSlug} (${locationMatch.regionalLabel})`);

  const [cyclone, weatherAdvisory, regional] = await Promise.all([
    syncTropicalCyclone(),
    syncWeatherAdvisory(),
    syncRegionalWarnings(locationMatch),
  ]);

  const advisories = [];
  const authoritativeTypes = new Set();

  if (cyclone.ok) {
    advisories.push(...cyclone.advisories);
    authoritativeTypes.add("tropicalCyclone");
  }
  if (weatherAdvisory.ok) {
    advisories.push(...weatherAdvisory.advisories);
    authoritativeTypes.add("weatherAdvisory");
  }
  if (regional.ok) {
    advisories.push(...regional.advisories);
    authoritativeTypes.add("heavyRainfallWarning");
    authoritativeTypes.add("rainfallAdvisory");
    authoritativeTypes.add("thunderstormAdvisory");
  }

  if (authoritativeTypes.size === 0) {
    console.warn("[syncPagasaAdvisories] Every source failed -- keeping last-known-good advisories untouched.");
    return;
  }

  const { synced, removed } = await upsertPagasaAdvisories({ db, advisories, authoritativeTypes });
  console.log(`[syncPagasaAdvisories] Synced ${synced} advisory doc(s); removed ${removed} stale/expired doc(s).`);
}

main().catch((error) => {
  console.error("[syncPagasaAdvisories] Unexpected failure:", error);
  process.exitCode = 1;
});
