// src/importers/realSamples.test.js
// End-to-end parsing tests against the REAL DepEd sample workbooks:
//
//   public/SF1_2026_Grade 7 (Year I) - FAITH.xls   (LIS export, 20 learners)
//   public/BELANGDAL, NICOLE_SF10.xlsx             (2 scholastic blocks)
//
// Everything else in the importer test suite uses synthetic fixtures; these two
// files are the ground truth those fixtures only approximate, so the assertions
// here are exact field values rather than shapes.
//
// The workbooks are deliberately NOT committed: they hold real learner personal
// information (full names, LRNs, birth dates, parents' names and addresses of
// minors), and anything under public/ is copied verbatim into the build output
// and served publicly. They stay as local working-copy files, so these tests
// skip when the files are absent rather than failing a clean checkout.

import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { processSF1Buffer } from "./sf1/importSF1.js";
import { processSF10Buffer, analyzeSF10Files } from "./sf10/importSF10.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(HERE, "..", "..", "public");
const SF1_FILE = path.join(PUBLIC_DIR, "SF1_2026_Grade 7 (Year I) - FAITH.xls");
const SF10_FILE = path.join(PUBLIC_DIR, "BELANGDAL, NICOLE_SF10.xlsx");

function readAsArrayBuffer(file) {
  const buf = fs.readFileSync(file);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

const hasSF1 = fs.existsSync(SF1_FILE);
const hasSF10 = fs.existsSync(SF10_FILE);

describe.skipIf(!hasSF1)("real DepEd SF1 sample (Grade 7 - FAITH)", () => {
  let result;
  let byLrn;

  beforeAll(async () => {
    result = await processSF1Buffer(readAsArrayBuffer(SF1_FILE), {
      filename: path.basename(SF1_FILE),
      fileIndex: 0,
    });
    byLrn = {};
    result.records.forEach((r) => {
      byLrn[r.learner.lrn] = r.learner;
    });
  });

  it("parses every learner and drops nothing", () => {
    expect(result.learnerCount).toBe(20);
    expect(result.droppedCount).toBe(0);
    expect(result.stats).toEqual({ total: 20, male: 11, female: 9 });
  });

  it("reads the full school context, including the values sitting several merged cells away", () => {
    expect(result.school).toEqual({
      schoolId: "312810",
      schoolName: "Tingub National High School",
      division: "Mandaue City",
      district: "",
      schoolYear: "2026-2027",
      // The LIS export truncates this cell to "Grade 7 (Year"; it is rebuilt in
      // the canonical "Grade N" form the learners collection is filtered by.
      gradeLevel: "Grade 7",
      section: "FAITH",
    });
  });

  it("splits a packed 'LAST,FIRST, MIDDLE' name on its commas, not on whitespace", () => {
    // "ANTOLIJAO,ROEL ADRIAN, BERDIN" -> the first name is TWO words.
    const l = byLrn["120019190018"];
    expect(l.lastName).toBe("ANTOLIJAO");
    expect(l.firstName).toBe("ROEL ADRIAN");
    expect(l.middleName).toBe("BERDIN");
    expect(l.nameExtension).toBe("");
  });

  it("treats a '-' placeholder middle name as empty", () => {
    // "CAL,JOHN PAUL, -"
    const l = byLrn["120019190005"];
    expect(l.lastName).toBe("CAL");
    expect(l.firstName).toBe("JOHN PAUL");
    expect(l.middleName).toBe("");
  });

  it("lifts a name extension out of the middle-name segment", () => {
    // "CUBERO,NOEL, JR. NARCISO"
    const cubero = byLrn["120019190057"];
    expect(cubero.lastName).toBe("CUBERO");
    expect(cubero.firstName).toBe("NOEL");
    expect(cubero.nameExtension).toBe("JR.");
    expect(cubero.middleName).toBe("NARCISO");

    // "JAYME,JOHN ROMEO, III ARCENAL"
    const jayme = byLrn["120019190003"];
    expect(jayme.firstName).toBe("JOHN ROMEO");
    expect(jayme.nameExtension).toBe("III");
    expect(jayme.middleName).toBe("ARCENAL");
  });

  it("reads the remaining learner fields for a sample row", () => {
    const l = byLrn["120019190018"];
    expect(l.sex).toBe("Male");
    expect(l.birthDate).toBe("2014-03-26");
    expect(l.age).toBe("12");
    expect(l.religion).toBe("Christianity");
    expect(l.fathersName).toBe("ANTOLIJAO, RODRIGO CENIZA");
    expect(l.mothersName).toBe("BERDIN,ELMA,ALIVADO,");
    expect(l.learningModality).toBe("Face to Face");
    expect(l.remarks).toBe("T/I DATE:2026-06-08");
  });

  it("reads the split address columns and composes a full address", () => {
    const l = byLrn["120019190018"];
    expect(l.barangay).toBe("TINGUB");
    expect(l.municipalityCity).toBe("MANDAUE CITY");
    expect(l.province).toBe("CEBU");
    expect(l.address).toBe("TINGUB, MANDAUE CITY, CEBU");
  });

  it("carries the workbook context onto every learner", () => {
    result.records.forEach((r) => {
      expect(r.learner.schoolId).toBe("312810");
      expect(r.learner.gradeLevel).toBe("Grade 7");
      expect(r.learner.section).toBe("FAITH");
      expect(r.learner.schoolYear).toBe("2026-2027");
    });
  });

  it("parses the female block that follows the TOTAL MALE subtotal", () => {
    const l = byLrn["120019190034"];
    expect(l.lastName).toBe("TORREFIEL");
    expect(l.firstName).toBe("XYRHIEN JOY");
    expect(l.middleName).toBe("JUDILLA");
    expect(l.sex).toBe("Female");
  });

  it("raises no structural warnings for a well-formed official SF1", () => {
    const messages = (result.fileIssues || []).map((i) => i.message).join(" ");
    expect(messages).not.toMatch(/no LRN column/i);
    expect(messages).not.toMatch(/no recognized Last Name column/i);
    expect(result.status).not.toBe("error");
  });
});

describe.skipIf(!hasSF10)("real DepEd SF10 sample (BELANGDAL, NICOLE)", () => {
  let result;

  beforeAll(async () => {
    result = await processSF10Buffer(readAsArrayBuffer(SF10_FILE), {
      filename: path.basename(SF10_FILE),
      fileIndex: 0,
    });
  });

  it("emits one record per filled scholastic block", () => {
    // The form carries Grade 7 (SY 2024-2025) and Grade 8 (SY 2025-2026).
    // The blank Grade 9/10 blocks on the "Back" sheet must not become records.
    expect(result.records).toHaveLength(2);
    expect(result.learnerCount).toBe(2);
  });

  it("reads the learner identity whose values sit far from their labels", () => {
    result.records.forEach((r) => {
      const l = r.learner;
      expect(l.lrn).toBe("120217170018");
      expect(l.lastName).toBe("BELANGDAL");
      expect(l.firstName).toBe("NICOLE");
      expect(l.middleName).toBe("");
      expect(l.nameExtension).toBe("");
      expect(l.sex).toBe("Female");
      expect(l.birthDate).toBe("2011-11-13");
    });
  });

  it("takes school context from the SCHOLASTIC RECORD block, not the elementary block", () => {
    // The eligibility block above carries "School ID: 120019" for the
    // elementary school — the JHS record must win.
    const g7 = result.records[0].learner;
    expect(g7.schoolId).toBe("312810");
    expect(g7.schoolName).toBe("Tingub National High School");
    expect(g7.district).toBe("West 1");
    expect(g7.division).toBe("Mandaue City");
    expect(g7.gradeLevel).toBe("7");
    expect(g7.section).toBe("HOPE");
    expect(g7.schoolYear).toBe("2024-2025");
  });

  it("reads each block's own grade level, section and school year", () => {
    const g8 = result.records[1].learner;
    expect(g8.schoolId).toBe("312810");
    expect(g8.gradeLevel).toBe("8");
    expect(g8.section).toBe("JOY");
    expect(g8.schoolYear).toBe("2025-2026");
  });

  it("separates quarterly ratings from the final rating and remarks", () => {
    const g7 = result.records[0].learner;
    expect(g7.learningAreas).toHaveLength(10);

    const filipino = g7.learningAreas.find((a) => a.name === "Filipino");
    expect(filipino.grades).toEqual([95, 98, 98, 98]);
    expect(filipino.finalRating).toBe(97);
    expect(filipino.remarks).toBe("PASSED");

    const mapeh = g7.learningAreas.find((a) => a.name === "MAPEH");
    expect(mapeh.grades).toEqual([92, 93, 93, 94]);
    expect(mapeh.finalRating).toBe(93);

    const g8 = result.records[1].learner;
    const filipino8 = g8.learningAreas.find((a) => a.name === "Filipino");
    expect(filipino8.grades).toEqual([93, 96, 95, 97]);
    expect(filipino8.finalRating).toBe(95);
  });

  it("never imports the quarter sub-header or the remedial table as a learning area", () => {
    result.records.forEach((r) => {
      r.learner.learningAreas.forEach((a) => {
        expect(a.name).not.toMatch(/^\d+$/);
        expect(a.name).not.toMatch(/remedial/i);
      });
    });
  });

  it("reads the general average and promotion status below the blank spacer rows", () => {
    expect(result.records[0].learner.generalAverage).toBe("94");
    expect(result.records[0].learner.promotionStatus).toMatch(/PROMOTED/i);
    expect(result.records[1].learner.generalAverage).toBe("96");
    expect(result.records[1].learner.promotionStatus).toMatch(/PROMOTED/i);
  });

  it("does not treat the learner's two grade levels as a duplicate-LRN error", async () => {
    // Duplicate detection runs in analyzeSF10Files (the path the UI uses), not
    // in processSF10Buffer, so the batch path is what has to be checked here.
    const fakeFile = {
      name: path.basename(SF10_FILE),
      arrayBuffer: async () => readAsArrayBuffer(SF10_FILE),
    };
    const { files, batch } = await analyzeSF10Files([fakeFile], {});

    const codes = files[0].records.flatMap((r) => (r.issues || []).map((i) => i.code));
    expect(codes).not.toContain("duplicate-lrn-within-file");
    expect(codes).not.toContain("identity-conflict");
    expect(batch.totalLearners).toBe(2);
    expect(batch.blockingErrors).toBe(false);
    expect(batch.canImport).toBe(true);
  });
});
