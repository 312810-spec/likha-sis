import { describe, it, expect } from "vitest";
import {
  isOfficialDepedUrl,
  extractIssuanceMeta,
  discoverDepedCalendarSource,
} from "../depedSourceDiscovery.mjs";

describe("isOfficialDepedUrl", () => {
  it("accepts an official deped.gov.ph URL", () => {
    expect(isOfficialDepedUrl("https://www.deped.gov.ph/2026/04/16/some-order/")).toBe(true);
    expect(isOfficialDepedUrl("https://deped.gov.ph/wp-content/uploads/DO_s2026_009r.pdf")).toBe(true);
  });

  it("rejects third-party mirrors and non-https URLs", () => {
    expect(isOfficialDepedUrl("https://www.scribd.com/doc/12345/school-calendar")).toBe(false);
    expect(isOfficialDepedUrl("https://teachersclick.ph/school-calendar-2026-2027")).toBe(false);
    expect(isOfficialDepedUrl("http://www.deped.gov.ph/insecure/")).toBe(false);
    expect(isOfficialDepedUrl("")).toBe(false);
    expect(isOfficialDepedUrl(undefined)).toBe(false);
  });
});

describe("extractIssuanceMeta", () => {
  it("parses a DepEd Order title", () => {
    expect(
      extractIssuanceMeta("April 16, 2026 DO 009, s. 2026 – Guidelines on the Implementation of the Three-Term School Calendar")
    ).toEqual({ sourceType: "DepEd Order", sourceNumber: "009", sourceYear: "2026" });
  });

  it("parses a DepEd Memorandum title", () => {
    expect(extractIssuanceMeta("February 19, 2026 DM 009, s. 2026 – 2026 National Arts Month Celebration")).toEqual({
      sourceType: "DepEd Memorandum",
      sourceNumber: "009",
      sourceYear: "2026",
    });
  });

  it("returns null when no issuance pattern is present", () => {
    expect(extractIssuanceMeta("Angara, pinabilis ang hiring ng school counselor associates")).toBeNull();
  });
});

const OFFICIAL_CANDIDATE_2026 =
  '<h2 class="entry-title"><a href="https://www.deped.gov.ph/2026/04/16/april-16-2026-do-009-s-2026-guidelines-on-the-implementation-of-the-three-term-school-calendar-in-basic-education/">April 16, 2026 DO 009, s. 2026 – Guidelines on the Implementation of the Three-Term School Calendar in Basic Education</a></h2>';

const OFFICIAL_CANDIDATE_2025 =
  '<h2 class="entry-title"><a href="https://www.deped.gov.ph/2025/03/10/march-10-2025-do-010-s-2025-school-calendar-and-activities-for-school-year-2025-2026/">March 10, 2025 DO 010, s. 2025 – School Calendar and Activities for School Year 2025-2026</a></h2>';

const THIRD_PARTY_CANDIDATE =
  '<h2 class="entry-title"><a href="https://www.scribd.com/doc/12345/school-calendar-2026-2027-leaked">School Calendar 2026-2027 (full copy)</a></h2>';

function makeFetchImpl(searchHtml) {
  return async (url) => {
    if (url.includes("wp-json")) return { ok: false, status: 401, json: async () => ({}) };
    if (url.includes("?s=")) return { ok: true, text: async () => searchHtml };
    return { ok: false, status: 404, text: async () => "" };
  };
}

describe("discoverDepedCalendarSource", () => {
  it("never returns a third-party result even when one appears in search results", async () => {
    const fetchImpl = makeFetchImpl(`${THIRD_PARTY_CANDIDATE}${OFFICIAL_CANDIDATE_2026}`);
    const source = await discoverDepedCalendarSource({ schoolYear: "2026-2027", fetchImpl });
    expect(source).not.toBeNull();
    expect(isOfficialDepedUrl(source.sourceUrl)).toBe(true);
    expect(source.sourceUrl).not.toContain("scribd.com");
  });

  it("picks the issuance matching the active school year over a different year's issuance", async () => {
    const fetchImpl = makeFetchImpl(`${OFFICIAL_CANDIDATE_2025}${OFFICIAL_CANDIDATE_2026}`);
    const source = await discoverDepedCalendarSource({ schoolYear: "2026-2027", fetchImpl });
    expect(source.sourceNumber).toBe("009");
    expect(source.sourceYear).toBe("2026");
  });

  it("falls back to the known SY 2026-2027 issuance when live discovery finds nothing", async () => {
    const fetchImpl = async () => ({ ok: false, status: 500, text: async () => "", json: async () => ({}) });
    const source = await discoverDepedCalendarSource({ schoolYear: "2026-2027", fetchImpl });
    expect(source).not.toBeNull();
    expect(isOfficialDepedUrl(source.sourceUrl)).toBe(true);
    expect(isOfficialDepedUrl(source.sourcePdfUrl)).toBe(true);
  });

  it("returns null for a school year with no fallback and no live discovery results", async () => {
    const fetchImpl = async () => ({ ok: false, status: 500, text: async () => "", json: async () => ({}) });
    const source = await discoverDepedCalendarSource({ schoolYear: "2031-2032", fetchImpl });
    expect(source).toBeNull();
  });
});
