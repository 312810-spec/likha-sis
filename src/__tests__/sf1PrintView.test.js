// @vitest-environment jsdom
// Verifies the SF1 print replica: official column geometry, the two-row merged
// header, the male/female/combined tally rows, and the CLAUDE.md §2 print-safety
// boundary (pure white background, no dark/brand theme leakage).
//
// PRIVACY: every learner below is INVENTED. Never copy names, LRNs, birth dates
// or parents out of a real DepEd export into this repository.

import { describe, it, expect, afterEach } from "vitest";
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import SF1PrintView from "../components/SF1PrintView.jsx";
import {
  SF1_COLUMNS,
  SF1_COLUMN_PERCENTS,
  SF1_GRID_PERCENTS,
} from "../importers/sf1/sf1Layout.js";

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
    lrn: "900000000018",
    lastName: "SANTIAGO",
    firstName: "MARIA ELENA",
    middleName: "RIVERA",
    sex: "Male",
    birthDate: "2013-05-14",
    age: "13",
    motherTongue: "Cebuano",
    religion: "Christianity",
    barangay: "TINGUB",
    municipalityCity: "MANDAUE CITY",
    province: "CEBU",
    fathersName: "SANTIAGO, RODRIGO CRUZ",
    mothersMaidenName: "RIVERA,TERESA,MENDOZA,",
    learningModality: "Face to Face",
    remarks: "T/I DATE:2026-06-08",
  },
  {
    lrn: "900000000057",
    lastName: "DELGADO",
    firstName: "RAMON",
    middleName: "SALAZAR",
    nameExtension: "JR.",
    sex: "M",
    birthDate: "2012-11-02",
    age: "13",
  },
  {
    lrn: "900000000012",
    lastName: "GARCIA",
    firstName: "ROSA LINDA",
    sex: "F",
    birthDate: "2013-08-19",
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
      "DELGADO, RAMON JR. SALAZAR",
      "SANTIAGO, MARIA ELENA RIVERA",
    ]);
    expect(names[3]).toBe("GARCIA, ROSA LINDA");
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
    expect(container.textContent).toContain("05/14/2013");
    expect(container.textContent).toContain("08/19/2013");
  });

  it("still lists a learner whose sex could not be read", () => {
    const container = render(
      React.createElement(SF1PrintView, {
        learners: [{ lrn: "900000000099", lastName: "REYES", firstName: "SAM", sex: "" }],
        school: SCHOOL,
      })
    ).container;
    expect(container.textContent).toContain("REYES, SAM");
    expect(container.textContent).toContain("SEX NOT INDICATED");
    expect(container.textContent).toContain("1<=== COMBINED");
  });

  it("prints the indicator legend and the signature block", () => {
    renderSheet({ preparedBy: "JUANA CRUZ SANTOS", certifiedBy: "LOURDES REYES MENDOZA" });
    expect(
      screen.getByText("List and Code of Indicators under REMARKS column")
    ).toBeTruthy();
    expect(screen.getByText("T/O")).toBeTruthy();
    expect(screen.getByText("SNED")).toBeTruthy();
    expect(screen.getByText("JUANA CRUZ SANTOS")).toBeTruthy();
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

  it("keeps the print block free of dark-mode or brand-theme colours", () => {
    // The register now supports screen Dark Mode (html.dark … rules earlier
    // in this same stylesheet — see the next describe block), so the
    // guarantee this test enforces is scoped to what actually reaches the
    // printer: the @media print block itself, which must stay hard-coded
    // black-on-white with no CSS custom properties or brand tokens.
    const container = renderSheet();
    const css = container.querySelector("style").textContent;
    const printBlock = css.slice(css.indexOf("@media print"));
    expect(printBlock).not.toMatch(/var\(--|currentColor/);
    expect(container.querySelector(".sf1-sheet").className).not.toMatch(/dark:/);
  });
});

describe("SF1 print view — screen Dark Mode (CLAUDE.md §4E/§20-21)", () => {
  it("styles the register for screen Dark Mode via html.dark, outside the print block", () => {
    const container = renderSheet();
    const css = container.querySelector("style").textContent;
    const printStart = css.indexOf("@media print");
    const screenBlock = css.slice(0, printStart);
    const printBlock = css.slice(printStart);

    // Dark Mode colours exist for on-screen presentation…
    expect(screenBlock).toMatch(/html\.dark \.sf1-sheet/);
    expect(screenBlock).toMatch(/html\.dark \.sf1-table (th|td)/);
    // …but never inside the @media print block that actually reaches paper.
    expect(printBlock).not.toMatch(/html\.dark/);
  });

  it("forces white/black back on regardless of Dark Mode, via !important", () => {
    // The print block's `!important` rules always win over the non-!important
    // html.dark screen rules, even though `.dark` stays on <html> while
    // printing — this is the mechanism, not just the intent, that keeps
    // print safe.
    const container = renderSheet();
    const css = container.querySelector("style").textContent;
    const printBlock = css.slice(css.indexOf("@media print"));
    expect(printBlock).toMatch(/\.sf1-print-view \*\s*\{[^}]*background:\s*#fff\s*!important/);
    expect(printBlock).toMatch(/\.sf1-print-view \*\s*\{[^}]*color:\s*#000\s*!important/);
  });
});

// The title band (LIS rows 1-6) and the footer band (LIS rows 30-41) are laid
// out on the sheet's raw 47-column grid rather than the register's merged 19,
// because their merges do not line up with the register's column boundaries.
// Column 46 (source col AU) is a 2px sliver that only the Section-value cell
// on the School Name/Year/Grade/Section row actually reaches -- every other
// row's real merges stop at column 45, matching the source workbook exactly.
describe("SF1 print view - title and footer bands match the LIS grid", () => {
  it("exposes a 47-column grid totalling the register's own width", () => {
    expect(SF1_GRID_PERCENTS).toHaveLength(47);
    const total = SF1_GRID_PERCENTS.reduce((sum, p) => sum + p, 0);
    expect(total).toBeGreaterThan(99.5);
    expect(total).toBeLessThan(100.5);
  });

  it("lays the title band on that grid, with only the Section-value row reaching all 47 columns", () => {
    const head = renderSheet().querySelector(".sf1-head");
    expect(head).toBeTruthy();
    expect(head.querySelectorAll("col")).toHaveLength(47);
    const rows = [...head.querySelectorAll("tr")];
    const widths = rows.map((row) =>
      [...row.children].reduce(
        (sum, cell) => sum + (Number(cell.getAttribute("colspan")) || 1),
        0
      )
    );
    // Every row reaches 46 (the source's real merges); the metadata row
    // carrying Section reaches the full 47 because its value cell alone
    // merges into column 46.
    for (const width of widths) {
      expect(width === 46 || width === 47).toBe(true);
    }
    expect(widths).toContain(47);
  });

  it("lays the footer band on the same grid", () => {
    const foot = renderSheet().querySelector(".sf1-foot");
    expect(foot).toBeTruthy();
    expect(foot.querySelectorAll("col")).toHaveLength(47);
  });

  it("prints the region bare, with no invented Region caption", () => {
    renderSheet();
    expect(screen.getByText("Region VII")).toBeTruthy();
    expect(screen.queryByText("Region")).toBeNull();
  });

  it("carries the REMARKS legend note in the second header row", () => {
    renderSheet();
    expect(
      screen.getByText("(Please refer to the legend on last page)")
    ).toBeTruthy();
  });

  it("reproduces the export's footer labels, semicolon quirk included", () => {
    renderSheet();
    // LIS really does print "Prepared by;" with a semicolon, not a colon.
    expect(screen.getByText("Prepared by;")).toBeTruthy();
    expect(screen.getByText("Certified Correct:")).toBeTruthy();
    expect(screen.getByText("Generated thru LIS")).toBeTruthy();
  });

  it("keeps the signature block's real asymmetry -- Prepared by is 7 columns, Certified Correct is 6", () => {
    // Verified against the source workbook's own merges: "Prepared by"
    // (adviser) spans c30-36, "Certified Correct" (school head) spans only
    // c39-44. They are NOT mirror-image widths, despite how symmetric the
    // printed form looks -- don't "fix" this back to 7/7.
    renderSheet({ preparedBy: "ADVISER NAME", certifiedBy: "SCHOOL HEAD NAME" });
    const preparedByLabel = screen.getByText("Prepared by;");
    const certifiedByLabel = screen.getByText("Certified Correct:");
    expect(preparedByLabel.getAttribute("colspan")).toBe("7");
    expect(certifiedByLabel.getAttribute("colspan")).toBe("6");

    const preparedByName = screen.getByText("ADVISER NAME");
    const certifiedByName = screen.getByText("SCHOOL HEAD NAME");
    expect(preparedByName.getAttribute("colspan")).toBe("7");
    expect(certifiedByName.getAttribute("colspan")).toBe("6");
  });

  it("prints the LIS generated-on line when a date is supplied", () => {
    renderSheet({ generatedOn: "Saturday, August 15, 2026" });
    expect(
      screen.getByText("Generated on: Saturday, August 15, 2026")
    ).toBeTruthy();
  });
});

// Every value below is verified against the real workbook's own per-cell XF
// (font/alignment) records, extracted with xlrd. Bold specifically needed a
// SECOND pass: xlrd's Font.bold is a legacy BIFF bit that this Apache-POI-
// generated workbook leaves at its default (0) even on genuinely bold fonts
// -- the field Excel actually renders from is Font.weight (400 normal, 700
// bold). Trusting .bold alone said "nothing is bold anywhere," which was
// wrong; re-deriving bold as weight >= 700 found 5 of the workbook's 15
// fonts really are bold -- the title, every table/footer header label, the
// legend body, REGISTERED labels/values, signature captions, and the BoSY/
// EoSY date labels. The signature *names* (preparedBy/certifiedBy) and the
// tally rows are confirmed NOT bold either way. Don't "fix" bold back to
// what looks more form-like without re-deriving it from weight, not .bold.
describe("SF1 print view - font weight/size/alignment match the real workbook", () => {
  function cssText(container) {
    return container.querySelector("style").textContent;
  }

  it("renders the title at 21pt bold, centered -- not 11pt left", () => {
    const css = cssText(renderSheet());
    expect(css).toMatch(/\.sf1-title\s*\{[^}]*font-size:\s*21pt/);
    expect(css).toMatch(/\.sf1-title\s*\{[^}]*font-weight:\s*bold/);
    expect(css).toMatch(/\.sf1-title\s*\{[^}]*text-align:\s*center/);
  });

  it("bolds the learner table's column headers", () => {
    const css = cssText(renderSheet());
    expect(css).toMatch(/\.sf1-table th\s*\{[^}]*font-weight:\s*bold/);
  });

  it("bolds the footer's legend title, legend body, REGISTERED cells, and signature captions/dates, but not the signature names", () => {
    const css = cssText(renderSheet());
    const ruleFor = (selector) => css.match(new RegExp(`${selector}\\s*\\{[^}]*\\}`))?.[0] || "";
    expect(ruleFor("\\.sf1-legend-title")).toMatch(/font-weight:\s*bold/);
    expect(ruleFor("\\.sf1-legend-cell")).toMatch(/font-weight:\s*bold/);
    expect(ruleFor("\\.sf1-reg-label")).toMatch(/font-weight:\s*bold/);
    expect(ruleFor("\\.sf1-reg-value")).toMatch(/font-weight:\s*bold/);
    expect(ruleFor("\\.sf1-sign-caption")).toMatch(/font-weight:\s*bold/);
    expect(ruleFor("\\.sf1-sign-dates")).toMatch(/font-weight:\s*bold/);
    expect(ruleFor("\\.sf1-sign-name")).toMatch(/font-weight:\s*normal/);
  });

  it("does not italicize the signature captions", () => {
    const css = cssText(renderSheet());
    const rule = css.match(/\.sf1-sign-caption\s*\{[^}]*\}/)?.[0] || "";
    expect(rule).not.toMatch(/font-style:\s*italic/);
  });

  it("left-aligns LRN and the address/parentage columns, right-aligns birth date", () => {
    const container = renderSheet();
    const firstRow = container.querySelector(".sf1-table tbody tr.sf1-row:not(.sf1-tally)");
    const cells = [...firstRow.children];
    expect(cells[0].className).toContain("sf1-c-lrn"); // LRN -- left via .sf1-c-lrn
    expect(cells[3].className).toContain("sf1-c-right"); // birth date
    expect(cells[5].className).toContain("sf1-c-left"); // mother tongue
  });

  it("right-aligns the tally row's count despite sharing the LRN column class", () => {
    const container = renderSheet();
    const css = cssText(container);
    expect(css).toMatch(/\.sf1-tally \.sf1-c-lrn\s*\{[^}]*text-align:\s*right/);
  });
});
