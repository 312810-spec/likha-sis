import { readFileSync } from "node:fs";
import { readWorkbook } from "./src/importers/shared/excelReader.js";
import { detectSF1Structure } from "./src/importers/sf1/detectSF1Structure.js";
import { parseSF1 } from "./src/importers/sf1/parseSF1.js";
import { normalizeSF1 } from "./src/importers/sf1/normalizeSF1.js";

const buf = readFileSync("public/SF1_2026_Grade 7 (Year I) - FAITH.xls");
const { sheets } = readWorkbook(buf);
const sheet = sheets[0];
const structure = detectSF1Structure(sheet);
const { rawLearners, droppedRows } = parseSF1(structure);
const { learners } = normalizeSF1(rawLearners);

console.log("raw[0] keys:", Object.keys(rawLearners[0]).join(", "));
console.log("raw[0]:", JSON.stringify(rawLearners[0], null, 0));
console.log("normalized[0] keys:", Object.keys(learners[0]).join(", "));
console.log("columnMap sample:", JSON.stringify(structure.columnMap));
console.log("motherTongue in normalized:", JSON.stringify(learners[0].motherTongue));
console.log("ipEthnicGroup in normalized:", JSON.stringify(learners[0].ipEthnicGroup));
console.log("learners:", learners.length, "dropped:", droppedRows.length);