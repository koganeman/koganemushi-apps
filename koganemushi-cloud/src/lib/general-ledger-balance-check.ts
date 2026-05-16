/**
 * 元帳から算出した各台帳の月末残高と、任意アップロードされた
 * 口座残高一覧表（既存 importAccountsCsv でパース）を突合する。
 */
import type { AccountCsvImportResult } from "@/lib/shikin-guri-csv";
import type { MonthKey } from "@/types/shikin-guri";
import type { BalanceCheckRow, ParsedLedger } from "@/types/general-ledger";

/** 元帳の (台帳 × 月) 月末残高 = その月最後の取引の取引後残高 */
function ledgerMonthEndBalances(
  parsed: ParsedLedger,
): Map<string, Map<MonthKey, number>> {
  const map = new Map<string, Map<MonthKey, number>>();
  for (const t of parsed.txns) {
    let perMonth = map.get(t.accountLedger);
    if (!perMonth) {
      perMonth = new Map();
      map.set(t.accountLedger, perMonth);
    }
    // ファイル順 = 時系列順なので、上書きすれば最後の残高が残る
    perMonth.set(t.monthKey, t.balance);
  }
  return map;
}

function normalizeName(s: string): string {
  return s.replace(/\s+/g, "").toLowerCase();
}

/** 台帳名に最も近い口座残高一覧表の口座を探す（完全一致→部分一致） */
function findUploadedAccount(
  ledgerName: string,
  accounts: AccountCsvImportResult["accounts"],
): AccountCsvImportResult["accounts"][number] | null {
  const ln = normalizeName(ledgerName);
  const exact = accounts.find((a) => normalizeName(a.name) === ln);
  if (exact) {
    return exact;
  }
  const partial = accounts.find((a) => {
    const an = normalizeName(a.name);
    return an !== "" && (ln.includes(an) || an.includes(ln));
  });
  return partial ?? null;
}

export function checkBalances(
  parsed: ParsedLedger,
  accountsCsv: AccountCsvImportResult,
): BalanceCheckRow[] {
  const ledgerBalances = ledgerMonthEndBalances(parsed);
  const rows: BalanceCheckRow[] = [];

  for (const ledgerName of parsed.accountLedgers) {
    const perMonth = ledgerBalances.get(ledgerName);
    if (!perMonth) {
      continue;
    }
    const uploaded = findUploadedAccount(ledgerName, accountsCsv.accounts);
    for (const monthKey of parsed.months) {
      if (!perMonth.has(monthKey)) {
        continue;
      }
      const ledgerBalance = perMonth.get(monthKey)!;
      const uploadedBalance =
        uploaded && uploaded.balances[monthKey] !== undefined
          ? uploaded.balances[monthKey]
          : null;
      const diff =
        uploadedBalance === null ? null : ledgerBalance - uploadedBalance;
      rows.push({
        accountLedger: ledgerName,
        monthKey,
        ledgerBalance,
        uploadedBalance,
        diff,
        matched: diff === 0,
      });
    }
  }
  return rows;
}
