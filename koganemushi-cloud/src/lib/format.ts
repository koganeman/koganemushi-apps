/**
 * 数値を日本円形式でフォーマット（カンマ区切り）
 */
export function formatYen(value: number): string {
  if (value === 0) { return ""; }
  return Math.round(value).toLocaleString("ja-JP");
}

/**
 * 文字列をパースして数値に変換（カンマを除去）
 */
export function parseYen(value: string): number {
  const cleaned = value.replace(/,/g, "").replace(/[^\d.-]/g, "");
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? 0 : num;
}

/**
 * パーセント表示用フォーマット
 */
export function formatPercent(value: number): string {
  return (value * 100).toFixed(2);
}

/**
 * パーセント文字列をパースして小数に変換
 */
export function parsePercent(value: string): number {
  const num = parseFloat(value);
  return isNaN(num) ? 0 : num / 100;
}
