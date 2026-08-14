import { describe, it, expect } from "vitest";
import { computeSF4Rows, isDropoutRemark } from "../sf4Computations";

// Convenience builder for a learner object with a normalized sex field.
function learner(sex, enrollmentStatus = "active") {
  return { sex, enrollmentStatus };
}

describe("isDropoutRemark", () => {
  it("returns true when the string starts with 'Dropped Out'", () => {
    expect(isDropoutRemark("Dropped Out")).toBe(true);
    expect(isDropoutRemark("Dropped Out - b3: Death")).toBe(true);
    expect(isDropoutRemark("  Dropped Out - a4: Family problems")).toBe(true);
    expect(isDropoutRemark("DROPPED OUT")).toBe(false); // startsWith is case-sensitive
  });

  it("returns false for non-dropout remarks and non-strings", () => {
    expect(isDropoutRemark("Transferred In")).toBe(false);
    expect(isDropoutRemark("Transferred Out")).toBe(false);
    expect(isDropoutRemark("Present")).toBe(false);
    expect(isDropoutRemark("")).toBe(false);
    expect(isDropoutRemark(null)).toBe(false);
    expect(isDropoutRemark(undefined)).toBe(false);
    expect(isDropoutRemark(123)).toBe(false);
  });
});

describe("computeSF4Rows", () => {
  it("keeps beginning equal to ending for a section with no movement", () => {
    const rows = computeSF4Rows({
      sections: ["Rizal"],
      learnersBySection: {
        Rizal: [learner("Male"), learner("Male"), learner("Female"), learner("Female")],
      },
      transfersInMonth: [],
      dropoutsInMonth: [],
    });

    const sectionRow = rows[0];
    expect(sectionRow.section).toBe("Rizal");
    expect(sectionRow.endOfMonthMale).toBe(2);
    expect(sectionRow.endOfMonthFemale).toBe(2);
    expect(sectionRow.endOfMonthTotal).toBe(4);
    expect(sectionRow.transferredIn).toBe(0);
    expect(sectionRow.transferredOut).toBe(0);
    expect(sectionRow.droppedOut).toBe(0);
    expect(sectionRow.beginningOfMonthTotal).toBe(4);
  });

  it("accounts for transfers in and out", () => {
    const rows = computeSF4Rows({
      sections: ["Rizal"],
      learnersBySection: {
        Rizal: [learner("Male"), learner("Male"), learner("Female")],
      },
      transfersInMonth: [
        { section: "Rizal", transferType: "in" },
        { section: "Rizal", transferType: "in" },
        { section: "Rizal", transferType: "out" },
      ],
      dropoutsInMonth: [],
    });

    const sectionRow = rows[0];
    expect(sectionRow.endOfMonthTotal).toBe(3);
    expect(sectionRow.transferredIn).toBe(2);
    expect(sectionRow.transferredOut).toBe(1);
    // beginning = 3 - 2 + 1 + 0
    expect(sectionRow.beginningOfMonthTotal).toBe(2);
  });

  it("accounts for a dropout and ignores non-active learners", () => {
    const rows = computeSF4Rows({
      sections: ["Rizal"],
      learnersBySection: {
        Rizal: [
          learner("Male"),
          learner("Male"),
          learner("Female"),
          learner("Female"),
          learner("Male", "transferred-out"), // not active -> excluded
        ],
      },
      transfersInMonth: [],
      dropoutsInMonth: [{ section: "Rizal" }],
    });

    const sectionRow = rows[0];
    expect(sectionRow.endOfMonthTotal).toBe(4);
    expect(sectionRow.droppedOut).toBe(1);
    // beginning = 4 - 0 + 0 + 1
    expect(sectionRow.beginningOfMonthTotal).toBe(5);
  });

  it("sums all sections into a totals row", () => {
    const rows = computeSF4Rows({
      sections: ["Rizal", "Bonifacio"],
      learnersBySection: {
        Rizal: [learner("Male"), learner("Male"), learner("Female"), learner("Female")],
        Bonifacio: [learner("Male"), learner("Female")],
      },
      transfersInMonth: [
        { section: "Rizal", transferType: "in" },
        { section: "Bonifacio", transferType: "out" },
      ],
      dropoutsInMonth: [{ section: "Bonifacio" }],
    });

    expect(rows).toHaveLength(3);

    const [rizal, bonifacio, totals] = rows;

    expect(rizal.endOfMonthTotal).toBe(4);
    expect(rizal.beginningOfMonthTotal).toBe(3); // 4 - 1

    expect(bonifacio.endOfMonthTotal).toBe(2);
    expect(bonifacio.transferredOut).toBe(1);
    expect(bonifacio.droppedOut).toBe(1);
    expect(bonifacio.beginningOfMonthTotal).toBe(4); // 2 + 1 + 1

    expect(totals.section).toBe("TOTAL");
    expect(totals.endOfMonthMale).toBe(3); // 2 + 1
    expect(totals.endOfMonthFemale).toBe(3); // 2 + 1
    expect(totals.endOfMonthTotal).toBe(6); // 4 + 2
    expect(totals.transferredIn).toBe(1);
    expect(totals.transferredOut).toBe(1);
    expect(totals.droppedOut).toBe(1);
    expect(totals.beginningOfMonthTotal).toBe(7); // 3 + 4
  });
});
