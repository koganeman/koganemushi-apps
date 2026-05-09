/**
 * ローカルベンチマーク 6指標の計算 + スコアリング + 総合グレード判定。
 */

import type { BlockPuzzleResult } from "@/types/block-puzzle";
import type { BalanceSheetResult } from "@/types/balance-sheet";
import type {
  AnalysisResult,
  BSDetail,
  CompanyProfile,
  IndicatorKey,
  IndicatorResult,
} from "@/types/financial-analysis";
import {
  determineSize,
  getBenchmark,
  getDirection,
} from "./financial-analysis-bench";

// ============================================================
// 基礎値
// ============================================================

/**
 * 営業利益 = 売上 − 変動費 − 固定費（人件費 + その他販管費）
 * 既存のBlockPuzzleResultでは preTaxProfit = 粗利 − 固定費 となっており、
 * 営業外損益・特別損益が固定費に折り込まれているケースがあるため、
 * P/Lインプット側の sellingAdminOther 等を素直に reverse しない方針。
 * 簡易的に preTaxProfit を「営業利益相当」として扱う（locaben入力欄でも区別が薄い場合あり）。
 *
 * 厳密性が必要なら、PL入力に「営業利益」フィールドを追加する別タスクとする。
 */
export function operatingProfitFromPL(pl: BlockPuzzleResult): number {
  return pl.preTaxProfit;
}

// ============================================================
// 各指標の計算
// ============================================================

interface PerPeriodInput {
  pl: BlockPuzzleResult;
  /** 1期前のP/L（売上増加率の計算に使用）。null=前期データなし */
  plPrev: BlockPuzzleResult | null;
  bs: BalanceSheetResult;
  detail: BSDetail | null;
  employees: number | null;
}

function safeDiv(a: number, b: number): number | null {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) { return null; }
  return a / b;
}

function calcSalesGrowth(p: PerPeriodInput): number | null {
  if (!p.plPrev || p.plPrev.sales === 0 || p.pl.sales === 0) { return null; }
  return safeDiv(p.pl.sales, p.plPrev.sales)! - 1;
}

function calcOperatingMargin(p: PerPeriodInput): number | null {
  if (p.pl.sales === 0) { return null; }
  return safeDiv(operatingProfitFromPL(p.pl), p.pl.sales);
}

function calcLaborProductivity(p: PerPeriodInput): number | null {
  if (!p.employees || p.employees <= 0) { return null; }
  // 千円単位（locabenの基準値が千円単位のため）
  const opYen = operatingProfitFromPL(p.pl);
  return opYen / 1000 / p.employees;
}

function calcEbitdaDebtMultiple(p: PerPeriodInput): number | null {
  if (!p.detail) { return null; }
  const op = operatingProfitFromPL(p.pl);
  const ebitda = op + p.pl.depreciation;
  if (ebitda <= 0) { return null; } // 算出不可（locabenでも対応外）
  const netDebt = p.detail.totalDebt - p.bs.cash;
  return netDebt / ebitda;
}

function calcWorkingCapitalTurnover(p: PerPeriodInput): number | null {
  if (!p.detail) { return null; }
  if (p.pl.sales === 0) { return null; }
  const wc = p.detail.receivables + p.detail.inventory - p.detail.payables;
  const monthlySales = p.pl.sales / 12;
  return safeDiv(wc, monthlySales);
}

function calcEquityRatio(p: PerPeriodInput): number | null {
  // BalanceSheetResult の equityRatio を使用（純資産/総資産）
  if (p.bs.totalAssets === 0) { return null; }
  return p.bs.equityRatio;
}

const CALC_FNS: Record<IndicatorKey, (p: PerPeriodInput) => number | null> = {
  salesGrowth: calcSalesGrowth,
  operatingMargin: calcOperatingMargin,
  laborProductivity: calcLaborProductivity,
  ebitdaDebtMultiple: calcEbitdaDebtMultiple,
  workingCapitalTurnover: calcWorkingCapitalTurnover,
  equityRatio: calcEquityRatio,
};

// ============================================================
// スコアリング
// ============================================================

function scoreHigher(value: number, t: number[]): 1 | 2 | 3 | 4 | 5 {
  const [t4, t3, t2, t1] = t;
  if (value >= t1) { return 5; }
  if (value >= t2) { return 4; }
  if (value >= t3) { return 3; }
  if (value >= t4) { return 2; }
  return 1;
}

function scoreLower(value: number, t: number[]): 1 | 2 | 3 | 4 | 5 {
  const [t4, t3, t2, t1] = t;
  if (value <= t1) { return 5; }
  if (value <= t2) { return 4; }
  if (value <= t3) { return 3; }
  if (value <= t4) { return 2; }
  return 1;
}

/**
 * 5段階スコアを計算する。
 *  thresholds = [ⅳ, ⅲ, ⅱ, ⅰ]
 *  direction "higher": 値が大きいほど良い → X≥ⅰ:5, ⅱ≤X<ⅰ:4, ...
 *  direction "lower":  値が小さいほど良い → X≤ⅰ:5, ...
 */
export function scoreAgainstBenchmark(
  value: number,
  thresholds: number[],
  direction: "higher" | "lower",
): 1 | 2 | 3 | 4 | 5 {
  return direction === "higher" ? scoreHigher(value, thresholds) : scoreLower(value, thresholds);
}

/** 総合グレード判定（locaben準拠: A:24+, B:18-23, C:12-17, D:<12） */
export function computeGrade(totalScore: number): "A" | "B" | "C" | "D" {
  if (totalScore >= 24) { return "A"; }
  if (totalScore >= 18) { return "B"; }
  if (totalScore >= 12) { return "C"; }
  return "D";
}

// ============================================================
// メイン
// ============================================================

interface ComputeArgs {
  plResults: BlockPuzzleResult[];
  bsResults: BalanceSheetResult[];
  bsDetails: BSDetail[];
  profile: CompanyProfile;
}

interface BenchContext {
  profile: CompanyProfile;
  hasIndustry: boolean;
  size: ReturnType<typeof determineSize>;
}

function buildResult(key: IndicatorKey, p: PerPeriodInput, ctx: BenchContext): IndicatorResult {
  const value = CALC_FNS[key](p);
  if (value === null) {
    return { value: null, score: null, benchMedian: null, benchThresholds: null };
  }
  if (!ctx.hasIndustry) {
    return { value, score: null, benchMedian: null, benchThresholds: null };
  }
  const bench = getBenchmark(key, ctx.profile.industrySubCode, ctx.size);
  if (!bench) {
    return { value, score: null, benchMedian: null, benchThresholds: null };
  }
  const score = scoreAgainstBenchmark(value, bench.thresholds, getDirection(key));
  return {
    value,
    score,
    benchMedian: bench.median,
    benchThresholds: bench.thresholds,
  };
}

function buildPeriodResult(p: PerPeriodInput, ctx: BenchContext): AnalysisResult {
  const salesGrowth = buildResult("salesGrowth", p, ctx);
  const operatingMargin = buildResult("operatingMargin", p, ctx);
  const laborProductivity = buildResult("laborProductivity", p, ctx);
  const ebitdaDebtMultiple = buildResult("ebitdaDebtMultiple", p, ctx);
  const workingCapitalTurnover = buildResult("workingCapitalTurnover", p, ctx);
  const equityRatio = buildResult("equityRatio", p, ctx);
  const indicators = [
    salesGrowth, operatingMargin, laborProductivity,
    ebitdaDebtMultiple, workingCapitalTurnover, equityRatio,
  ];
  const scoresValid = indicators
    .map((r) => r.score)
    .filter((s): s is 1 | 2 | 3 | 4 | 5 => s !== null);
  const totalScore = scoresValid.length > 0 ? scoresValid.reduce((a, b) => a + b, 0) : null;
  const grade = scoresValid.length === 6 && totalScore !== null ? computeGrade(totalScore) : null;
  return {
    periodLabel: p.pl.periodLabel,
    salesGrowth, operatingMargin, laborProductivity,
    ebitdaDebtMultiple, workingCapitalTurnover, equityRatio,
    totalScore, grade,
  };
}

function buildContext(profile: CompanyProfile): BenchContext {
  const hasIndustry =
    profile.industrySubCode !== "" && profile.industryGroupCode !== "";
  const size = hasIndustry
    ? determineSize(
        profile.industryGroupCode,
        profile.capitalYen,
        profile.employeeCounts[0] ?? 0,
      )
    : "medium";
  return { profile, hasIndustry, size };
}

function buildPeriodInput(args: ComputeArgs, i: number): PerPeriodInput | null {
  const pl = args.plResults[i];
  const bs = args.bsResults[i] ?? null;
  if (!bs) { return null; }
  return {
    pl,
    plPrev: i + 1 < args.plResults.length ? args.plResults[i + 1] : null,
    bs,
    detail: args.bsDetails[i] ?? null,
    employees: args.profile.employeeCounts[i] ?? null,
  };
}

export function computeAllIndicators(args: ComputeArgs): AnalysisResult[] {
  const ctx = buildContext(args.profile);
  const out: AnalysisResult[] = [];
  for (let i = 0; i < args.plResults.length; i++) {
    const periodInput = buildPeriodInput(args, i);
    if (!periodInput) {
      out.push(emptyResult(args.plResults[i].periodLabel));
      continue;
    }
    out.push(buildPeriodResult(periodInput, ctx));
  }
  return out;
}

function emptyResult(periodLabel: string): AnalysisResult {
  const empty: IndicatorResult = {
    value: null,
    score: null,
    benchMedian: null,
    benchThresholds: null,
  };
  return {
    periodLabel,
    salesGrowth: empty,
    operatingMargin: empty,
    laborProductivity: empty,
    ebitdaDebtMultiple: empty,
    workingCapitalTurnover: empty,
    equityRatio: empty,
    totalScore: null,
    grade: null,
  };
}

// ============================================================
// 表示メタ
// ============================================================

export interface IndicatorMeta {
  key: IndicatorKey;
  label: string;
  unit: string; // "%", "倍", "ヶ月", "千円"
  /** ローカルベンチマーク分類: 売上持続性 / 収益性 / 生産性 / 健全性 / 効率性 / 安全性 */
  category: string;
  /** 算式（経営者にも分かるテキスト） */
  formula: string;
  /** 値の表示フォーマッタ */
  format: (v: number) => string;
}

function fmtPct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}
function fmtTimes(v: number): string {
  return `${v.toFixed(2)}倍`;
}
function fmtMonths(v: number): string {
  return `${v.toFixed(2)}ヶ月`;
}
function fmtThousand(v: number): string {
  return `${Math.round(v).toLocaleString("ja-JP")}千円`;
}

export const INDICATOR_META: IndicatorMeta[] = [
  {
    key: "salesGrowth",
    label: "①売上増加率",
    unit: "%",
    category: "売上持続性",
    formula: "(最新期売上高 ÷ 前期売上高) − 1",
    format: fmtPct,
  },
  {
    key: "operatingMargin",
    label: "②営業利益率",
    unit: "%",
    category: "収益性",
    formula: "営業利益 ÷ 最新期売上高",
    format: fmtPct,
  },
  {
    key: "laborProductivity",
    label: "③労働生産性",
    unit: "千円",
    category: "生産性",
    formula: "営業利益 ÷ 従業員数",
    format: fmtThousand,
  },
  {
    key: "ebitdaDebtMultiple",
    label: "④EBITDA有利子負債倍率",
    unit: "倍",
    category: "健全性",
    formula: "(借入金 − 現金・預金) ÷ (営業利益 + 減価償却費)",
    format: fmtTimes,
  },
  {
    key: "workingCapitalTurnover",
    label: "⑤営業運転資本回転期間",
    unit: "ヶ月",
    category: "効率性",
    formula:
      "{売上債権(売掛金+受取手形) + 棚卸資産 − 買入債務(買掛金+支払手形)} ÷ (売上高 ÷ 12)",
    format: fmtMonths,
  },
  {
    key: "equityRatio",
    label: "⑥自己資本比率",
    unit: "%",
    category: "安全性",
    formula: "純資産 ÷ 負債・純資産合計",
    format: fmtPct,
  },
];
