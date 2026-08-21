// functions/pagasa-sync/index.js
// Cloud Run service (NOT a Firebase Function) -- triggered by Cloud
// Scheduler every 30 minutes over authenticated HTTP. Needs a JRE for
// @pagasa-parser/source-pdf's tabula-java dependency, which the
// standard Firebase Functions buildpack can't provide.
//
// @pagasa-parser/source-pdf's real exported API (confirmed by unpacking
// the published tarball -- there is no hosted API docs page):
//   import PagasaParserPDFSource from "@pagasa-parser/source-pdf";
//   const source = new PagasaParserPDFSource("/local/path/to/bulletin.pdf");
//   const bulletin = await source.parse();
//   // bulletin: { active, info: { title, count, url, final, issued, expires, summary },
//   //             cyclone: { name, category, internationalName, center, movement },
//   //             signals: { 1: {areas:{...}}|null, 2: ..., 3: ..., 4: ..., 5: null } }
//
// The constructor takes a LOCAL file path, not a URL -- source-pdf has
// no built-in fetch step. PAGASA's severe-weather-bulletin page is an
// HTML listing of per-cyclone bulletin PDFs named "TCB#<n>_<name>.pdf"
// hosted on pubfiles.pagasa.dost.gov.ph; there is no dedicated
// "latest bulletin" URL. So this service: fetches the listing HTML,
// finds the highest-numbered TCB PDF link (= the current bulletin),
// downloads it to a temp file, then hands that path to
// PagasaParserPDFSource.

import { createServer } from "node:http";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import PagasaParserPDFSource from "@pagasa-parser/source-pdf";

initializeApp();

const PAGASA_BULLETIN_LIST_URL = "https://www.pagasa.dost.gov.ph/tropical-cyclone/severe-weather-bulletin";
// PDF links look like:
// https://pubfiles.pagasa.dost.gov.ph/tamss/weather/bulletin/TCB%231_neneng.pdf
const TCB_PDF_LINK_RE = /https:\/\/pubfiles\.pagasa\.dost\.gov\.ph\/tamss\/weather\/bulletin\/TCB%23(\d+)_[^"'\s)]+\.pdf/gi;

function toDateKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function collectAreaNames(tcwsLevel) {
  if (!tcwsLevel?.areas) return [];
  const names = [];
  for (const areas of Object.values(tcwsLevel.areas)) {
    for (const area of areas ?? []) {
      if (area?.name) names.push(area.name);
    }
  }
  return names;
}

async function findLatestBulletinPdfUrl() {
  const res = await fetch(PAGASA_BULLETIN_LIST_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch PAGASA bulletin list: HTTP ${res.status}`);
  }
  const html = await res.text();
  let latest = null;
  for (const match of html.matchAll(TCB_PDF_LINK_RE)) {
    const number = Number(match[1]);
    if (!latest || number > latest.number) {
      latest = { number, url: match[0] };
    }
  }
  return latest?.url ?? null;
}

async function downloadPdf(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download bulletin PDF: HTTP ${res.status}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  const tempPath = join(tmpdir(), `pagasa-bulletin-${Date.now()}.pdf`);
  await writeFile(tempPath, buffer);
  return tempPath;
}

/**
 * Parses the current bulletin PDF and expands it into one advisory
 * document per active TCWS signal level (each level has its own
 * affected-areas list).
 */
async function fetchAdvisories() {
  const pdfUrl = await findLatestBulletinPdfUrl();
  if (!pdfUrl) return [];

  const tempPath = await downloadPdf(pdfUrl);
  try {
    const source = new PagasaParserPDFSource(tempPath);
    const bulletin = await source.parse();

    const issuedAt = toDateKey(bulletin.info?.issued);
    const validUntil = toDateKey(bulletin.info?.expires) || issuedAt;
    const cycloneName = bulletin.cyclone?.name ?? "";
    const headline = bulletin.info?.title || bulletin.info?.summary || "";

    const advisories = [];
    for (const [signalKey, level] of Object.entries(bulletin.signals ?? {})) {
      if (!level) continue;
      advisories.push({
        signalNumber: Number(signalKey),
        cycloneName,
        affectedAreas: collectAreaNames(level),
        issuedAt,
        validUntil,
        headline,
        sourceUrl: pdfUrl,
      });
    }
    return advisories;
  } finally {
    await unlink(tempPath).catch(() => {});
  }
}

async function syncBulletins() {
  const db = getFirestore();
  const collection = db.collection("weatherAdvisories");

  let advisories = [];
  try {
    advisories = await fetchAdvisories();
  } catch (error) {
    console.error("Failed to fetch/parse PAGASA bulletin:", error);
    return { synced: 0, error: String(error) };
  }

  const existing = await collection.get();
  const batch = db.batch();
  for (const doc of existing.docs) batch.delete(doc.ref);

  for (const advisory of advisories) {
    const ref = collection.doc();
    batch.set(ref, {
      signalNumber: advisory.signalNumber ?? null,
      cycloneName: advisory.cycloneName ?? "",
      affectedAreas: advisory.affectedAreas ?? [],
      issuedAt: advisory.issuedAt ?? "",
      validUntil: advisory.validUntil ?? "",
      headline: advisory.headline ?? "",
      sourceUrl: advisory.sourceUrl ?? PAGASA_BULLETIN_LIST_URL,
      updatedAt: new Date().toISOString(),
    });
  }

  await batch.commit();
  return { synced: advisories.length };
}

const port = process.env.PORT || 8080;

createServer(async (req, res) => {
  if (req.method !== "POST") {
    res.writeHead(405).end("Method Not Allowed");
    return;
  }
  try {
    const result = await syncBulletins();
    res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(result));
  } catch (error) {
    console.error("syncBulletins failed:", error);
    res.writeHead(500).end("Internal Server Error");
  }
}).listen(port, () => console.log(`pagasa-sync listening on ${port}`));
