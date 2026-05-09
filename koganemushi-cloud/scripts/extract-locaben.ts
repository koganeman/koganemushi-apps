/**
 * locaben.xlsm（ローカルベンチマーク）から業種マスタとベンチマーク値を抽出し、
 * src/data/locaben/*.json として出力する。
 *
 * 実行: npm run extract:locaben
 */
import * as XLSX from "xlsx";
import * as path from "path";
import * as fs from "fs";

const XLSX_PATH = path.resolve(
  __dirname,
  "../../docs/okaneno-blockpuzzle/locaben.xlsm",
);
const OUT_DIR = path.resolve(__dirname, "../src/data/locaben");

// ============================================================
// 業種マスタ抽出
// ============================================================

interface IndustrySub {
  code: string;
  name: string;
}
interface IndustryGroup {
  code: string;
  name: string;
  subs: IndustrySub[];
}

function parseIndustryCode(rawCode: string): { code: string; name: string } {
  // "0301_食料品・飼料・飲料製造業" → { code: "0301", name: "食料品..." }
  const m = rawCode.match(/^(\d{2,4})_(.+)$/);
  if (!m) { return { code: rawCode, name: rawCode }; }
  return { code: m[1], name: m[2] };
}

function extractIndustryGroups(wb: XLSX.WorkBook): IndustryGroup[] {
  const sheet = wb.Sheets["【参照】業種区分"];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: null,
  });
  const groups: IndustryGroup[] = [];
  for (const r of rows) {
    const arr = r as unknown[];
    const groupCell = arr[0];
    if (!groupCell || typeof groupCell !== "string") { continue; }
    const { code, name } = parseIndustryCode(groupCell);
    const subs: IndustrySub[] = [];
    for (let i = 1; i < arr.length; i++) {
      const c = arr[i];
      if (!c || typeof c !== "string") { continue; }
      subs.push(parseIndustryCode(c));
    }
    groups.push({ code, name, subs });
  }
  return groups;
}

// ============================================================
// 規模判定ルール（中小企業基本法準拠、locaben【参照】企業規模シートから手動転記）
// ============================================================

interface SizeRule {
  midCapital: number;     // 中規模の資本金上限（円）
  midEmployees: number;   // 中規模の従業員上限
  smallEmployees: number; // 小規模の従業員上限
}

// 大分類コード → ルール
const SIZE_RULES: Record<string, SizeRule> = {
  "01": { midCapital: 300_000_000, midEmployees: 300, smallEmployees: 20 }, // 農業
  "02": { midCapital: 300_000_000, midEmployees: 300, smallEmployees: 20 }, // 建設業
  "03": { midCapital: 300_000_000, midEmployees: 300, smallEmployees: 20 }, // 製造業
  "04": { midCapital: 100_000_000, midEmployees: 100, smallEmployees: 5 },  // 卸売業
  "05": { midCapital:  50_000_000, midEmployees:  50, smallEmployees: 5 },  // 小売業
  "06": { midCapital:  50_000_000, midEmployees:  50, smallEmployees: 5 },  // 飲食業
  "07": { midCapital: 300_000_000, midEmployees: 300, smallEmployees: 20 }, // 不動産業
  "08": { midCapital: 300_000_000, midEmployees: 300, smallEmployees: 20 }, // 運輸業
  "09": { midCapital: 300_000_000, midEmployees: 300, smallEmployees: 20 }, // エネルギー
  "10": { midCapital:  50_000_000, midEmployees: 100, smallEmployees: 5 },  // サービス業
  "11": { midCapital:  50_000_000, midEmployees: 100, smallEmployees: 5 },  // 医療業
  "12": { midCapital:  50_000_000, midEmployees: 100, smallEmployees: 5 },  // 保険衛生
  "13": { midCapital: 300_000_000, midEmployees: 300, smallEmployees: 20 }, // 観光業
  "14": { midCapital: 300_000_000, midEmployees: 300, smallEmployees: 20 }, // その他
};

// ============================================================
// ベンチマーク抽出
// ============================================================

interface Benchmark {
  median: number;
  stddev: number;
  /** [ⅳ, ⅲ, ⅱ, ⅰ] の順。指標により方向が異なる（後述） */
  thresholds: [number, number, number, number];
}

interface BenchmarkSet {
  /** "higher" = 値が大きいほど良い、"lower" = 小さいほど良い */
  direction: "higher" | "lower";
  /** key: `${subCode}_${size}` 例: "0301_medium" */
  values: Record<string, Benchmark>;
}

const BENCH_SHEETS: { sheet: string; key: string; direction: "higher" | "lower" }[] = [
  { sheet: "【参照】売上増加率基準値",         key: "salesGrowth",            direction: "higher" },
  { sheet: "【参照】営業利益率基準値",         key: "operatingMargin",        direction: "higher" },
  { sheet: "【参照】労働生産性基準値",         key: "laborProductivity",      direction: "higher" },
  { sheet: "【参照】EBITDA基準値",             key: "ebitdaDebtMultiple",     direction: "lower"  },
  { sheet: "【参照】営業運転資本回転期間基準値", key: "workingCapitalTurnover", direction: "lower"  },
  { sheet: "【参照】自己資本比率基準値",       key: "equityRatio",            direction: "higher" },
];

function extractBenchmark(
  wb: XLSX.WorkBook,
  sheetName: string,
  direction: "higher" | "lower",
): BenchmarkSet {
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: null,
  });
  const values: Record<string, Benchmark> = {};
  // ヘッダー行をスキップ。行: [指標, 大分類, 小分類, 事業規模, 中央値, 標準偏差, ⅳ, ⅲ, ⅱ, ⅰ]
  for (const r of rows) {
    const arr = r as unknown[];
    const ind = arr[0];
    const sub = arr[2];
    const sizeJp = arr[3];
    if (typeof ind !== "string" || !ind.match(/^[①-⑥]/)) { continue; }
    if (typeof sub !== "string" || sub.startsWith("不使用")) { continue; }
    if (typeof sizeJp !== "string") { continue; }
    const subCode = parseIndustryCode(sub).code;
    const size = sizeJp.includes("中規模") ? "medium" : sizeJp.includes("小規模") ? "small" : null;
    if (!size) { continue; }
    const median = Number(arr[4]);
    const stddev = Number(arr[5]);
    const t4 = Number(arr[6]);
    const t3 = Number(arr[7]);
    const t2 = Number(arr[8]);
    const t1 = Number(arr[9]);
    if (![median, stddev, t4, t3, t2, t1].every(Number.isFinite)) { continue; }
    values[`${subCode}_${size}`] = {
      median,
      stddev,
      thresholds: [t4, t3, t2, t1],
    };
  }
  return { direction, values };
}

// ============================================================
// 出力
// ============================================================

function ensureDir(p: string) {
  if (!fs.existsSync(p)) { fs.mkdirSync(p, { recursive: true }); }
}

function main() {
  const wb = XLSX.readFile(XLSX_PATH);
  ensureDir(OUT_DIR);

  // 業種マスタ
  const groups = extractIndustryGroups(wb);
  fs.writeFileSync(
    path.join(OUT_DIR, "industry.json"),
    JSON.stringify({ groups }, null, 2),
    "utf-8",
  );
  console.log(`industry.json written (${groups.length} groups)`);

  // 規模判定ルール
  fs.writeFileSync(
    path.join(OUT_DIR, "size-rules.json"),
    JSON.stringify(SIZE_RULES, null, 2),
    "utf-8",
  );
  console.log(`size-rules.json written`);

  // 各指標のベンチマーク
  const allBench: Record<string, BenchmarkSet> = {};
  for (const b of BENCH_SHEETS) {
    const set = extractBenchmark(wb, b.sheet, b.direction);
    allBench[b.key] = set;
    console.log(`  ${b.key}: ${Object.keys(set.values).length} entries`);
  }
  fs.writeFileSync(
    path.join(OUT_DIR, "benchmarks.json"),
    JSON.stringify(allBench, null, 2),
    "utf-8",
  );
  console.log(`benchmarks.json written`);
}

main();
