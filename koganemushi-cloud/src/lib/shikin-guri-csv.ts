import type { MonthKey } from "@/types/shikin-guri";
import { parseJpMonthHeader } from "@/lib/shikin-guri-months";
import { OPENING_BALANCE_LABEL, SUBJECT_BY_LABEL } from "@/lib/shikin-guri-subjects";

/** 簡易 CSV パーサ（RFC4180互換: ダブルクォート対応、CRLF対応） */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const stripBom = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const src = stripBom;
  while (i < src.length) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += c;
      i += 1;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (c === "\r") {
      if (src[i + 1] === "\n") { i += 1; }
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += 1;
      continue;
    }
    if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += 1;
      continue;
    }
    field += c;
    i += 1;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 0 && !(r.length === 1 && r[0] === ""));
}

function parseYenLoose(s: string | undefined): number {
  if (s === undefined) { return 0; }
  const cleaned = s.replace(/,/g, "").replace(/[^\d.\-]/g, "");
  if (cleaned === "" || cleaned === "-") { return 0; }
  const n = parseInt(cleaned, 10);
  return isNaN(n) ? 0 : n;
}

export interface CashflowCsvImportResult {
  /** CSV から読み取れた月キー（順序保持） */
  months: MonthKey[];
  /** subjectId → MonthKey → 金額 */
  cellsBySubject: Record<string, Record<MonthKey, number>>;
  /** 期首残高候補（"期首・期末現預金残高" 行の最初の値）。なければ null */
  openingBalanceCandidate: number | null;
  /** マッチしなかった行ラベル */
  unknownLabels: string[];
  /** マッチしなかった月ヘッダー */
  unknownMonthHeaders: string[];
}

export function importCashflowCsv(text: string): CashflowCsvImportResult {
  const rows = parseCsv(text);
  if (rows.length === 0) {
    return {
      months: [],
      cellsBySubject: {},
      openingBalanceCandidate: null,
      unknownLabels: [],
      unknownMonthHeaders: [],
    };
  }
  const header = rows[0];
  const months: MonthKey[] = [];
  const monthColIndex: number[] = [];
  const unknownMonthHeaders: string[] = [];
  for (let i = 1; i < header.length; i++) {
    const key = parseJpMonthHeader(header[i]);
    if (key) {
      months.push(key);
      monthColIndex.push(i);
    } else if (header[i].trim() !== "") {
      unknownMonthHeaders.push(header[i]);
    }
  }
  const cellsBySubject: Record<string, Record<MonthKey, number>> = {};
  const unknownLabels: string[] = [];
  let openingBalanceCandidate: number | null = null;
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const label = (row[0] ?? "").trim();
    if (!label) { continue; }
    if (label === OPENING_BALANCE_LABEL) {
      const firstColIdx = monthColIndex[0];
      const v = parseYenLoose(row[firstColIdx]);
      if (v !== 0 || (row[firstColIdx] && row[firstColIdx].trim() !== "")) {
        openingBalanceCandidate = v;
      }
      continue;
    }
    const subject = SUBJECT_BY_LABEL[label];
    if (!subject) {
      unknownLabels.push(label);
      continue;
    }
    const map: Record<MonthKey, number> = {};
    for (let i = 0; i < months.length; i++) {
      const colIdx = monthColIndex[i];
      map[months[i]] = parseYenLoose(row[colIdx]);
    }
    cellsBySubject[subject.id] = map;
  }
  return {
    months,
    cellsBySubject,
    openingBalanceCandidate,
    unknownLabels,
    unknownMonthHeaders,
  };
}

export interface AccountCsvImportResult {
  months: MonthKey[];
  accounts: { name: string; balances: Record<MonthKey, number> }[];
  unknownMonthHeaders: string[];
}

export function importAccountsCsv(text: string): AccountCsvImportResult {
  const rows = parseCsv(text);
  if (rows.length === 0) {
    return { months: [], accounts: [], unknownMonthHeaders: [] };
  }
  const header = rows[0];
  // 想定: ["前月末残高", "金融機関名", "YYYY年MM月", ...]
  // 月列は2列目（index 2）以降
  const months: MonthKey[] = [];
  const monthColIndex: number[] = [];
  const unknownMonthHeaders: string[] = [];
  for (let i = 2; i < header.length; i++) {
    const key = parseJpMonthHeader(header[i]);
    if (key) {
      months.push(key);
      monthColIndex.push(i);
    } else if (header[i].trim() !== "") {
      unknownMonthHeaders.push(header[i]);
    }
  }
  const SKIP_NAMES = new Set(["残高合計", "前月増減"]);
  const accounts: { name: string; balances: Record<MonthKey, number> }[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const name = (row[1] ?? "").trim();
    if (!name) { continue; }
    if (SKIP_NAMES.has(name)) { continue; }
    const balances: Record<MonthKey, number> = {};
    for (let i = 0; i < months.length; i++) {
      const colIdx = monthColIndex[i];
      balances[months[i]] = parseYenLoose(row[colIdx]);
    }
    accounts.push({ name, balances });
  }
  return { months, accounts, unknownMonthHeaders };
}
