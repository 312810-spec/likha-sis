import { readFileSync, writeFileSync } from "node:fs";
import * as XLSX from "xlsx";

const path = "public/SF1_2026_Grade 7 (Year I) - FAITH.xls";
const buf = readFileSync(path);
const wb = XLSX.read(buf, { cellStyles: true, cellDates: false });

const out = [];
for (const wsName of wb.SheetNames) {
  const ws = wb.Sheets[wsName];
  out.push(`\n############ SHEET: ${JSON.stringify(wsName)} ############`);
  out.push(`!ref: ${ws["!ref"]}  merges: ${JSON.stringify(ws["!merges"] || [])}`);
  out.push(`!cols(widths): ${JSON.stringify((ws["!cols"] || []).map((c, i) => ({ col: XLSX.utils.encode_col(i), w: c.wch ?? c.width ?? null })))}`);
  out.push(`!rows(heights): ${JSON.stringify((ws["!rows"] || []).map((r, i) => ({ row: i + 1, h: r.hpt ?? null })).filter((x) => x.h))}`);

  const range = XLSX.utils.decode_range(ws["!ref"]);
  for (let R = range.s.r; R <= range.e.r; R++) {
    const cells = [];
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[addr];
      if (!cell) continue;
      let v = cell.v;
      if (typeof v === "string") v = v.replace(/\n/g, "\\n");
      let style = "";
      if (cell.s) {
        const f = cell.s.font || {};
        const fill = cell.s.fill || {};
        style = `{b:${!!f.b}, sz:${f.sz ?? ""}, fg:${fill.fgColor?.rgb ?? ""}, wrap:${cell.s.alignment?.wrapText ?? ""}, halign:${cell.s.alignment?.horizontal ?? ""}, valign:${cell.s.alignment?.vertical ?? ""}}`;
      }
      cells.push(`${XLSX.utils.encode_col(C)}${R + 1}=${JSON.stringify(v)} ${style}`);
    }
    if (cells.length) out.push(`ROW ${R + 1}: ${cells.join("  ||  ")}`);
  }
}
writeFileSync("tmp-sf1-dump.txt", out.join("\n"), "utf8");
console.log("done");
