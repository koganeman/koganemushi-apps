// PDFからテキストを抽出してページごとに出力するスクリプト
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const pdfPath = process.argv[2];
if (!pdfPath) {
  console.error("Usage: node extract-pdf-text.mjs <pdf-file>");
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const data = await fs.readFile(pdfPath);

// pdfjs-dist の legacy ビルドを使う（Node環境向け）
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

const loadingTask = pdfjs.getDocument({ data: new Uint8Array(data), useSystemFonts: true });
const pdf = await loadingTask.promise;
console.log(`総ページ数: ${pdf.numPages}`);

for (let i = 1; i <= pdf.numPages; i++) {
  const page = await pdf.getPage(i);
  const textContent = await page.getTextContent();
  const items = textContent.items;
  // 各item: { str, transform (matrix), width, height }
  // y座標で行をグループ化、x座標で列を保つ
  const rows = new Map();
  for (const item of items) {
    const x = item.transform[4];
    const y = Math.round(item.transform[5]);
    if (!rows.has(y)) { rows.set(y, []); }
    rows.get(y).push({ x, str: item.str });
  }
  // y降順（PDFは下から上）
  const sortedYs = [...rows.keys()].sort((a, b) => b - a);
  console.log(`\n===== ページ ${i} =====`);
  for (const y of sortedYs) {
    const cells = rows.get(y).sort((a, b) => a.x - b.x);
    const line = cells.map((c) => c.str).join(" | ");
    if (line.trim()) { console.log(line); }
  }
}
