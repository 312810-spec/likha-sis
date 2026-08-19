// src/__tests__/anecdotalRecords.test.js
import { describe, it, expect } from "vitest";
import {
  ANECDOTAL_INCIDENT_TYPES,
  ANECDOTAL_STATUS_OPTIONS,
} from "../AnecdotalRecords.jsx";
import { canAccessPage } from "../pageAccess.js";

describe("Anecdotal Records Constants & Access Controls", () => {
  it("exports standard DepEd incident and entry types", () => {
    expect(ANECDOTAL_INCIDENT_TYPES).toContain("Behavioral / Conduct");
    expect(ANECDOTAL_INCIDENT_TYPES).toContain("Academic Observation");
    expect(ANECDOTAL_INCIDENT_TYPES).toContain("Guidance & Counseling");
    expect(ANECDOTAL_INCIDENT_TYPES).toContain("Attendance & Punctuality");
    expect(ANECDOTAL_INCIDENT_TYPES).toContain("Peer / Social Interaction");
    expect(ANECDOTAL_INCIDENT_TYPES).toContain("Health & Well-being");
    expect(ANECDOTAL_INCIDENT_TYPES).toContain("Commendation / Positive Note");
    expect(ANECDOTAL_INCIDENT_TYPES).toContain("Other");
  });

  it("exports all required anecdotal status workflow options", () => {
    expect(ANECDOTAL_STATUS_OPTIONS).toContain("Open / Under Observation");
    expect(ANECDOTAL_STATUS_OPTIONS).toContain("In Progress / Counseling");
    expect(ANECDOTAL_STATUS_OPTIONS).toContain("Resolved");
    expect(ANECDOTAL_STATUS_OPTIONS).toContain("Referred to Guidance");
  });

  it("restricts access to authorized roles only (adviser, guidance, principal, masterTeacher)", () => {
    expect(canAccessPage("anecdotalRecords", ["adviser"])).toBe(true);
    expect(canAccessPage("anecdotalRecords", ["guidance"])).toBe(true);
    expect(canAccessPage("anecdotalRecords", ["principal"])).toBe(true);
    expect(canAccessPage("anecdotalRecords", ["masterTeacher"])).toBe(true);

    // Blocked roles
    expect(canAccessPage("anecdotalRecords", ["subjectTeacher"])).toBe(false);
    expect(canAccessPage("anecdotalRecords", ["stakeholder"])).toBe(false);
    expect(canAccessPage("anecdotalRecords", ["ictCoordinator"])).toBe(false);
    expect(canAccessPage("anecdotalRecords", [])).toBe(false);
    expect(canAccessPage("anecdotalRecords", null)).toBe(false);
  });
});
