import { describe, it, expect } from "vitest";
import {
  isOfficialPagasaUrl,
  parseBulletinText,
  parseTropicalCycloneBulletinHtml,
  pickLatestBulletinPdf,
  parseWeatherAdvisoryHtml,
  parseRegionalWarningHtml,
} from "../pagasaParser.mjs";

describe("isOfficialPagasaUrl", () => {
  it("accepts official PAGASA/DOST-hosted domains", () => {
    expect(isOfficialPagasaUrl("https://www.pagasa.dost.gov.ph/weather/weather-advisory")).toBe(true);
    expect(isOfficialPagasaUrl("https://pubfiles.pagasa.dost.gov.ph/tamss/weather/bulletin/TCB%231_x.pdf")).toBe(true);
    expect(isOfficialPagasaUrl("https://bagong.pagasa.dost.gov.ph/")).toBe(true);
  });

  it("rejects third-party sources", () => {
    expect(isOfficialPagasaUrl("https://weather.com/philippines")).toBe(false);
    expect(isOfficialPagasaUrl("http://pagasa.dost.gov.ph/insecure")).toBe(false);
  });
});

// Real PAGASA bulletin text (pdftotext -layout output, trimmed) from
// TROPICAL CYCLONE BULLETIN NR. 1 for Tropical Depression Neneng, fetched
// from pubfiles.pagasa.dost.gov.ph while building this parser.
const REAL_BULLETIN_NO_SIGNAL_TEXT = `
TROPICAL CYCLONE BULLETIN NR. 1
Tropical Depression NENENG
Issued at 5:00 PM, 18 August 2026
Valid for broadcast until the next bulletin at 11:00 PM today.

THE LOW PRESSURE AREA EAST OF EXTREME NORTHERN LUZON DEVELOPED INTO TROPICAL DEPRESSION NENENG.

TROPICAL CYCLONE WIND SIGNALS (TCWS) IN EFFECT
No Wind Signal is currently hoisted

Prepared by: PCDM
`;

describe("parseBulletinText", () => {
  it("parses a real PAGASA bulletin with no wind signal hoisted as a clean empty result", () => {
    expect(parseBulletinText(REAL_BULLETIN_NO_SIGNAL_TEXT)).toEqual([]);
  });

  it("returns [] for a clean no-active-cyclone response", () => {
    expect(parseBulletinText("No Active Tropical Cyclone within the Philippine Area of Responsibility")).toEqual([]);
  });

  it("returns null for text with no recognizable bulletin structure", () => {
    expect(parseBulletinText("Welcome to the PAGASA website.")).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(parseBulletinText("")).toBeNull();
  });

  it("parses bulletin number, cyclone name/category, and one advisory per active TCWS signal", () => {
    const text = `
      TROPICAL CYCLONE BULLETIN NR. 12
      Typhoon AGATON
      Issued at 5:00 PM, 20 August 2026
      Valid for broadcast until the next bulletin at 11:00 PM today.
      TROPICAL CYCLONE WIND SIGNALS (TCWS) IN EFFECT
      Wind Signal No. 2
      Luzon: Cagayan, Isabela, Batanes
      Wind Signal No. 1
      Luzon: Ilocos Norte, Ilocos Sur
      Prepared by: PCDM
    `;
    const advisories = parseBulletinText(text);
    expect(advisories).toHaveLength(2);

    const signal2 = advisories.find((a) => a.signalNumber === 2);
    expect(signal2.bulletinNumber).toBe(12);
    expect(signal2.cycloneName).toBe("AGATON");
    expect(signal2.cycloneCategory).toBe("Typhoon");
    expect(signal2.affectedAreas).toEqual(expect.arrayContaining(["Cagayan", "Isabela", "Batanes"]));
    expect(signal2.issuedAtIso).toBe("2026-08-20T17:00:00+08:00");

    const signal1 = advisories.find((a) => a.signalNumber === 1);
    expect(signal1.affectedAreas).toEqual(expect.arrayContaining(["Ilocos Norte", "Ilocos Sur"]));
  });
});

// HTML skeleton verified against the live severe-weather-bulletin page
// (August 2026): a "Tropical Cyclone Bulletin" article-header/article-content
// pair holding current status, and a separate "Archive" pair holding past
// cyclones as PDF-link lists only.
function bulletinPage(currentSectionHtml) {
  return `
    <div class="row tropical-cyclone-weather-bulletin-page">
      <div class="col-md-12 fixed-sidebar col-lg-10 col-lg-offset-1">
        <div class="article-header"><span style="padding-left:15px;">Tropical Cyclone Bulletin</span></div>
        <div class="article-content">${currentSectionHtml}</div>
      </div>
      <div class="col-md-12 fixed-sidebar col-lg-10 col-lg-offset-1">
        <div class="article-header"><span style="padding-left:15px;">Archive</span></div>
        <div class="article-content">
          <ul><li><a href="https://pubfiles.pagasa.dost.gov.ph/tamss/weather/bulletin/TCB%239_neneng.pdf">TCB#9_neneng.pdf</a></li></ul>
        </div>
      </div>
    </div>
  `;
}

describe("parseTropicalCycloneBulletinHtml", () => {
  it("returns status 'none' for the real no-active-cyclone page, ignoring the Archive section", () => {
    const html = bulletinPage(`
      <div class="panel panel-danger"><div class="panel-body text-center">
        <h3>No Active Tropical Cyclone within the Philippine Area of Responsibility</h3>
      </div></div>
    `);
    const result = parseTropicalCycloneBulletinHtml(html);
    expect(result.status).toBe("none");
    expect(result.advisories).toEqual([]);
  });

  it("never treats the Archive section's old bulletin as the current one", () => {
    // Current section is empty/unrecognized; only the Archive has PDF links.
    const html = bulletinPage("<p>&nbsp;</p>");
    const result = parseTropicalCycloneBulletinHtml(html);
    expect(result.pdfLinks).not.toContain("https://pubfiles.pagasa.dost.gov.ph/tamss/weather/bulletin/TCB%239_neneng.pdf");
  });

  it("parses inline bulletin content when the current section carries it", () => {
    const html = bulletinPage(`
      <p>TROPICAL CYCLONE BULLETIN NR. 12</p>
      <p>Typhoon AGATON</p>
      <p>Issued at 5:00 PM, 20 August 2026</p>
      <p>TROPICAL CYCLONE WIND SIGNALS (TCWS) IN EFFECT</p>
      <p>Wind Signal No. 1</p>
      <p>Metro Manila</p>
      <p>Prepared by: PCDM</p>
    `);
    const result = parseTropicalCycloneBulletinHtml(html);
    expect(result.status).toBe("content");
    expect(result.advisories).toHaveLength(1);
    expect(result.advisories[0].cycloneName).toBe("AGATON");
  });

  it("falls back to the current section's PDF link(s) when no inline text is present", () => {
    const html = bulletinPage(`
      <ul>
        <li><a href="https://pubfiles.pagasa.dost.gov.ph/tamss/weather/bulletin/TCB%231_agaton.pdf">TCB#1_agaton.pdf</a></li>
        <li><a href="https://pubfiles.pagasa.dost.gov.ph/tamss/weather/bulletin/TCB%232_agaton.pdf">TCB#2_agaton.pdf</a></li>
      </ul>
    `);
    const result = parseTropicalCycloneBulletinHtml(html);
    expect(result.status).toBe("pdfOnly");
    expect(pickLatestBulletinPdf(result.pdfLinks)).toBe(
      "https://pubfiles.pagasa.dost.gov.ph/tamss/weather/bulletin/TCB%232_agaton.pdf"
    );
  });
});

describe("parseWeatherAdvisoryHtml", () => {
  it("returns null for the real 'no Weather Advisory issued' page", () => {
    const html = `
      <div class="article-content weather-advisory">
        <div class="col-md-12 weekly-advisory-content">
          <div class="weekly-content-adv"><p>As of today, there is no Weather Advisory issued.</p></div>
        </div>
      </div>
    `;
    expect(parseWeatherAdvisoryHtml(html)).toBeNull();
  });

  it("parses an active weather advisory's number and issued timestamp", () => {
    const html = `
      <div class="article-content weather-advisory">
        <div class="weekly-content-adv">
          <p>Weather Advisory No. 68</p>
          <p>Issued at 5:00 PM, 20 August 2026</p>
          <p>Cloudy skies with scattered rainshowers due to the Southwest Monsoon.</p>
        </div>
      </div>
    `;
    const advisory = parseWeatherAdvisoryHtml(html);
    expect(advisory.advisoryType).toBe("weatherAdvisory");
    expect(advisory.bulletinNumber).toBe(68);
    expect(advisory.issuedAtIso).toBe("2026-08-20T17:00:00+08:00");
  });
});

describe("parseRegionalWarningHtml", () => {
  it("parses heavy rainfall warning, rainfall advisory, and thunderstorm advisory blocks", () => {
    const html = `
      <body>
        <p>Heavy Rainfall Warning: Moderate to heavy rains over Cebu and Bohol.</p>
        <p>Rainfall Advisory: Light to moderate rains expected over Negros Island.</p>
        <p>Thunderstorm Advisory: Cloud buildup observed over Panay Island.</p>
      </body>
    `;
    const advisories = parseRegionalWarningHtml(html, { regionSlug: "visprsd", regionLabel: "Visayas" });
    const types = advisories.map((a) => a.advisoryType);
    expect(types).toEqual(expect.arrayContaining(["heavyRainfallWarning", "rainfallAdvisory", "thunderstormAdvisory"]));
    expect(advisories.every((a) => a.regionSlug === "visprsd")).toBe(true);
  });

  it("returns an empty array when no warning keywords are present", () => {
    expect(parseRegionalWarningHtml("<body><p>Fair weather expected.</p></body>", { regionSlug: "visprsd" })).toEqual([]);
  });
});
