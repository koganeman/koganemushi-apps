// koganemushi202506確定申告.pdf の P/L関連ページ（3, 4）を読み込み、
// extractTextLinesFromPdf 相当のロジックで行配列を作って JSON で出力。
// テストの fixture として使う。
import { promises as fs } from "node:fs";

const pdfPath = process.argv[2];
const outPath = process.argv[3];
if (!pdfPath || !outPath) {
  console.error("Usage: node dump-pl-pages.mjs <pdf-file> <output.json>");
  process.exit(1);
}

const data = await fs.readFile(pdfPath);
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

const Y_TOLERANCE = 3;

const loadingTask = pdfjs.getDocument({ data: new Uint8Array(data), useSystemFonts: true });
const pdf = await loadingTask.promise;

function assemble(items) {
  const byY = items
    .filter((it) => it.str !== undefined)
    .map((it) => ({ x: it.transform[4], y: it.transform[5], str: it.str }))
    .sort((a, b) => b.y - a.y);
  const groups = [];
  for (const it of byY) {
    const last = groups[groups.length - 1];
    if (last && Math.abs(last.y - it.y) <= Y_TOLERANCE) {
      last.cells.push({ x: it.x, str: it.str });
    } else {
      groups.push({ y: it.y, cells: [{ x: it.x, str: it.str }] });
    }
  }
  return groups
    .map((g) => g.cells.sort((a, b) => a.x - b.x).map((c) => c.str).join(" "))
    .filter((line) => line.trim().length > 0);
}

const allLines = [];
// ページ3 (P/L) と ページ4 (販管費内訳) のみ
for (const pageNum of [3, 4]) {
  const page = await pdf.getPage(pageNum);
  const content = await page.getTextContent();
  allLines.push(...assemble(content.items));
}

await fs.writeFile(outPath, JSON.stringify(allLines, null, 2), "utf8");
console.log(`Wrote ${allLines.length} lines to ${outPath}`);
