import { readFileSync } from "node:fs";
import { processSF1Buffer, analyzeSF1Files } from "./src/importers/sf1/importSF1.js";

const path = "public/SF1_2026_Grade 7 (Year I) - FAITH.xls";
const buf = readFileSync(path);
const model = await processSF1Buffer(buf, { filename: "SF1_2026_Grade 7 (Year I) - FAITH.xls", fileIndex: 0 });

console.log("=== school ===");
console.log(JSON.stringify(model.school, null, 2));
console.log("=== status/learnerCount/stats ===");
console.log({ status: model.status, learnerCount: model.learnerCount, stats: model.stats, sheetName: model.sheetName });
console.log("=== fileIssues ===");
console.log(JSON.stringify(model.fileIssues, null, 2));
console.log("=== first 3 records (learner keys) ===");
for (const r of model.records.slice(0, 3)) {
  console.log(JSON.stringify(r.learner, null, 2));
  console.log("--- issues:", JSON.stringify(r.summary), "severity:", r.severity);
}
console.log("=== record count:", model.records.length, "===");
