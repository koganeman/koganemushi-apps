import type {
  AccountRow,
  CashflowMatrix,
  MonthKey,
  SubjectSection,
  SubjectKind,
} from "@/types/shikin-guri";
import { SUBJECTS } from "@/lib/shikin-guri-subjects";

export const BALANCE_TOLERANCE = 1;

function getCell(matrix: CashflowMatrix, subjectId: string, month: MonthKey): number {
  return matrix.cells[subjectId]?.[month] ?? 0;
}

/** 指定セクション・種別の科目IDを取得 */
export function getSubjectIds(section: SubjectSection, kind: SubjectKind): string[] {
  return SUBJECTS.filter((s) => s.section === section && s.kind === kind).map((s) => s.id);
}

/** 月ごとの (セクション × 種別) 合計 */
export function sumSection(
  matrix: CashflowMatrix,
  months: MonthKey[],
  section: SubjectSection,
  kind: SubjectKind
): Record<MonthKey, number> {
  const ids = getSubjectIds(section, kind);
  const result: Record<MonthKey, number> = {};
  for (const m of months) {
    let total = 0;
    for (const id of ids) {
      total += getCell(matrix, id, m);
    }
    result[m] = total;
  }
  return result;
}

/** 収入 - 支出 */
export function subtractMonthly(
  income: Record<MonthKey, number>,
  expense: Record<MonthKey, number>,
  months: MonthKey[]
): Record<MonthKey, number> {
  const r: Record<MonthKey, number> = {};
  for (const m of months) {
    r[m] = (income[m] ?? 0) - (expense[m] ?? 0);
  }
  return r;
}

/** 3つのセクション収支の和 */
export function sumNetMonthly(
  ...nets: Record<MonthKey, number>[]
): Record<MonthKey, number> {
  const r: Record<MonthKey, number> = {};
  for (const net of nets) {
    for (const [k, v] of Object.entries(net)) {
      r[k] = (r[k] ?? 0) + v;
    }
  }
  return r;
}

export interface CashflowDerived {
  keijouIncome: Record<MonthKey, number>;
  keijouExpense: Record<MonthKey, number>;
  keijouNet: Record<MonthKey, number>;
  keijouGaiIncome: Record<MonthKey, number>;
  keijouGaiExpense: Record<MonthKey, number>;
  keijouGaiNet: Record<MonthKey, number>;
  zaimuIncome: Record<MonthKey, number>;
  zaimuExpense: Record<MonthKey, number>;
  zaimuNet: Record<MonthKey, number>;
  monthlyNet: Record<MonthKey, number>;
  opening: Record<MonthKey, number>;
  closing: Record<MonthKey, number>;
}

/** 資金繰り表の全派生値を一括計算 */
export function deriveCashflow(matrix: CashflowMatrix, months: MonthKey[]): CashflowDerived {
  const keijouIncome = sumSection(matrix, months, "keijou", "income");
  const keijouExpense = sumSection(matrix, months, "keijou", "expense");
  const keijouNet = subtractMonthly(keijouIncome, keijouExpense, months);

  const keijouGaiIncome = sumSection(matrix, months, "keijouGai", "income");
  const keijouGaiExpense = sumSection(matrix, months, "keijouGai", "expense");
  const keijouGaiNet = subtractMonthly(keijouGaiIncome, keijouGaiExpense, months);

  const zaimuIncome = sumSection(matrix, months, "zaimu", "income");
  const zaimuExpense = sumSection(matrix, months, "zaimu", "expense");
  const zaimuNet = subtractMonthly(zaimuIncome, zaimuExpense, months);

  const monthlyNet: Record<MonthKey, number> = {};
  for (const m of months) {
    monthlyNet[m] = (keijouNet[m] ?? 0) + (keijouGaiNet[m] ?? 0) + (zaimuNet[m] ?? 0);
  }

  const opening: Record<MonthKey, number> = {};
  const closing: Record<MonthKey, number> = {};
  let prevClosing = matrix.openingBalance;
  for (let i = 0; i < months.length; i++) {
    const m = months[i];
    const op = i === 0 ? matrix.openingBalance : prevClosing;
    opening[m] = op;
    const cl = op + (monthlyNet[m] ?? 0);
    closing[m] = cl;
    prevClosing = cl;
  }

  return {
    keijouIncome,
    keijouExpense,
    keijouNet,
    keijouGaiIncome,
    keijouGaiExpense,
    keijouGaiNet,
    zaimuIncome,
    zaimuExpense,
    zaimuNet,
    monthlyNet,
    opening,
    closing,
  };
}

export interface AccountDerived {
  total: Record<MonthKey, number>;
  /** その月に1口座でも残高入力がある */
  hasData: Record<MonthKey, boolean>;
  /** 前月との差 */
  momDelta: Record<MonthKey, number>;
}

export function deriveAccounts(accounts: AccountRow[], months: MonthKey[]): AccountDerived {
  const total: Record<MonthKey, number> = {};
  const hasData: Record<MonthKey, boolean> = {};
  const momDelta: Record<MonthKey, number> = {};
  for (const m of months) {
    let sum = 0;
    let any = false;
    for (const acc of accounts) {
      if (acc.balances[m] !== undefined) {
        sum += acc.balances[m];
        any = true;
      }
    }
    total[m] = sum;
    hasData[m] = any;
  }
  for (let i = 0; i < months.length; i++) {
    const m = months[i];
    const prev = i === 0 ? 0 : total[months[i - 1]] ?? 0;
    momDelta[m] = (total[m] ?? 0) - prev;
  }
  return { total, hasData, momDelta };
}

export interface ConsistencyIssue {
  month: MonthKey;
  closing: number;
  accountTotal: number;
  diff: number;
}

/** 期末現預金残高と口座残高合計の不一致月を返す */
export function checkConsistency(
  derived: CashflowDerived,
  accounts: AccountDerived,
  months: MonthKey[],
  tolerance: number = BALANCE_TOLERANCE
): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];
  for (const m of months) {
    if (!accounts.hasData[m]) { continue; }
    const closing = derived.closing[m] ?? 0;
    const total = accounts.total[m] ?? 0;
    const diff = closing - total;
    if (Math.abs(diff) > tolerance) {
      issues.push({ month: m, closing, accountTotal: total, diff });
    }
  }
  return issues;
}

/** 月が予測月（current より後）か */
export function isForecastMonth(month: MonthKey, currentMonth: MonthKey): boolean {
  return month > currentMonth;
}
