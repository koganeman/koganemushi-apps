/**
 * 収支整合性リコンサイル。
 * 資金繰り実績表の「期首残高 + 各月収支累計 = 期末残高」が、
 * 元帳の月末残高合計（全台帳・繰越込み）および口座残高一覧表合計と
 * 一致するかを月次で検証する。不一致は収支もれ・二重計上・除外誤りの兆候。
 */
import type { AccountCsvImportResult } from "@/lib/shikin-guri-csv";
import { SUBJECT_BY_ID } from "@/lib/shikin-guri-subjects";
import type { LedgerPipelineResult } from "@/lib/general-ledger-pipeline";
import type { MonthKey } from "@/types/shikin-guri";
import type { ParsedLedger, ReconcileRow } from "@/types/general-ledger";

/** 当月収支（収入科目は加算・支出科目は減算） */
export function monthlyNet(
  result: LedgerPipelineResult,
  month: MonthKey,
): number {
  let net = 0;
  for (const [subjectId, row] of Object.entries(
    result.cashflow.cellsBySubject,
  )) {
    const def = SUBJECT_BY_ID[subjectId];
    if (!def) {
      continue;
    }
    const v = row[month] ?? 0;
    net += def.kind === "income" ? v : -v;
  }
  return net;
}

/** 各台帳の (月 → その月の最終取引後残高)。取引が無い月は欠落 */
function ledgerMonthEnd(
  parsed: ParsedLedger,
): Map<string, Map<MonthKey, number>> {
  const map = new Map<string, Map<MonthKey, number>>();
  for (const t of parsed.txns) {
    let per = map.get(t.accountLedger);
    if (!per) {
      per = new Map();
      map.set(t.accountLedger, per);
    }
    // ファイル順＝時系列順。上書きで月末＝その月最後の残高
    per.set(t.monthKey, t.balance);
  }
  return map;
}

/** 元帳の当月末残高合計（取引の無い台帳は直近の残高を繰り越して合算） */
function ledgerClosingTotals(
  parsed: ParsedLedger,
  months: MonthKey[],
): Map<MonthKey, number> {
  const perLedger = ledgerMonthEnd(parsed);
  const totals = new Map<MonthKey, number>();
  for (const m of months) {
    let sum = 0;
    for (const per of perLedger.values()) {
      // mk<=m の中で最も新しい月の残高を採用（繰り越し）
      let bestKey: MonthKey | null = null;
      let bestVal = 0;
      for (const [mk, bal] of per) {
        if (mk <= m && (bestKey === null || mk > bestKey)) {
          bestKey = mk;
          bestVal = bal;
        }
      }
      if (bestKey !== null) {
        sum += bestVal;
      }
    }
    totals.set(m, sum);
  }
  return totals;
}

function uploadedClosingTotal(
  accountsCsv: AccountCsvImportResult,
  month: MonthKey,
): number | null {
  let sum = 0;
  let any = false;
  for (const a of accountsCsv.accounts) {
    const v = a.balances[month];
    if (v !== undefined) {
      sum += v;
      any = true;
    }
  }
  return any ? sum : null;
}

export function reconcile(
  result: LedgerPipelineResult,
  parsed: ParsedLedger,
  accountsCsv: AccountCsvImportResult | null,
): ReconcileRow[] {
  const ledgerTotals = ledgerClosingTotals(parsed, result.months);
  const rows: ReconcileRow[] = [];
  let prev = result.openingBalanceFirstMonth;

  for (const month of result.months) {
    const net = monthlyNet(result, month);
    const derivedClosing = prev + net;
    const ledgerClosingTotal = ledgerTotals.get(month) ?? 0;
    const uploaded = accountsCsv
      ? uploadedClosingTotal(accountsCsv, month)
      : null;
    rows.push({
      monthKey: month,
      openingOrPrev: prev,
      net,
      derivedClosing,
      ledgerClosingTotal,
      uploadedClosingTotal: uploaded,
      diffLedger: derivedClosing - ledgerClosingTotal,
      diffUploaded: uploaded === null ? null : derivedClosing - uploaded,
    });
    prev = derivedClosing;
  }
  return rows;
}
