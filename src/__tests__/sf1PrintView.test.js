// @vitest-environment jsdom
// src/__tests__/sf1PrintView.test.js
// Structural parity tests for the printable DepEd SF1 School Register replica
// (components/SF1PrintView.jsx). These assert the exact two-row header merge
// scheme, male/female breakdown + tally rows, legend/tally/signature footer and
// the LIS-style bottom stamp required for 100% match with the official form.

import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import SF1PrintView from "../components/SF1PrintView.jsx";

afterEach(cleanup);

const LEARNERS = [
  { lrn: "136789012303", lastName: "Santos", firstName: "Ana", middleName: "Cruz", sex: "F", birthDate: "2010-05-20" },
  { lrn: "136789012304", lastName: "Garcia", firstName: "Bea", middleName: "Uy", sex: "F", birthDate: "07/11/2010" },
  { lrn: "136789012301", lastName: "Dela Cruz", firstName: "Juan", middleName: "Santos", sex: "M", birthDate: "2010-01-15" },
  { lrn: "136789012302", lastName: "Reyes", firstName: "Mark", middleName: "Lim", sex: "Male", birthDate: "2010-03-02" },
];

const SCHOOL = {
  schoolId: "304212",
  schoolName: "Tingub National High School",
  region: "VII",
  division: "Cebu Province",
  schoolYear: "2026-2027",
  gradeLevel: "Grade 10",
  section: "Compassion",
};

function renderSheet(props = {}) {
  return render(
    React.createElement(SF1PrintView, {
      learners: LEARNERS,
      school: SCHOOL,
      preparedBy: "MARIA S. TAN",
      certifiedBy: "JOSE R. LIM",
      bosyDate: "06/16/2026",
      eosyDate: "03/30/2027",
      ...props,
    })
  );
}

describe("SF1PrintView — metadata header block", () => {
  it("renders the main title and italic subtitle", () => {
    const { getByText } = renderSheet();
    expect(
      getByText("School Form 1 (SF 1) School Register")
    ).toBeTruthy();
    expect(
      getByText("(This replaces Form 1, Master List & STS Form 2-Family Background and Profile)")
    ).toBeTruthy();
  });

  it("renders every metadata label with its own value cell", () => {
    const { getByText, container } = renderSheet();
    for (const label of [
      "School ID",
      "Region",
      "Division",
      "School Name",
      "School Year",
      "Grade Level",
      "Section",
    ]) {
      expect(getByText(label)).toBeTruthy();
    }
    // Every label sits in its own cell (no combined Grade Level + Section cell).
    const metaLabels = container.querySelectorAll(".sf1-meta-label");
    expect(metaLabels.length).toBe(7);
  });

  it("renders the current metadata values", () => {
    const { container } = renderSheet();
    const text = container.textContent;
    expect(text).toContain("304212");
    expect(text).toContain("Tingub National High School");
    expect(text).toContain("Cebu Province");
    expect(text).toContain("2026-2027");
    expect(text).toContain("Grade 10");
    expect(text).toContain("Compassion");
  });

  it("renders the DO 017 SHS track and elective cluster when provided", () => {
    const { container, getByText } = renderSheet({
      school: {
        ...SCHOOL,
        gradeLevel: "Grade 11",
        track: "Tech-Voc (Tech-Pro)",
        cluster: "ICT",
      },
    });
    expect(getByText("Senior High School Parameters")).toBeTruthy();
    expect(container.textContent).toContain("Track: Tech-Voc (Tech-Pro)");
    expect(container.textContent).toContain("Elective Cluster: ICT");
    // The official 7-label header stays intact even with SHS parameters on.
    expect(container.querySelectorAll(".sf1-meta-label").length).toBe(7);
  });

  it("omits the SHS parameter bar when no track/cluster is selected", () => {
    const { container } = renderSheet();
    expect(container.querySelector(".sf1-shs")).toBeNull();
  });
});

describe("SF1PrintView — two-row table header", () => {
  it("renders all top-level merged headers (row 1)", () => {
    const { container } = renderSheet();
    const text = container.textContent;
    for (const header of [
      "LRN",
      "NAME",
      "Sex (M/F)",
      "BIRTH DATE",
      "AGE as of 1st Friday June",
      "MOTHER TONGUE",
      "IP",
      "RELIGION",
      "ADDRESS",
      "PARENTS",
      "GUARDIAN",
      "Contact Number of Parent or Guardian",
      "Learning Modality",
      "REMARKS",
    ]) {
      expect(text).toContain(header);
    }
  });

  it("uses rowSpan=2 for the single-column headers and 47-col based colSpans for groups", () => {
    const { container } = renderSheet();
    const ths = container.querySelectorAll(".sf1-table thead th");
    const withRowSpan = [...ths].filter((th) => th.getAttribute("rowspan") === "2");
    // LRN, NAME, Sex, Birth Date, Age, Mother Tongue, IP, Religion,
    // Contact Number, Learning Modality (+ spacer) = 11 headers.
    expect(withRowSpan.length).toBeGreaterThanOrEqual(10);

    const addressGroup = [...ths].find((th) => th.textContent === "ADDRESS");
    const parentsGroup = [...ths].find((th) => th.textContent === "PARENTS");
    const guardianGroup = [...ths].find((th) => th.textContent.startsWith("GUARDIAN"));
    expect(addressGroup.getAttribute("colspan")).toBe("12");
    expect(parentsGroup.getAttribute("colspan")).toBe("9");
    expect(guardianGroup.getAttribute("colspan")).toBe("5");
  });

  it("renders the grouped sub-headers (row 2)", () => {
    const { container } = renderSheet();
    const text = container.textContent;
    for (const header of [
      "House #",
      "Barangay",
      "Municipality/ City",
      "Province",
      "Father",
      "Mother",
      "Relationship",
    ]) {
      expect(text).toContain(header);
    }
  });
});

describe("SF1PrintView — data sectioning and tally rows", () => {
  it("lists all males first, then all females, each alphabetical by name", () => {
    const { container } = renderSheet();
    const rows = container.querySelectorAll("tr.sf1-row");
    const nameCells = [...rows]
      .filter((r) => !r.classList.contains("sf1-tally"))
      .map((r) => r.querySelector("td.sf1-c-name").textContent.trim());
    // Males (Dela Cruz, Reyes) then females (Garcia, Santos)
    expect(nameCells).toEqual([
      "Dela Cruz, Juan Santos",
      "Reyes, Mark Lim",
      "Garcia, Bea Uy",
      "Santos, Ana Cruz",
    ]);
  });

  it("places TOTAL MALE, TOTAL FEMALE and COMBINED tally rows", () => {
    const { container } = renderSheet();
    const text = container.textContent;
    expect(text).toContain("<=== TOTAL MALE");
    expect(text).toContain("<=== TOTAL FEMALE");
    expect(text).toContain("<=== COMBINED");
    const tallyRows = container.querySelectorAll("tr.sf1-tally");
    expect(tallyRows.length).toBe(3);
  });

  it("renders an empty class without crashing and still tallies zero", () => {
    const { container } = render(
      React.createElement(SF1PrintView, { learners: [], school: SCHOOL })
    );
    const text = container.textContent;
    expect(text).toContain("<=== TOTAL MALE");
    expect(text).toContain("<=== TOTAL FEMALE");
    expect(text).toContain("<=== COMBINED");
    expect(container.querySelectorAll("tr.sf1-tally").length).toBe(3);
  });
});

describe("SF1PrintView — footer: legend, tally and signatures", () => {
  it("renders the legend title and both indicator sets", () => {
    const { container } = renderSheet();
    const text = container.textContent;
    expect(text).toContain("List and Code of Indicators under REMARKS column");
    for (const code of ["T/O", "T/I", "DRP", "LE", "CCT", "B/A", "SNED", "ACL"]) {
      expect(text).toContain(code);
    }
  });

  it("renders the registered tally grid with current counts", () => {
    const { container } = renderSheet();
    const text = container.textContent;
    // males=2, females=2, total=4
    expect(text).toContain("BoSY");
    expect(text).toContain("EoSY");
    const registeredCells = [...container.querySelectorAll(".sf1-registered-table td")];
    const cellText = registeredCells.map((td) => td.textContent.trim());
    expect(cellText).toEqual(["REGISTERED", "BoSY", "EoSY", "MALE", "2", "", "FEMALE", "2", "", "TOTAL", "4", ""]);
  });

  it("renders signatures and BoSY/EoSY dates", () => {
    const { container, getByText } = renderSheet();
    expect(getByText("Prepared by:")).toBeTruthy();
    expect(getByText("Certified Correct:")).toBeTruthy();
    expect(container.textContent).toContain("Signature of Adviser over Printed Name");
    expect(container.textContent).toContain("Signature of School Head over Printed Name");
    expect(container.textContent).toContain("BoSY Date: 06/16/2026");
    expect(container.textContent).toContain("EoSY Date: 03/30/2027");
  });

  it("renders the LIS bottom stamp (Generated thru LIS / Generated on)", () => {
    const { container } = renderSheet();
    const text = container.textContent;
    expect(text).toContain("Generated thru LIS");
    expect(text).toMatch(/Generated on:/);
    expect(container.querySelector(".sf1-footer-meta")).toBeTruthy();
  });
});

describe("SF1PrintView — print CSS optimizations", () => {
  it("declares a legal-landscape 6mm print page", () => {
    const { container } = renderSheet();
    const style = container.querySelector("style").textContent;
    expect(style).toMatch(/@page\s*\{/);
    expect(style).toMatch(/size:\s*legal\s+landscape/);
    expect(style).toMatch(/margin:\s*6mm/);
  });

  it("keeps table borders crisp and black and forces exact colour", () => {
    const { container } = renderSheet();
    const style = container.querySelector("style").textContent;
    expect(style).toMatch(/border-collapse:\s*collapse/);
    expect(style).toMatch(/1px solid #000/);
    expect(style).toMatch(/print-color-adjust:\s*exact/);
  });
});

