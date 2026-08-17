// @vitest-environment jsdom
// Verifies the SF1 print replica: official column geometry, the two-row merged
// header, the male/female/combined tally rows, and the CLAUDE.md §2 print-safety
// boundary (pure white background, no dark/brand theme leakage).

import { describe, it, expect, afterEach } from "vitest";
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import SF1PrintView from "../components/SF1PrintView.jsx";
import { SF1_COLUMNS, SF1_COLUMN_PERCENTS } from "../importers/sf1/sf1Layout.js";

afterEach(cleanup);

const SCHOOL = {
  schoolId: "312810",
  schoolName: "Tingub National High School",
  region: "Region VII",
  division: "Mandaue City",
  schoolYear: "2026-2027",
  gradeLevel: "Grade 7",
  section: "FAITH",
};

const LEARNERS = [
  {
    lrn: "120019190018",
    lastName: "ANTOLIJAO",
    firstName: "ROEL ADRIAN",
    middleName: "BERDIN",
    sex: "Male",
    birthDate: "2014-03-26",
    age: "12",
    motherTongue: "Cebuano",
    religion: "Christianity",
    barangay: "TINGUB",
    municipalityCity: "MANDAUE CITY",
    province: "CEBU",
    fathersName: "ANTOLIJAO, RODRIGO CENIZA",
    mothersMaidenName: "BERDIN,ELMA,ALIVADO,",
    learningModality: "Face to Face",
    remarks: "T/I DATE:2026-06-08",
  },
  {
    lrn: "120019190057",
    lastName: "CUBERO",
    firstName: "NOEL",
    middleName: "NARCISO",
    nameExtension: "JR.",
    sex: "M",
    birthDate: "2013-10-25",
    age: "12",
  },
  {
    lrn: "119885190012",
    lastName: "ACRUZ",
    firstName: "FIONA MAE",
    sex: "F",
    birthDate: "2014-07-31",
    age: "12",
  },
];

function renderSheet(props = {}) {
  const { container } = render(
    React.createElement(SF1PrintView, { learners: LEARNERS, school: SCHOOL, ...props })
  );
  return container;
}

describe("SF1 print view — layout fidelity", () => {
  it("emits one <col> per official column, in the official proportions", () => {
    const container = renderSheet();
    const cols = container.querySelectorAll(".sf1-table colgroup col");

    expect(cols).toHaveLength(SF1_COLUMNS.length);
    expect(cols).toHaveLength(19);

    // Widths must sum to the full sheet, so the table fills the page exactly.
    const total = SF1_COLUMN_PERCENTS.reduce((s, c) => s + c.percent, 0);
    expect(total).toBeCloseTo(100, 6);

    // The NAME column is the widest, exactly as on the official form.
    const widest = [...SF1_COLUMN_PERCENTS].sort((a, b) => b.percent - a.percent)[0];
    expect(widest.field).toBe("name");
  });

  it("builds the two-row header with the official merged groups", () => {
    const container = renderSheet();
    const headerRows = container.querySelectorAll(".sf1-table thead tr");
    expect(headerRows).toHaveLength(2);

    // Every header row must account for all 19 columns once rowSpan/colSpan
    // are counted, otherwise the printed grid would be skewed.
    const topCells = [...headerRows[0].querySelectorAll("th")];
    const topWidth = topCells.reduce((sum, th) => sum + (th.colSpan || 1), 0);
    expect(topWidth).toBe(19);

    const spanningDown = topCells.filter((th) => th.rowSpan === 2).length;
    const bottomCells = [...headerRows[1].querySelectorAll("th")];
    const bottomWidth = bottomCells.reduce((sum, th) => sum + (th.colSpan || 1), 0);
    expect(spanningDown + bottomWidth).toBe(19);

    // The grouped headers the form actually prints.
    expect(screen.getByText("ADDRESS")).toBeTruthy();
    expect(screen.getByText("PARENTS")).toBeTruthy();
    expect(screen.getByText("Barangay")).toBeTruthy();
    expect(screen.getByText("Relationship")).toBeTruthy();
  });

  it("gives every learner row the full 19 columns", () => {
    const container = renderSheet();
    const dataRows = [...container.querySelectorAll(".sf1-table tbody tr")].filter(
      (tr) => !tr.classList.contains("sf1-tally")
    );
    expect(dataRows).toHaveLength(3);
    dataRows.forEach((tr) => {
      const width = [...tr.querySelectorAll("td")].reduce(
        (sum, td) => sum + (td.colSpan || 1),
        0
      );
      expect(width).toBe(19);
    });
  });
});

describe("SF1 print view — register content", () => {
  it("prints the class metadata block", () => {
    renderSheet();
    expect(screen.getByText("School Form 1 (SF 1) School Register")).toBeTruthy();
    expect(screen.getByText("312810")).toBeTruthy();
    expect(screen.getByText("Tingub National High School")).toBeTruthy();
    expect(screen.getByText("Region VII")).toBeTruthy();
    expect(screen.getByText("2026-2027")).toBeTruthy();
    expect(screen.getByText("FAITH")).toBeTruthy();
  });

  it("groups males then females and prints each tally the way LIS does", () => {
    const container = renderSheet();
    const tallies = [...container.querySelectorAll(".sf1-tally")].map(
      (tr) => tr.textContent
    );
    expect(tallies[0]).toContain("2<=== TOTAL MALE");
    expect(tallies[1]).toContain("1<=== TOTAL FEMALE");
    expect(tallies[2]).toContain("3<=== COMBINED");

    // Male block precedes the female block.
    const names = [...container.querySelectorAll(".sf1-c-name")].map((td) => td.textContent);
    expect(names.slice(0, 2)).toEqual([
      "ANTOLIJAO, ROEL ADRIAN BERDIN",
      "CUBERO, NOEL JR. NARCISO",
    ]);
    expect(names[3]).toBe("ACRUZ, FIONA MAE");
  });

  it("accepts both 'M'/'F' and 'Male'/'Female' for sex", () => {
    const container = renderSheet();
    const rows = [...container.querySelectorAll(".sf1-table tbody tr")];
    // Third cell of each learner row is the Sex column.
    const sexes = rows
      .filter((tr) => !tr.classList.contains("sf1-tally"))
      .map((tr) => tr.querySelectorAll("td")[2].textContent);
    expect(sexes).toEqual(["M", "M", "F"]);
  });

  it("prints birth dates as mm/dd/yyyy, the format the form asks for", () => {
    const container = renderSheet();
    expect(container.textContent).toContain("03/26/2014");
    expect(container.textContent).toContain("07/31/2014");
  });

  it("still lists a learner whose sex could not be read", () => {
    const container = render(
      React.createElement(SF1PrintView, {
        learners: [{ lrn: "120019190099", lastName: "REYES", firstName: "SAM", sex: "" }],
        school: SCHOOL,
      })
    ).container;
    expect(container.textContent).toContain("REYES, SAM");
    expect(container.textContent).toContain("SEX NOT INDICATED");
    expect(container.textContent).toContain("1<=== COMBINED");
  });

  it("prints the indicator legend and the signature block", () => {
    renderSheet({ preparedBy: "KAREN MAE CABAHUG", certifiedBy: "ROSITA NACORDA" });
    expect(
      screen.getByText("List and Code of Indicators under REMARKS column")
    ).toBeTruthy();
    expect(screen.getByText("T/O")).toBeTruthy();
    expect(screen.getByText("SNED")).toBeTruthy();
    expect(screen.getByText("KAREN MAE CABAHUG")).toBeTruthy();
    expect(screen.getByText("(Signature of School Head over Printed Name)")).toBeTruthy();
  });

  it("renders an empty class without crashing", () => {
    const container = render(
      React.createElement(SF1PrintView, { learners: [], school: SCHOOL })
    ).container;
    expect(container.querySelectorAll(".sf1-tally")).toHaveLength(3);
    expect(container.textContent).toContain("0<=== COMBINED");
  });
});

describe("SF1 print view — print safety (CLAUDE.md §2)", () => {
  it("targets a legal landscape page with the official quarter-inch margin", () => {
    const container = renderSheet();
    const css = container.querySelector("style").textContent;
    expect(css).toMatch(/@page\s*\{[^}]*size:\s*legal landscape/);
    expect(css).toMatch(/@page\s*\{[^}]*margin:\s*0\.25in/);
  });

  it("forces a pure white background and black text when printing", () => {
    const css = renderSheet().querySelector("style").textContent;
    const printBlock = css.slice(css.indexOf("@media print"));
    expect(printBlock).toMatch(/background:\s*#fff\s*!important/);
    expect(printBlock).toMatch(/\.sf1-print-view \*\s*\{[^}]*color:\s*#000\s*!important/);
    expect(printBlock).toMatch(/print-color-adjust:\s*exact\s*!important/);
  });

  it("repeats the table header across a multi-page register", () => {
    const css = renderSheet().querySelector("style").textContent;
    expect(css).toMatch(/thead\s*\{\s*display:\s*table-header-group/);
    expect(css).toMatch(/page-break-inside:\s*avoid/);
  });

  it("never references a dark-mode or brand-theme colour", () => {
    const container = renderSheet();
    const css = container.querySelector("style").textContent;
    // No Tailwind dark: variants, CSS custom properties, or brand tokens can
    // reach the printed sheet.
    expect(css).not.toMatch(/\.dark\b|dark:|var\(--|currentColor/);
    expect(container.querySelector(".sf1-sheet").className).not.toMatch(/dark:/);
  });
});
