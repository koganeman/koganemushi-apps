import type { MonthKey } from "@/types/shikin-guri";

/** "YYYY-MM" を生成 */
export function monthKey(year: number, month1to12: number): MonthKey {
  const m = String(month1to12).padStart(2, "0");
  return `${year}-${m}`;
}

/** "YYYY-MM" を {year, month} に分解 */
export function parseMonthKey(key: MonthKey): { year: number; month: number } {
  const m = /^(\d{4})-(\d{2})$/.exec(key);
  if (!m) { return { year: 1970, month: 1 }; }
  return { year: parseInt(m[1], 10), month: parseInt(m[2], 10) };
}

/** 月を加算（マイナスも可） */
export function addMonths(key: MonthKey, delta: number): MonthKey {
  const { year, month } = parseMonthKey(key);
  const total = year * 12 + (month - 1) + delta;
  const newYear = Math.floor(total / 12);
  const newMonth = (total % 12) + 1;
  return monthKey(newYear, newMonth);
}

/** 開始月から count 個の連続月キーを生成 */
export function enumerateMonths(start: MonthKey, count: number): MonthKey[] {
  const result: MonthKey[] = [];
  for (let i = 0; i < count; i++) {
    result.push(addMonths(start, i));
  }
  return result;
}

/** "2025年7月" / "2025年07月" を MonthKey に変換 */
export function parseJpMonthHeader(s: string): MonthKey | null {
  const m = /^(\d{4})年\s*(\d{1,2})月$/.exec(s.trim());
  if (!m) { return null; }
  return monthKey(parseInt(m[1], 10), parseInt(m[2], 10));
}

/** MonthKey を "2025年7月" に変換 */
export function formatJpMonth(key: MonthKey): string {
  const { year, month } = parseMonthKey(key);
  return `${year}年${month}月`;
}

/** MonthKey を "25/7" のような短縮表記に変換 */
export function formatShortJpMonth(key: MonthKey): string {
  const { year, month } = parseMonthKey(key);
  return `${String(year).slice(2)}/${month}`;
}

/** key1 < key2 */
export function monthBefore(key1: MonthKey, key2: MonthKey): boolean {
  return key1 < key2;
}

/** key1 <= key2 */
export function monthBeforeOrEqual(key1: MonthKey, key2: MonthKey): boolean {
  return key1 <= key2;
}

/** 当月のキーを返す（"YYYY-MM"） */
export function currentMonthKey(): MonthKey {
  const d = new Date();
  return monthKey(d.getFullYear(), d.getMonth() + 1);
}

/** 指定年月の末日（1-31）。Date(year, month, 0) の日。 */
export function endOfMonthDay(year: number, month1to12: number): number {
  return new Date(year, month1to12, 0).getDate();
}

/**
 * Excel EOMONTH(基準, monthsOffset) 相当。基準月に monthsOffset を加えた月の
 * 末日 {year, month, day} を返す。
 * 月の加算は year*12+month の整数演算で行い、Date のタイムゾーンに依存しない。
 */
export function eomonth(
  year: number,
  month1to12: number,
  monthsOffset: number
): { year: number; month: number; day: number } {
  const total = year * 12 + (month1to12 - 1) + monthsOffset;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  return { year: y, month: m, day: endOfMonthDay(y, m) };
}

/** 月末日 {year, month} を転記先 MonthKey ("YYYY-MM") に変換。 */
export function eomonthToMonthKey(year: number, month1to12: number): MonthKey {
  return monthKey(year, month1to12);
}
