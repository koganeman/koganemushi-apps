/**
 * 確定申告書PDFから貸借対照表（B/S）データを抽出するためのロジック群。
 * UI非依存の純関数。PDF→テキスト行変換は pdf-pl-extract.ts の関数を再利用。
 */

import type { BSPeriodInput } from "@/types/balance-sheet";
import { createEmptyBSPeriod } from "./balance-sheet-calc";
import { extractTextLinesFromPdf, parseJpNumber } from "./pdf-pl-extract";

export { extractTextLinesFromPdf };

// ============================================================
// 抽出値の型定義
// ============================================================

export interface ExtractedBSRawValues {
  /** 期末日（"YYYY/M/D"形式） */
  periodEnd?: string;
  cash?: number;
  /** 流動資産合計（cashを含む値の場合あり） */
  currentAssetsTotal?: number;
  /** 固定資産合計 */
  fixedAssetsTotal?: number;
  /** 流動負債合計 */
  currentLiabilitiesTotal?: number;
  /** 固定負債合計 */
  longTermLiabilitiesTotal?: number;
  /** 純資産合計 */
  netAssetsTotal?: number;
  /** 資産合計（debug用、純資産抽出のフォールバックに使用） */
  totalAssets?: number;
  /** 負債及び純資産合計（debug用） */
  totalLiabilitiesAndEquity?: number;
}

export interface ExtractedBSData {
  raw: ExtractedBSRawValues;
  warnings: string[];
}

// ============================================================
// パース
// ============================================================

function normalizeLabel(s: string): string {
  // 空白・縦パイプ・読点・【】 を除去（【流動資産】 → 流動資産）
  return s.replace(/[\s|、【】［］\[\]]/g, "");
}

interface BSLabelRule {
  field: keyof ExtractedBSRawValues;
  /** 候補ラベル群。配列の先頭から順に検索。先頭ほど優先度が高い（具体的なラベルから） */
  labels: string[];
  /** 警告メッセージ用の代表ラベル */
  displayLabel: string;
  required: boolean;
}

/**
 * 貸借対照表は「資産の部」と「負債の部」が横並びで印刷されることが多く、PDF抽出後の1行に
 * 「流動資産 24,236,982 流動負債 9,498,246」のように両方が含まれる場合がある。
 * そこで「ラベル位置を見つけ → ラベル直後にすぐ続く最初の数値を取る」方式で対応する。
 */
const RULES: BSLabelRule[] = [
  {
    field: "cash",
    displayLabel: "現預金",
    labels: ["現金及び預金", "現金預金", "現預金"],
    required: false,
  },
  {
    field: "currentAssetsTotal",
    displayLabel: "流動資産合計",
    labels: ["流動資産合計", "流動資産計", "流動資産"],
    required: true,
  },
  {
    field: "fixedAssetsTotal",
    displayLabel: "固定資産合計",
    labels: ["固定資産合計", "固定資産計", "固定資産"],
    required: true,
  },
  {
    field: "currentLiabilitiesTotal",
    displayLabel: "流動負債合計",
    labels: ["流動負債合計", "流動負債計", "流動負債"],
    required: true,
  },
  {
    field: "longTermLiabilitiesTotal",
    displayLabel: "固定負債合計",
    labels: ["固定負債合計", "固定負債計", "固定負債"],
    required: true,
  },
  {
    field: "netAssetsTotal",
    displayLabel: "純資産合計",
    labels: ["純資産の部合計", "純資産合計", "資本合計", "株主資本"],
    required: true,
  },
  {
    field: "totalAssets",
    displayLabel: "資産合計",
    labels: ["資産の部合計", "資産合計"],
    required: false,
  },
  {
    field: "totalLiabilitiesAndEquity",
    displayLabel: "負債純資産合計",
    labels: [
      "負債及び純資産の部合計",
      "負債純資産の部合計",
      "負債及び純資産合計",
      "負債純資産合計",
      "負債及び資本合計",
    ],
    required: false,
  },
];

const NUMBER_AFTER_LABEL_RE = /^[△▲−\-(]?\d{1,3}(?:[,，]\d{3})*\)?|^[△▲−\-(]?\d+\)?/;
const FULL_NUMERIC_LINE_RE = /^[△▲−\-(]?\d{1,3}(?:[,，]\d{3})*\)?$|^[△▲−\-(]?\d+\)?$/;

/**
 * ラベルの位置を「行頭」または「直前が数値・カンマ・閉じ括弧」（=セクション境界）に限定して探す。
 * これにより、ラベルが他の語の途中にたまたま含まれるケース（誤マッチ）を防ぐ。
 */
function findValidLabelPos(norm: string, label: string): number {
  let from = 0;
  for (;;) {
    const idx = norm.indexOf(label, from);
    if (idx === -1) { return -1; }
    if (idx === 0) { return idx; }
    const prev = norm[idx - 1];
    if (/[\d,，)）]/.test(prev)) { return idx; }
    from = idx + 1;
  }
}

function eraOffset(era: string): number {
  if (era === "令和") { return 2018; }
  if (era === "平成") { return 1988; }
  if (era === "昭和") { return 1925; }
  return 0;
}

type DateExtractor = (normalized: string) => string | undefined;

const seirekiAtExtractor: DateExtractor = (ln) => {
  const m = ln.match(/(\d{4})年(\d{1,2})月(\d{1,2})日現在/);
  if (!m) { return undefined; }
  return `${parseInt(m[1], 10)}/${parseInt(m[2], 10)}/${parseInt(m[3], 10)}`;
};

const warekiAtExtractor: DateExtractor = (ln) => {
  const m = ln.match(/(令和|平成|昭和)(\d{1,2})年(\d{1,2})月(\d{1,2})日現在/);
  if (!m) { return undefined; }
  const y = parseInt(m[2], 10) + eraOffset(m[1]);
  return `${y}/${parseInt(m[3], 10)}/${parseInt(m[4], 10)}`;
};

const seirekiRangeEndExtractor: DateExtractor = (ln) => {
  const m = ln.match(/(\d{4})年(\d{1,2})月(\d{1,2})日[〜～~](\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (!m) { return undefined; }
  return `${parseInt(m[4], 10)}/${parseInt(m[5], 10)}/${parseInt(m[6], 10)}`;
};

const warekiRangeEndExtractor: DateExtractor = (ln) => {
  const m = ln.match(/(令和|平成|昭和)(\d{1,2})年(\d{1,2})月(\d{1,2})日[〜～~](?:至)?(令和|平成|昭和)(\d{1,2})年(\d{1,2})月(\d{1,2})日/);
  if (!m) { return undefined; }
  const y = parseInt(m[5], 10) + eraOffset(m[4]);
  return `${y}/${parseInt(m[6], 10)}/${parseInt(m[7], 10)}`;
};

const DATE_EXTRACTORS: DateExtractor[] = [
  seirekiAtExtractor,
  warekiAtExtractor,
  seirekiRangeEndExtractor,
  warekiRangeEndExtractor,
];

function detectPeriodEnd(normalizedLines: string[]): string | undefined {
  for (const extract of DATE_EXTRACTORS) {
    for (const ln of normalizedLines) {
      const v = extract(ln);
      if (v) { return v; }
    }
  }
  return undefined;
}

/**
 * 指定行 + ラベル候補群から、ラベル直後の最初の数値を取り出す。
 *  - 同じ行にラベル + 数値が含まれる（横並び1列または2列レイアウト両対応）
 *  - ヘッダー行とその次行に数値が分離している場合（次行が純粋な数値行のときのみ）
 */
function tryExtractValueAtLine(
  rule: BSLabelRule,
  norm: string,
  nextNorm: string | undefined,
): number | undefined {
  for (const label of rule.labels) {
    const idx = findValidLabelPos(norm, label);
    if (idx === -1) { continue; }
    const after = norm.slice(idx + label.length);
    const m = after.match(NUMBER_AFTER_LABEL_RE);
    if (m) {
      const v = parseJpNumber(m[0]);
      if (v !== undefined) { return v; }
    }
    // ヘッダー行のみ（ラベル直後に数値なし）→ 次行が純粋数値ならそれを使う
    if (nextNorm !== undefined && FULL_NUMERIC_LINE_RE.test(nextNorm)) {
      const v = parseJpNumber(nextNorm);
      if (v !== undefined) { return v; }
    }
  }
  return undefined;
}

function findValueForRule(rule: BSLabelRule, normalizedLines: string[]): number | undefined {
  for (let i = 0; i < normalizedLines.length; i++) {
    const v = tryExtractValueAtLine(
      rule,
      normalizedLines[i],
      i + 1 < normalizedLines.length ? normalizedLines[i + 1] : undefined,
    );
    if (v !== undefined) { return v; }
  }
  return undefined;
}

function collectRequiredWarnings(raw: ExtractedBSRawValues): string[] {
  const warnings: string[] = [];
  for (const rule of RULES) {
    if (!rule.required || raw[rule.field] !== undefined) { continue; }
    warnings.push(`必須項目「${rule.displayLabel}」を抽出できませんでした`);
  }
  return warnings;
}

/**
 * PDFから抽出したテキスト行をB/Sデータに変換する純関数。
 */
export function parseBSFromPdfLines(lines: string[]): ExtractedBSData {
  const raw: ExtractedBSRawValues = {};
  const warnings: string[] = [];

  const normalizedLines = lines.map(normalizeLabel);

  raw.periodEnd = detectPeriodEnd(normalizedLines);
  if (!raw.periodEnd) {
    warnings.push("期末日を検出できませんでした");
  }

  for (const rule of RULES) {
    const v = findValueForRule(rule, normalizedLines);
    if (v !== undefined) { raw[rule.field] = v as never; }
  }

  warnings.push(...collectRequiredWarnings(raw));

  return { raw, warnings };
}

// ============================================================
// マッピング
// ============================================================

export interface BSMapDerivation {
  /** 流動資産（現預金を引いた残り） */
  currentAssetsExCash: number;
  /** 借方合計 */
  totalAssetsCalc: number;
  /** 貸方合計 */
  totalCapitalCalc: number;
  /** 借方−貸方 */
  imbalance: number;
}

export interface BSMapResult {
  input: BSPeriodInput;
  derivation: BSMapDerivation;
}

const v = (n?: number) => n ?? 0;

/**
 * 抽出値を BSPeriodInput にマッピング。
 * 「流動資産（現預金除く）」は流動資産合計 − 現預金 で算出。
 */
export function mapExtractedBSToInput(extracted: ExtractedBSData): BSMapResult {
  const r = extracted.raw;
  const periodLabel = r.periodEnd ?? "";
  const cash = v(r.cash);
  const currentTotal = v(r.currentAssetsTotal);
  const currentAssetsExCash = Math.max(0, currentTotal - cash);
  const fixedAssets = v(r.fixedAssetsTotal);
  const currentLiabilities = v(r.currentLiabilitiesTotal);
  const longTermLiabilities = v(r.longTermLiabilitiesTotal);
  const netAssets = v(r.netAssetsTotal);

  const totalAssetsCalc = cash + currentAssetsExCash + fixedAssets;
  const totalCapitalCalc = currentLiabilities + longTermLiabilities + netAssets;

  const input: BSPeriodInput = {
    ...createEmptyBSPeriod(periodLabel),
    cash,
    currentAssetsExCash,
    fixedAssets,
    currentLiabilities,
    longTermLiabilities,
    netAssets,
  };

  return {
    input,
    derivation: {
      currentAssetsExCash,
      totalAssetsCalc,
      totalCapitalCalc,
      imbalance: totalAssetsCalc - totalCapitalCalc,
    },
  };
}
