import { describe, it, expect } from "vitest";
import { computeSMEAEnrollment, parseGradeNumber } from "../utils/smeaEnrollment.js";

describe("smeaEnrollment utils", () => {
  const mockCalendar = {
    "2026-2027": {
      schoolYearLabel: "2026-2027",
      terms: [
        { id: "term-1", label: "Term 1", startDate: "2026-06-08", endDate: "2026-09-15" },
        { id: "term-2", label: "Term 2", startDate: "2026-09-16", endDate: "2026-12-18" },
        { id: "term-3", label: "Term 3", startDate: "2027-01-04", endDate: "2027-04-08" },
      ],
    },
  };

  const sampleLearners = [
    {
      id: "l1",
      lrn: "123456789012",
      lastName: "Dela Cruz",
      firstName: "Juan",
      sex: "M",
      gradeLevel: "Grade 7",
      section: "Diamond",
      schoolYear: "2026-2027",
      enrollmentStatus: "active",
    },
    {
      id: "l2",
      lrn: "123456789013",
      lastName: "Santos",
      firstName: "Maria",
      sex: "F",
      gradeLevel: "Grade 7",
      section: "Diamond",
      schoolYear: "2026-2027",
      enrollmentStatus: "active",
    },
    {
      id: "l3",
      lrn: "123456789014",
      lastName: "Reyes",
      firstName: "Pedro",
      sex: "Male",
      gradeLevel: "Grade 7",
      section: "Emerald",
      schoolYear: "2026-2027",
      enrollmentStatus: "active",
    },
    {
      id: "l4",
      lrn: "123456789015",
      lastName: "Garcia",
      firstName: "Ana",
      sex: "Female",
      gradeLevel: "Grade 8",
      section: "Ruby",
      schoolYear: "2026-2027",
      enrollmentStatus: "active",
    },
    {
      id: "l5_transferred",
      lrn: "123456789016",
      lastName: "Aquino",
      firstName: "Ben",
      sex: "M",
      gradeLevel: "Grade 8",
      section: "Ruby",
      schoolYear: "2026-2027",
      enrollmentStatus: "transferred-out",
    },
    {
      id: "l6_other_sy",
      lrn: "123456789017",
      lastName: "Cruz",
      firstName: "Jose",
      sex: "M",
      gradeLevel: "Grade 7",
      section: "Diamond",
      schoolYear: "2025-2026",
      enrollmentStatus: "active",
    },
  ];

  it("parses numeric grade correctly", () => {
    expect(parseGradeNumber("Grade 7")).toBe(7);
    expect(parseGradeNumber("10")).toBe(10);
    expect(parseGradeNumber("Kindergarten")).toBe(0);
  });

  it("filters learners by selected school year and excludes transferred-out learners from active count", () => {
    const report = computeSMEAEnrollment(sampleLearners, "2026-2027", mockCalendar, new Date("2026-07-15"));

    expect(report.inSYCount).toBe(5); // 5 in SY 2026-2027
    expect(report.validCount).toBe(4); // 4 active valid learners
    expect(report.totalLearners).toBe(4);
    expect(report.totalMale).toBe(2); // Juan & Pedro
    expect(report.totalFemale).toBe(2); // Maria & Ana
  });

  it("structures grade rows and section subtotals properly", () => {
    const report = computeSMEAEnrollment(sampleLearners, "2026-2027", mockCalendar, new Date("2026-07-15"));

    expect(report.gradeRows.length).toBe(2); // Grade 7 and Grade 8

    const g7 = report.gradeRows.find((r) => r.grade === "7");
    expect(g7).toBeDefined();
    expect(g7.male).toBe(2);
    expect(g7.female).toBe(1);
    expect(g7.total).toBe(3);
    expect(g7.sections.length).toBe(2); // Diamond, Emerald

    const g8 = report.gradeRows.find((r) => r.grade === "8");
    expect(g8).toBeDefined();
    expect(g8.male).toBe(0);
    expect(g8.female).toBe(1);
    expect(g8.total).toBe(1);
  });

  it("reports 3-term academic calendar synchronization and active term", () => {
    const report = computeSMEAEnrollment(sampleLearners, "2026-2027", mockCalendar, new Date("2026-07-15"));

    expect(report.activeTerm).toBeDefined();
    expect(report.activeTerm.id).toBe("term-1");
    expect(report.termBreakdown.length).toBe(3);
    expect(report.termBreakdown[0].isCurrent).toBe(true);
    expect(report.termBreakdown[1].isCurrent).toBe(false);
  });

  it("detects and reports SF1 discrepancies (duplicate LRNs, missing sections, invalid LRN format)", () => {
    const badLearners = [
      {
        id: "b1",
        lrn: "123456789012", // duplicate
        lastName: "Alpha",
        firstName: "One",
        sex: "M",
        gradeLevel: "Grade 7",
        section: "Diamond",
        schoolYear: "2026-2027",
      },
      {
        id: "b2",
        lrn: "123456789012", // duplicate
        lastName: "Beta",
        firstName: "Two",
        sex: "F",
        gradeLevel: "Grade 7",
        section: "", // missing section
        schoolYear: "2026-2027",
      },
      {
        id: "b3",
        lrn: "123", // invalid format
        lastName: "Gamma",
        firstName: "Three",
        sex: "", // missing sex
        gradeLevel: "Grade 8",
        section: "Ruby",
        schoolYear: "2026-2027",
      },
      {
        id: "b4",
        lrn: "", // missing LRN
        lastName: "Delta",
        firstName: "Four",
        sex: "M",
        gradeLevel: "Invalid", // invalid grade
        section: "Gold",
        schoolYear: "2026-2027",
      },
    ];

    const report = computeSMEAEnrollment(badLearners, "2026-2027", mockCalendar);

    const discTypes = report.discrepancies.map((d) => d.type);
    expect(discTypes).toContain("duplicate_lrn");
    expect(discTypes).toContain("missing_section");
    expect(discTypes).toContain("missing_sex");
    expect(discTypes).toContain("invalid_lrn_format");
    expect(discTypes).toContain("missing_lrn");
    expect(discTypes).toContain("invalid_grade");
  });
});
