import { describe, it, expect } from "vitest";
import {
  ANNOUNCEMENT_TYPES,
  ANNOUNCEMENT_TYPE_IDS,
  getAnnouncementType,
  validateAnnouncement,
  isAnnouncementActive,
  sortAnnouncements,
  getRecentAnnouncements,
  toAnnouncementDocument,
} from "../announcements.js";

const validDraft = {
  title: "Faculty Meeting",
  body: "All teachers to report at 1 PM.",
  type: "general",
  effectiveDate: "2026-08-16",
};

describe("announcements", () => {
  describe("type catalog", () => {
    it("includes the DepEd issuance types the school must record", () => {
      expect(ANNOUNCEMENT_TYPE_IDS).toContain("depedOrder");
      expect(ANNOUNCEMENT_TYPE_IDS).toContain("depedMemorandum");
      expect(ANNOUNCEMENT_TYPE_IDS).toContain("ndrrmcAdvisory");
      expect(ANNOUNCEMENT_TYPE_IDS).toContain("classSuspension");
    });

    it("requires a reference number only for the two DepEd issuance types", () => {
      const requiring = ANNOUNCEMENT_TYPES.filter((t) => t.requiresReference).map((t) => t.id);
      expect(requiring.sort()).toEqual(["depedMemorandum", "depedOrder"]);
    });

    it("resolves a type by id and returns null for an unknown one", () => {
      expect(getAnnouncementType("depedOrder").label).toBe("DepEd Order");
      expect(getAnnouncementType("nonsense")).toBeNull();
    });
  });

  describe("validateAnnouncement", () => {
    it("accepts a complete general announcement", () => {
      expect(validateAnnouncement(validDraft)).toEqual({ valid: true, errors: {} });
    });

    it("requires title, body, type, and effective date", () => {
      const { valid, errors } = validateAnnouncement({});
      expect(valid).toBe(false);
      expect(errors).toHaveProperty("title");
      expect(errors).toHaveProperty("body");
      expect(errors).toHaveProperty("type");
      expect(errors).toHaveProperty("effectiveDate");
    });

    it("rejects whitespace-only text", () => {
      const { errors } = validateAnnouncement({ ...validDraft, title: "   " });
      expect(errors).toHaveProperty("title");
    });

    it("requires a reference number for a DepEd Order", () => {
      const { valid, errors } = validateAnnouncement({ ...validDraft, type: "depedOrder" });
      expect(valid).toBe(false);
      expect(errors.referenceNo).toContain("DO 015, s. 2026");
    });

    it("accepts a DepEd Memorandum once its reference number is given", () => {
      const result = validateAnnouncement({
        ...validDraft,
        type: "depedMemorandum",
        referenceNo: "DM 042, s. 2026",
      });
      expect(result.valid).toBe(true);
    });

    it("does not require a reference number for an NDRRMC advisory", () => {
      expect(validateAnnouncement({ ...validDraft, type: "ndrrmcAdvisory" }).valid).toBe(true);
    });

    it("rejects an expiry before the effective date but allows the same day", () => {
      expect(
        validateAnnouncement({ ...validDraft, expiresAt: "2026-08-15" }).errors
      ).toHaveProperty("expiresAt");
      expect(validateAnnouncement({ ...validDraft, expiresAt: "2026-08-16" }).valid).toBe(true);
    });

    it("rejects a reference link that is not http(s)", () => {
      expect(
        validateAnnouncement({ ...validDraft, referenceUrl: "deped.gov.ph/do15" }).errors
      ).toHaveProperty("referenceUrl");
      expect(
        validateAnnouncement({ ...validDraft, referenceUrl: "https://deped.gov.ph/do15" }).valid
      ).toBe(true);
    });
  });

  describe("isAnnouncementActive", () => {
    const post = { effectiveDate: "2026-08-16", expiresAt: "2026-08-20" };

    it("is inactive before its effective date", () => {
      expect(isAnnouncementActive(post, new Date(2026, 7, 15))).toBe(false);
    });

    it("is active on the effective date and on the expiry date", () => {
      expect(isAnnouncementActive(post, new Date(2026, 7, 16))).toBe(true);
      expect(isAnnouncementActive(post, new Date(2026, 7, 20))).toBe(true);
    });

    it("is inactive the day after expiry", () => {
      expect(isAnnouncementActive(post, new Date(2026, 7, 21))).toBe(false);
    });

    it("never expires when no expiry is set", () => {
      expect(
        isAnnouncementActive({ effectiveDate: "2026-01-01" }, new Date(2027, 11, 31))
      ).toBe(true);
    });

    it("returns false for a missing announcement", () => {
      expect(isAnnouncementActive(null)).toBe(false);
    });
  });

  describe("sortAnnouncements", () => {
    it("puts urgent posts first, then most recent effective date", () => {
      const sorted = sortAnnouncements([
        { id: "a", priority: "normal", effectiveDate: "2026-08-16" },
        { id: "b", priority: "urgent", effectiveDate: "2026-08-01" },
        { id: "c", priority: "normal", effectiveDate: "2026-08-20" },
      ]);
      expect(sorted.map((x) => x.id)).toEqual(["b", "c", "a"]);
    });

    it("breaks a tie on creation time and does not mutate the input", () => {
      const input = [
        { id: "a", effectiveDate: "2026-08-16", createdAt: { seconds: 100 } },
        { id: "b", effectiveDate: "2026-08-16", createdAt: { seconds: 200 } },
      ];
      expect(sortAnnouncements(input).map((x) => x.id)).toEqual(["b", "a"]);
      expect(input[0].id).toBe("a");
    });
  });

  describe("getRecentAnnouncements", () => {
    it("keeps active posts inside the window and drops older ones", () => {
      const list = [
        { id: "recent", effectiveDate: "2026-08-10" },
        { id: "old", effectiveDate: "2026-07-01" },
        { id: "future", effectiveDate: "2026-09-01" },
      ];
      const result = getRecentAnnouncements(list, new Date(2026, 7, 16), 14);
      expect(result.map((x) => x.id)).toEqual(["recent"]);
    });

    it("drops expired posts even inside the window", () => {
      const list = [{ id: "gone", effectiveDate: "2026-08-10", expiresAt: "2026-08-12" }];
      expect(getRecentAnnouncements(list, new Date(2026, 7, 16), 14)).toEqual([]);
    });
  });

  describe("toAnnouncementDocument", () => {
    it("trims fields and records the author", () => {
      const doc = toAnnouncementDocument(
        { ...validDraft, title: "  Meeting  ", referenceNo: " DO 15 " },
        { uid: "u1", displayName: "Ma'am Cruz" }
      );
      expect(doc.title).toBe("Meeting");
      expect(doc.referenceNo).toBe("DO 15");
      expect(doc.postedByUid).toBe("u1");
      expect(doc.postedByName).toBe("Ma'am Cruz");
    });

    it("normalises priority and a blank expiry to null", () => {
      const doc = toAnnouncementDocument({ ...validDraft, priority: "bogus" }, {});
      expect(doc.priority).toBe("normal");
      expect(doc.expiresAt).toBeNull();
    });

    it("falls back to the author's email when there is no display name", () => {
      const doc = toAnnouncementDocument(validDraft, { uid: "u2", email: "ict@tnhs.edu.ph" });
      expect(doc.postedByName).toBe("ict@tnhs.edu.ph");
    });
  });
});
