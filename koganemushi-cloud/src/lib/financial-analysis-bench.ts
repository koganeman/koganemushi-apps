/**
 * locaben のベンチマーク参照ロジック。静的JSON（src/data/locaben/*.json）を読み込んで
 * 業種・規模に応じた閾値を返す。
 */

import type { CompanySize, IndicatorKey } from "@/types/financial-analysis";
import industryData from "@/data/locaben/industry.json";
import sizeRulesData from "@/data/locaben/size-rules.json";
import benchmarksData from "@/data/locaben/benchmarks.json";

interface IndustrySub {
  code: string;
  name: string;
}
interface IndustryGroup {
  code: string;
  name: string;
  subs: IndustrySub[];
}

interface SizeRule {
  midCapital: number;
  midEmployees: number;
  smallEmployees: number;
}

interface Benchmark {
  median: number;
  stddev: number;
  thresholds: [number, number, number, number];
}

interface BenchmarkSet {
  direction: "higher" | "lower";
  values: Record<string, Benchmark>;
}

const groups: IndustryGroup[] = (industryData as { groups: IndustryGroup[] }).groups;
const sizeRules: Record<string, SizeRule> = sizeRulesData as Record<string, SizeRule>;
const benchmarks: Record<IndicatorKey, BenchmarkSet> = benchmarksData as unknown as Record<
  IndicatorKey,
  BenchmarkSet
>;

/** すべての業種大分類リスト */
export function listIndustryGroups(): IndustryGroup[] {
  return groups;
}

/** 業種小分類コードから大分類コードを引く */
export function findGroupCodeBySubCode(subCode: string): string | null {
  for (const g of groups) {
    if (g.subs.some((s) => s.code === subCode)) { return g.code; }
  }
  return null;
}

/** 業種小分類の表示名を引く */
export function findIndustryName(subCode: string): string | null {
  for (const g of groups) {
    const found = g.subs.find((s) => s.code === subCode);
    if (found) { return `${g.name} / ${found.name}`; }
  }
  return null;
}

/**
 * 業種大分類・資本金・従業員数から規模区分を判定する。
 *  - 従業員 ≤ smallEmployees → small
 *  - 従業員 ≤ midEmployees AND 資本金 ≤ midCapital → medium
 *  - それ以外 → large（中堅、ベンチマーク無し）
 */
export function determineSize(
  industryGroupCode: string,
  capitalYen: number,
  employees: number,
): CompanySize {
  const r = sizeRules[industryGroupCode];
  if (!r) { return "medium"; }
  if (employees <= r.smallEmployees) { return "small"; }
  if (employees <= r.midEmployees && capitalYen <= r.midCapital) { return "medium"; }
  return "large";
}

/**
 * 指標・業種小分類・規模からベンチマーク閾値を取得。
 * 規模が large（中堅）の場合、ベンチマーク非対応のため null を返す。
 */
export function getBenchmark(
  indicator: IndicatorKey,
  industrySubCode: string,
  size: CompanySize,
): Benchmark | null {
  if (size === "large") { return null; }
  const set = benchmarks[indicator];
  if (!set) { return null; }
  const key = `${industrySubCode}_${size}`;
  return set.values[key] ?? null;
}

/** ベンチマーク値の方向（higher=値が大きいほど良い） */
export function getDirection(indicator: IndicatorKey): "higher" | "lower" {
  return benchmarks[indicator]?.direction ?? "higher";
}

export type { Benchmark, IndustryGroup, IndustrySub };
