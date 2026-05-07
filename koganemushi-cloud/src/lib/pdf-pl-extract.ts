/**
 * 確定申告書PDFからP/Lデータを抽出するためのロジック群。
 * UI非依存の純関数として実装し、ユニットテストは parsePLFromPdfLines に対して行う。
 */

import type { PLPeriodInput } from "@/types/block-puzzle";
import { createEmptyPLPeriod } from "./block-puzzle-calc";

const Y_TOLERANCE_PX = 3;
const PDF_WORKER_PATH = "/pdf.worker.min.mjs";

interface PdfTextItem {
  str: string;
  transform: number[];
}

/**
 * pdfjs-dist (browser build) を使ってPDFからテキスト行を抽出する。
 * Y座標で行をグループ化（±3px許容）し、X座標で並び替えてスペース連結する。
 */
export async function extractTextLinesFromPdf(file: File): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist");
  const opts = pdfjs.GlobalWorkerOptions as { workerSrc: string };
  if (!opts.workerSrc) {
    opts.workerSrc = PDF_WORKER_PATH;
  }
  const buf = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data: buf, useSystemFonts: true }).promise;
  const out: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const items = content.items as PdfTextItem[];
    out.push(...assembleLinesFromItems(items));
  }
  return out;
}

/**
 * テキストアイテム配列を行に組み立てる純関数。Y座標が±tolerance内のものを同じ行とする。
 */
export function assembleLinesFromItems(items: PdfTextItem[]): string[] {
  type Cell = { x: number; str: string };
  const groups: { y: number; cells: Cell[] }[] = [];
  // 各itemをY値ごとにバケット化
  const byY = items
    .filter((it) => it.str !== undefined)
    .map((it) => ({ x: it.transform[4], y: it.transform[5], str: it.str }))
    .sort((a, b) => b.y - a.y); // Y降順（上から下）

  for (const it of byY) {
    const last = groups[groups.length - 1];
    if (last && Math.abs(last.y - it.y) <= Y_TOLERANCE_PX) {
      last.cells.push({ x: it.x, str: it.str });
    } else {
      groups.push({ y: it.y, cells: [{ x: it.x, str: it.str }] });
    }
  }
  return groups
    .map((g) =>
      g.cells
        .sort((a, b) => a.x - b.x)
        .map((c) => c.str)
        .join(" ")
    )
    .filter((line) => line.trim().length > 0);
}

// ============================================================
// 抽出値の型定義
// ============================================================

export interface ExtractedRawValues {
  /** 期末日（"YYYY/M/D"形式、ゼロパディングなし） */
  periodEnd?: string;
  salesTotal?: number;
  costOfSalesTotal?: number;
  executiveCompensation?: number;
  executiveBonus?: number;
  salaryAllowance?: number;
  miscellaneousSalary?: number;
  bonus?: number;
  retirementBenefits?: number;
  legalWelfare?: number;
  sellingAdminTotal?: number;
  nonOperatingIncome?: number;
  nonOperatingExpense?: number;
  extraordinaryIncome?: number;
  extraordinaryLoss?: number;
  depreciation?: number;
  corporateTaxEtc?: number;
  preTaxIncome?: number;
}

export interface ExtractedPLData {
  raw: ExtractedRawValues;
  warnings: string[];
}

// ============================================================
// 純関数：パース
// ============================================================

/** 全ての空白・縦パイプを除去 */
function normalizeLabel(s: string): string {
  return s.replace(/[\s|]/g, "");
}

/** "△123,456" "(123,456)" "-123,456" 等を整数に変換 */
export function parseJpNumber(raw: string): number | undefined {
  let s = raw.replace(/[\s,，]/g, "");
  let neg = false;
  if (s.startsWith("△") || s.startsWith("▲")) {
    neg = true;
    s = s.slice(1);
  } else if (s.startsWith("-") || s.startsWith("−")) {
    neg = true;
    s = s.slice(1);
  } else if (/^\(.*\)$/.test(s)) {
    neg = true;
    s = s.slice(1, -1);
  }
  if (!/^\d+$/.test(s)) { return undefined; }
  const n = parseInt(s, 10);
  return neg ? -n : n;
}

/** 行から末尾の数値を取り出す。マイナス・カンマ・括弧・△▲対応。 */
function lastNumberOnLine(line: string): number | undefined {
  const re = /[△▲−\-(]?\d{1,3}(?:[,，]\d{3})*\)?|[△▲−\-(]?\d+\)?/g;
  const matches = line.match(re);
  if (!matches) { return undefined; }
  for (let i = matches.length - 1; i >= 0; i--) {
    const v = parseJpNumber(matches[i]);
    if (v !== undefined) { return v; }
  }
  return undefined;
}

/** ラベルマッチング規則 */
interface LabelRule {
  field: keyof ExtractedRawValues;
  test: (normalized: string) => boolean;
  required: boolean;
  label: string; // 警告メッセージ用
}

const RULES: LabelRule[] = [
  { field: "salesTotal",            label: "売上高計",       required: true,  test: (s) => s.includes("売上高計") },
  { field: "costOfSalesTotal",      label: "売上原価計",     required: false, test: (s) => s.includes("売上原価計") || s.includes("当期商品売上原価") },
  { field: "executiveCompensation", label: "役員報酬",       required: false, test: (s) => s.startsWith("役員報酬") },
  { field: "executiveBonus",        label: "役員賞与",       required: false, test: (s) => s.startsWith("役員賞与") },
  { field: "salaryAllowance",       label: "給料手当",       required: false, test: (s) => s.startsWith("給料手当") || s.startsWith("給与手当") },
  { field: "miscellaneousSalary",   label: "雑給",           required: false, test: (s) => s.startsWith("雑給") },
  { field: "bonus",                 label: "賞与",           required: false, test: (s) => s.startsWith("賞与") },
  { field: "retirementBenefits",    label: "退職金",         required: false, test: (s) => s.startsWith("退職金") },
  { field: "legalWelfare",          label: "法定福利費",     required: false, test: (s) => s.startsWith("法定福利費") },
  { field: "sellingAdminTotal",     label: "販売管理費計",   required: true,  test: (s) => s.includes("販売管理費計") || s.includes("販売費及び一般管理費計") || s.includes("販売費一般管理費計") },
  { field: "nonOperatingIncome",    label: "営業外収益計",   required: false, test: (s) => s.includes("営業外収益計") },
  { field: "nonOperatingExpense",   label: "営業外費用計",   required: false, test: (s) => s.includes("営業外費用計") },
  { field: "extraordinaryIncome",   label: "特別利益計",     required: false, test: (s) => s.includes("特別利益計") },
  { field: "extraordinaryLoss",     label: "特別損失計",     required: false, test: (s) => s.includes("特別損失計") },
  { field: "depreciation",          label: "減価償却費",     required: false, test: (s) => s.startsWith("減価償却費") },
  { field: "corporateTaxEtc",       label: "法人税等計",     required: false, test: (s) => s.includes("法人税等計") },
  { field: "preTaxIncome",          label: "税引前当期純利益", required: true, test: (s) => s.includes("税引前当期純利益") || s.includes("税引前当期純損失") },
];

/** 期末日検出 */
function detectPeriodEnd(normalizedLines: string[]): string | undefined {
  const re = /(\d{4})年(\d{1,2})月(\d{1,2})日[〜～~](\d{4})年(\d{1,2})月(\d{1,2})日/;
  for (const ln of normalizedLines) {
    const m = ln.match(re);
    if (m) {
      const y = parseInt(m[4], 10);
      const mo = parseInt(m[5], 10);
      const d = parseInt(m[6], 10);
      return `${y}/${mo}/${d}`;
    }
  }
  return undefined;
}

/**
 * PDF行から数値を抽出する。
 * - 同じ行にラベルと数値が並ぶケース → そのまま採用
 * - ラベルだけの行で数値が次行にあるケース → 次行の数値を採用（経常利益・税引前等で発生）
 */
function findValueForRule(rule: LabelRule, lines: string[]): number | undefined {
  for (let i = 0; i < lines.length; i++) {
    const norm = normalizeLabel(lines[i]);
    if (!rule.test(norm)) { continue; }
    // 同じ行に数値があるか
    const sameLine = lastNumberOnLine(lines[i]);
    if (sameLine !== undefined) { return sameLine; }
    // 次行に数値だけの行があるか（経常利益・税引前のように値が別行にあるケース）
    if (i + 1 < lines.length) {
      const nextNorm = normalizeLabel(lines[i + 1]);
      if (/^[△▲−\-(\d,，)]+$/.test(nextNorm) && nextNorm.length > 0) {
        const nv = parseJpNumber(lines[i + 1].trim());
        if (nv !== undefined) { return nv; }
      }
    }
  }
  return undefined;
}

/**
 * PDFから抽出したテキスト行配列をP/Lデータに変換する純関数。
 */
export function parsePLFromPdfLines(lines: string[]): ExtractedPLData {
  const raw: ExtractedRawValues = {};
  const warnings: string[] = [];

  const normalizedLines = lines.map(normalizeLabel);

  raw.periodEnd = detectPeriodEnd(normalizedLines);
  if (!raw.periodEnd) { warnings.push("会計期間を検出できませんでした"); }

  for (const rule of RULES) {
    const v = findValueForRule(rule, lines);
    if (v !== undefined) {
      raw[rule.field] = v as never;
    } else if (rule.required) {
      warnings.push(`必須項目「${rule.label}」を抽出できませんでした`);
    }
  }

  return { raw, warnings };
}

// ============================================================
// マッピング（Plan B 公式）
// ============================================================

export interface MapDerivation {
  personnelCost: number;
  sellingAdminTotal: number;
  /** 営業外費用 − 営業外収益 */
  nonOpAdjustment: number;
  /** 特別損失 − 特別利益 */
  extraordinaryAdjustment: number;
  sellingAdminOther: number;
  /** 粗利益 − (人件費 + sellingAdminOther) */
  expectedPreTax: number;
}

export interface MapResult {
  input: PLPeriodInput;
  derivation: MapDerivation;
}

const v = (n?: number) => n ?? 0;

/**
 * 抽出値をPLPeriodInputにマッピングする純関数。
 * Plan B 公式: sellingAdminOther に営業外損益・特別損益を畳み込む。
 */
export function mapExtractedToInput(extracted: ExtractedPLData): MapResult {
  const r = extracted.raw;

  const periodLabel = r.periodEnd ?? "";
  const sales = v(r.salesTotal);
  const costOfSales = v(r.costOfSalesTotal);
  const exec = v(r.executiveCompensation);
  const execB = v(r.executiveBonus);
  const sal = v(r.salaryAllowance);
  const misc = v(r.miscellaneousSalary);
  const bon = v(r.bonus);
  const ret = v(r.retirementBenefits);
  const law = v(r.legalWelfare);
  const personnelCost = exec + execB + sal + misc + bon + ret + law;

  const sellingAdminTotal = v(r.sellingAdminTotal);
  const nonOpAdjustment = v(r.nonOperatingExpense) - v(r.nonOperatingIncome);
  const extraordinaryAdjustment = v(r.extraordinaryLoss) - v(r.extraordinaryIncome);
  const sellingAdminOther =
    sellingAdminTotal - personnelCost + nonOpAdjustment + extraordinaryAdjustment;

  const grossProfit = sales - costOfSales;
  const expectedPreTax = grossProfit - (personnelCost + sellingAdminOther);

  const input: PLPeriodInput = {
    ...createEmptyPLPeriod(periodLabel),
    sales,
    costOfSales,
    executiveCompensation: exec,
    executiveBonus: execB,
    salaryAllowance: sal,
    miscellaneousSalary: misc,
    bonus: bon,
    retirementBenefits: ret,
    legalWelfare: law,
    sellingAdminOther,
    preTaxIncomeRef: v(r.preTaxIncome),
    depreciation: v(r.depreciation),
    corporateTaxEtc: v(r.corporateTaxEtc),
    loanRepayment: 0,
  };

  return {
    input,
    derivation: {
      personnelCost,
      sellingAdminTotal,
      nonOpAdjustment,
      extraordinaryAdjustment,
      sellingAdminOther,
      expectedPreTax,
    },
  };
}
