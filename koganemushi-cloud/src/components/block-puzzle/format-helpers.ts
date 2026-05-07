import type { BlockPuzzleUnit } from "@/types/block-puzzle";

/**
 * 表示単位に応じて金額を整形する。
 * - "yen": 円単位、カンマ区切り
 * - "thousand": 千円単位（÷1000、四捨五入）、カンマ区切り
 */
export function formatAmount(value: number, unit: BlockPuzzleUnit): string {
  if (value === 0) { return "0"; }
  const v = unit === "thousand" ? Math.round(value / 1000) : Math.round(value);
  return v.toLocaleString("ja-JP");
}

/**
 * 単位ラベル
 */
export function unitLabel(unit: BlockPuzzleUnit): string {
  return unit === "thousand" ? "千円" : "円";
}

/**
 * 小数の比率を「○○.○%」表示に変換
 */
export function formatRate(value: number): string {
  if (!isFinite(value)) { return "-" ; }
  return (value * 100).toFixed(1) + "%";
}
