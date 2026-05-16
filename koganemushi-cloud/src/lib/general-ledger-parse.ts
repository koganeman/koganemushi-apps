/**
 * 総勘定元帳CSV → 正規化トランザクション。
 *
 * 元帳の列構成（23列・ヘッダー行は1列目が "勘定科目"）:
 *   0 勘定科目 / 1 取引日 / 2 決算整理仕訳 / 3 相手勘定科目 / 4 税区分 /
 *   5 取引先 / 6 品目 / 7 部門 / 8 管理番号 / 9 メモタグ / 10 備考 /
 *   11 勘定科目コード / 12 相手取引先 / 13 相手品目 / 14 相手部門 /
 *   15 相手メモタグ / 16 相手備考 / 17 相手勘定科目コード / 18 取引内容 /
 *   19 発行元 / 20 借方金額 / 21 貸方金額 / 22 残高
 *
 * 資産台帳（現金・各銀行口座）では 借方=入金 / 貸方=出金 / 残高=取引後残高。
 */
import { parseCsv } from "@/lib/shikin-guri-csv";
import { monthKey } from "@/lib/shikin-guri-months";
import type { MonthKey } from "@/types/shikin-guri";
import type {
  OpeningBalance,
  ParsedLedger,
  RawLedgerTxn,
} from "@/types/general-ledger";

export const OPENING_CARRY_LABEL = "前期繰越";

const COL = {
  accountLedger: 0,
  date: 1,
  counterpartyAccount: 3,
  torihikisaki: 5,
  description: 18,
  hakkomoto: 19,
  inflow: 20,
  outflow: 21,
  balance: 22,
} as const;

const MIN_COLS = 23;

function parseAmount(s: string | undefined): number {
  if (s === undefined) {
    return 0;
  }
  const cleaned = s.replace(/,/g, "").replace(/[^\d.\-]/g, "");
  if (cleaned === "" || cleaned === "-") {
    return 0;
  }
  const n = parseInt(cleaned, 10);
  return isNaN(n) ? 0 : n;
}

/**
 * "YYYY/M/D" / "YYYY-MM-DD" / "YYYY.M.D" → MonthKey。解釈不能なら null。
 * 区切りは / - . のいずれも許容（会計ソフトによりスラッシュ/ハイフン差あり）。
 */
function dateToMonthKey(s: string): MonthKey | null {
  const m = /^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})$/.exec(s.trim());
  if (!m) {
    return null;
  }
  return monthKey(parseInt(m[1], 10), parseInt(m[2], 10));
}

function pickDescription(row: string[], counterpartyAccount: string): string {
  const candidates = [
    row[COL.description],
    row[COL.torihikisaki],
    row[COL.hakkomoto],
  ];
  for (const c of candidates) {
    const v = (c ?? "").trim();
    if (v !== "") {
      return v;
    }
  }
  return counterpartyAccount;
}

function findHeaderIndex(rows: string[][]): number {
  for (let i = 0; i < rows.length; i++) {
    if ((rows[i][0] ?? "").trim() === "勘定科目") {
      return i;
    }
  }
  return -1;
}

function rowToTxn(
  row: string[],
  accountLedger: string,
  date: string,
  mk: MonthKey,
): RawLedgerTxn {
  const counterpartyAccount = (row[COL.counterpartyAccount] ?? "").trim();
  return {
    accountLedger,
    date,
    monthKey: mk,
    counterpartyAccount,
    description: pickDescription(row, counterpartyAccount),
    inflow: parseAmount(row[COL.inflow]),
    outflow: parseAmount(row[COL.outflow]),
    balance: parseAmount(row[COL.balance]),
    isOpeningCarry: counterpartyAccount === OPENING_CARRY_LABEL,
  };
}

interface RowEssentials {
  accountLedger: string;
  date: string;
  mk: MonthKey;
}

/** データ行として有効なら必須項目を返す。無効なら null */
function rowEssentials(row: string[]): RowEssentials | null {
  if (row.length < MIN_COLS) {
    return null;
  }
  const accountLedger = (row[COL.accountLedger] ?? "").trim();
  const date = (row[COL.date] ?? "").trim();
  const mk = dateToMonthKey(date);
  if (!accountLedger || !mk) {
    return null;
  }
  return { accountLedger, date, mk };
}

function emptyLedger(
  skippedRows: number,
  headerFound: boolean,
): ParsedLedger {
  return {
    txns: [],
    openingBalances: [],
    months: [],
    accountLedgers: [],
    skippedRows,
    headerFound,
  };
}

export function parseGeneralLedger(csvText: string): ParsedLedger {
  const rows = parseCsv(csvText);
  const headerIdx = findHeaderIndex(rows);
  if (headerIdx < 0) {
    return emptyLedger(rows.length, false);
  }

  const txns: RawLedgerTxn[] = [];
  const openingBalances: OpeningBalance[] = [];
  const monthSet = new Set<MonthKey>();
  const ledgerOrder: string[] = [];
  const seenLedgers = new Set<string>();
  let skippedRows = headerIdx + 1; // タイトル行 + ヘッダー行

  for (let r = headerIdx + 1; r < rows.length; r++) {
    const ess = rowEssentials(rows[r]);
    if (!ess) {
      skippedRows++;
      continue;
    }
    const { accountLedger, date, mk } = ess;
    if (!seenLedgers.has(accountLedger)) {
      seenLedgers.add(accountLedger);
      ledgerOrder.push(accountLedger);
    }
    const txn = rowToTxn(rows[r], accountLedger, date, mk);
    if (txn.isOpeningCarry) {
      openingBalances.push({ accountLedger, monthKey: mk, balance: txn.balance });
    } else {
      monthSet.add(mk);
    }
    txns.push(txn);
  }

  return {
    txns,
    openingBalances,
    months: Array.from(monthSet).sort(),
    accountLedgers: ledgerOrder,
    skippedRows,
    headerFound: true,
  };
}
