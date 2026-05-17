/**
 * 総勘定元帳CSV → 正規化トランザクション。
 *
 * 列構成・ヘッダー署名は会計ソフトごとに異なるため、general-ledger-profiles
 * のプロファイル層に委譲し、ヘッダー署名で freee / MFクラウド を自動判定する。
 * 資産台帳（現金・各銀行口座）では inflow=入金 / outflow=出金 / balance=取引後残高。
 *
 * 前期繰越行が無い台帳（MF単一口座エクスポート等）は、その台帳の取引日が
 * 最小の行から `残高 −（入金−出金）` で期首残高を逆算する。
 */
import { parseCsv } from "@/lib/shikin-guri-csv";
import {
  OPENING_CARRY_LABEL,
  dateToOrdinal,
  detectProfile,
} from "@/lib/general-ledger-profiles";
import type { MonthKey } from "@/types/shikin-guri";
import type {
  LedgerFormatId,
  OpeningBalance,
  ParsedLedger,
  RawLedgerTxn,
} from "@/types/general-ledger";

export { OPENING_CARRY_LABEL };

function emptyLedger(
  skippedRows: number,
  headerFound: boolean,
  formatId: LedgerFormatId,
  formatName: string | null,
): ParsedLedger {
  return {
    txns: [],
    openingBalances: [],
    months: [],
    accountLedgers: [],
    skippedRows,
    headerFound,
    formatId,
    formatName,
  };
}

/**
 * 繰越行が無い台帳の期首残高を先頭行から逆算する。
 * 実繰越行のある台帳（freee全台帳）はスキップ＝二重計上なし・freee出力不変。
 * 行はファイル順≠日付順のことがあるため取引日最小の行を選ぶ
 * （同日はファイル先頭順）。
 */
function deriveOpeningBalances(
  txns: RawLedgerTxn[],
  openingBalances: OpeningBalance[],
): OpeningBalance[] {
  const carried = new Set(openingBalances.map((o) => o.accountLedger));
  const firstByLedger = new Map<string, { txn: RawLedgerTxn; ord: number }>();
  for (const t of txns) {
    if (t.isOpeningCarry || carried.has(t.accountLedger)) {
      continue;
    }
    const ord = dateToOrdinal(t.date);
    if (ord === null) {
      continue;
    }
    const cur = firstByLedger.get(t.accountLedger);
    if (!cur || ord < cur.ord) {
      firstByLedger.set(t.accountLedger, { txn: t, ord });
    }
  }
  const derived: OpeningBalance[] = [];
  for (const { txn } of firstByLedger.values()) {
    derived.push({
      accountLedger: txn.accountLedger,
      monthKey: txn.monthKey,
      balance: txn.balance - (txn.inflow - txn.outflow),
    });
  }
  return [...openingBalances, ...derived];
}

export function parseGeneralLedger(csvText: string): ParsedLedger {
  const rows = parseCsv(csvText);
  const det = detectProfile(rows);
  if (!det) {
    return emptyLedger(rows.length, false, "unknown", null);
  }
  const { profile, headerIdx } = det;

  const txns: RawLedgerTxn[] = [];
  const openingBalances: OpeningBalance[] = [];
  const monthSet = new Set<MonthKey>();
  const ledgerOrder: string[] = [];
  const seenLedgers = new Set<string>();
  let skippedRows = headerIdx + 1; // タイトル行 + ヘッダー行

  for (let r = headerIdx + 1; r < rows.length; r++) {
    const txn = profile.parseRow(rows[r]);
    if (!txn) {
      skippedRows++;
      continue;
    }
    if (!seenLedgers.has(txn.accountLedger)) {
      seenLedgers.add(txn.accountLedger);
      ledgerOrder.push(txn.accountLedger);
    }
    if (txn.isOpeningCarry) {
      openingBalances.push({
        accountLedger: txn.accountLedger,
        monthKey: txn.monthKey,
        balance: txn.balance,
      });
    } else {
      monthSet.add(txn.monthKey);
    }
    txns.push(txn);
  }

  const finalOpening = profile.deriveOpeningWhenMissing
    ? deriveOpeningBalances(txns, openingBalances)
    : openingBalances;

  return {
    txns,
    openingBalances: finalOpening,
    months: Array.from(monthSet).sort(),
    accountLedgers: ledgerOrder,
    skippedRows,
    headerFound: true,
    formatId: profile.id,
    formatName: profile.name,
  };
}
