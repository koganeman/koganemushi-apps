/**
 * 借入金一覧表（資金繰り表202607.xlsx 借入一覧表シート 移植）の純粋計算。
 *
 * Excel `docs/shikingurihyou/Excel-data/資金繰り表202607.xlsx` の 借入一覧表 シート
 * を逐語移植したもの（ground truth）。副作用なし・UI 非依存（CLAUDE.md 設計原則）。
 * 金額は整数（円）、料率は小数。
 */
import type {
  AppliedLoanTranscription,
  LoanForecastState,
  LoanRow,
  LoanType,
  MonthKey,
} from "@/types/shikin-guri";
import { endOfMonthDay, parseMonthKey } from "@/lib/shikin-guri-months";

/** 借入行の最大数（Excel 借入一覧表に合わせる） */
export const LOAN_MAX_ROWS = 20;

/** 1 行 × 1 月の計算結果 */
export interface LoanRowMonthResult {
  /** 当月の新規実行額 */
  newBorrowing: number;
  /** 当月の返済額（元金均等=ユーザー入力、元利均等=月次返済額-利息で算出） */
  repayment: number;
  /** 当月末残高（= 前月末残 + 新規 - 返済） */
  balance: number;
  /** 当月の支払利息（生 float、Excel = 月末残 × 年利率 × 日数 / 365） */
  interest: number;
}

/**
 * 元利均等の月次返済額（元金+利息）。
 *   M = P · r · (1+r)^n / ((1+r)^n - 1)
 * P=元金、r=年利率/12、n=返済期間(月)。いずれか 0/負なら 0。
 */
export function calcEqualInstallmentMonthlyPayment(
  principal: number,
  annualRate: number,
  termMonths: number
): number {
  if (principal <= 0 || annualRate <= 0 || termMonths <= 0) {
    return 0;
  }
  const r = annualRate / 12;
  const pow = Math.pow(1 + r, termMonths);
  return (principal * r * pow) / (pow - 1);
}

/** 1 行分の計算結果 */
export interface LoanRowResult {
  rowId: string;
  loanType: LoanType;
  perMonth: Record<MonthKey, LoanRowMonthResult>;
  /** 期末残高（最終月の月末残） */
  finalBalance: number;
  /** 期間合計の支払利息（float） */
  totalInterest: number;
  /** 期間合計の新規借入額 */
  totalNewBorrowing: number;
  /** 期間合計の返済額 */
  totalRepayment: number;
}

/** 月別合計（短期/長期分割） */
export interface LoanForecastTotal {
  newBorrowingShort: number;
  newBorrowingLong: number;
  repaymentShort: number;
  repaymentLong: number;
  /** 支払利息合計（float） */
  interest: number;
  /** 期末残高合計 */
  balance: number;
}

export interface LoanForecastResult {
  rows: LoanRowResult[];
  totals: Record<MonthKey, LoanForecastTotal>;
}

/** 転記先科目 ID（src/lib/shikin-guri-subjects.ts と整合） */
const SUBJECT_TANKI_KARIIRE = "tankiKariire";
const SUBJECT_CHOUKI_KARIIRE = "choukiKariire";
const SUBJECT_TANKI_HENSAI = "tankiKariireHensai";
const SUBJECT_CHOUKI_HENSAI = "choukiKariireHensai";
const SUBJECT_SHIHARAI_RISOKU = "shiharaiRisokuHoshou";

function emptyTotal(): LoanForecastTotal {
  return {
    newBorrowingShort: 0,
    newBorrowingLong: 0,
    repaymentShort: 0,
    repaymentLong: 0,
    interest: 0,
    balance: 0,
  };
}

/**
 * 借入金一覧表の月次計算。Excel 借入一覧表シートを逐語移植：
 *   balance[m]  = balance[m-1] + newBorrowing[m] − repayment[m]
 *   balance[-1] = openingBalance
 *   interest[m] = balance[m] × annualRate × daysInMonth(m) / 365  （月末残ベース）
 */
export function calcLoanSchedule(
  state: LoanForecastState,
  months: MonthKey[]
): LoanForecastResult {
  const totals: Record<MonthKey, LoanForecastTotal> = {};
  for (const m of months) {
    totals[m] = emptyTotal();
  }

  const rows: LoanRowResult[] = state.rows.map((row) => {
    const perMonth: Record<MonthKey, LoanRowMonthResult> = {};
    let prevBalance = row.openingBalance;
    let totalInterest = 0;
    let totalNewBorrowing = 0;
    let totalRepayment = 0;
    let finalBalance = row.openingBalance;

    const method = row.repaymentMethod ?? "equal-principal";
    const isInstallment = method === "equal-installment";
    let effectiveMonthlyPayment = 0;
    if (isInstallment) {
      if ((row.monthlyPayment ?? 0) > 0) {
        effectiveMonthlyPayment = row.monthlyPayment;
      } else if ((row.amortizationTermMonths ?? 0) > 0) {
        effectiveMonthlyPayment = calcEqualInstallmentMonthlyPayment(
          row.openingBalance,
          row.annualRate,
          row.amortizationTermMonths
        );
      }
    }

    for (const m of months) {
      const nb = row.newBorrowing[m] ?? 0;
      const { year, month } = parseMonthKey(m);
      const days = endOfMonthDay(year, month);
      // 返済額: 元利均等は (override優先) → (月次返済額 - 前月残ベース利息) で算出。
      //        元金均等は常にユーザー入力をそのまま。
      let rp: number;
      const userRepayment = row.repayment[m] ?? 0;
      if (isInstallment && effectiveMonthlyPayment > 0) {
        if (userRepayment > 0) {
          rp = userRepayment;
        } else {
          const interestForPrincipal =
            prevBalance * row.annualRate * days / 365;
          const principal = effectiveMonthlyPayment - interestForPrincipal;
          rp = Math.max(0, Math.min(principal, prevBalance + nb));
        }
      } else {
        rp = userRepayment;
      }
      const balance = prevBalance + nb - rp;
      // 利息: override (> 0) があれば優先、なければ月末残ベースで自動算出
      const calcInterest = balance * row.annualRate * days / 365;
      const userInterest = row.interestOverride?.[m] ?? 0;
      const interest = userInterest > 0 ? userInterest : calcInterest;

      perMonth[m] = { newBorrowing: nb, repayment: rp, balance, interest };

      const t = totals[m];
      if (row.loanType === "short") {
        t.newBorrowingShort += nb;
        t.repaymentShort += rp;
      } else {
        t.newBorrowingLong += nb;
        t.repaymentLong += rp;
      }
      t.interest += interest;
      t.balance += balance;

      totalNewBorrowing += nb;
      totalRepayment += rp;
      totalInterest += interest;
      prevBalance = balance;
      finalBalance = balance;
    }

    return {
      rowId: row.id,
      loanType: row.loanType,
      perMonth,
      finalBalance,
      totalInterest,
      totalNewBorrowing,
      totalRepayment,
    };
  });

  return { rows, totals };
}

type DeltaMap = Record<string, Record<MonthKey, number>>;

/**
 * LoanForecastResult から 資金繰り表 cells への delta マップを生成。
 * 各月の合計を 短期/長期 と 支払利息に分配。支払利息は Math.round で整数化。
 */
export function computeLoanTranscriptionDeltas(
  result: LoanForecastResult
): DeltaMap {
  const deltas: DeltaMap = {};
  const add = (sid: string, m: MonthKey, v: number) => {
    if (!v) {
      return;
    }
    (deltas[sid] ??= {});
    deltas[sid][m] = (deltas[sid][m] ?? 0) + v;
  };
  for (const [m, t] of Object.entries(result.totals)) {
    add(SUBJECT_TANKI_KARIIRE, m, t.newBorrowingShort);
    add(SUBJECT_CHOUKI_KARIIRE, m, t.newBorrowingLong);
    add(SUBJECT_TANKI_HENSAI, m, t.repaymentShort);
    add(SUBJECT_CHOUKI_HENSAI, m, t.repaymentLong);
    add(SUBJECT_SHIHARAI_RISOKU, m, Math.round(t.interest));
  }
  return deltas;
}

/**
 * 借入金一覧表 → 資金繰り cells への冪等加算転記。
 *
 * 新セル = 現セル − 前回delta + 新delta。prev∪next の全 (科目,月) を走査し、
 * 「前回 X → 今回 0」も引き戻す。0 は次回 deltas に残さない。
 * cells はディープコピーして返す（呼び出し側で原子置換）。
 *
 * tax-forecast-calc.ts の computeTranscriptionCells と同等の cells merge ロジック
 * を借入用に再実装。`rows: TaxScheduleRow[]` の代わりに事前計算済み deltas を
 * 受け取るため抽出はしない（CLAUDE.md: 抽象化は 3 回目に再検討）。
 */
export function applyLoanTranscriptionCells(
  cells: Record<string, Record<MonthKey, number>>,
  prevDeltas: DeltaMap,
  nextDeltas: DeltaMap
): Record<string, Record<MonthKey, number>> {
  const out: Record<string, Record<MonthKey, number>> = {};
  for (const [sid, row] of Object.entries(cells)) {
    out[sid] = { ...row };
  }
  const sids = new Set<string>([
    ...Object.keys(prevDeltas),
    ...Object.keys(nextDeltas),
  ]);
  for (const sid of sids) {
    const ms = new Set<MonthKey>([
      ...Object.keys(prevDeltas[sid] ?? {}),
      ...Object.keys(nextDeltas[sid] ?? {}),
    ]);
    for (const m of ms) {
      const cur = out[sid]?.[m] ?? 0;
      const pd = prevDeltas[sid]?.[m] ?? 0;
      const nd = nextDeltas[sid]?.[m] ?? 0;
      const v = cur - pd + nd;
      (out[sid] ??= {});
      out[sid][m] = v;
    }
  }
  return out;
}

/** 転記取消: prev deltas を全セルから引き戻す。 */
export function revertLoanTranscriptionCells(
  cells: Record<string, Record<MonthKey, number>>,
  prevDeltas: DeltaMap
): Record<string, Record<MonthKey, number>> {
  const out: Record<string, Record<MonthKey, number>> = {};
  for (const [sid, row] of Object.entries(cells)) {
    out[sid] = { ...row };
  }
  for (const [sid, row] of Object.entries(prevDeltas)) {
    for (const [m, v] of Object.entries(row)) {
      const cur = out[sid]?.[m] ?? 0;
      (out[sid] ??= {});
      out[sid][m] = cur - v;
    }
  }
  return out;
}

let _idCounter = 0;
function makeLoanId(): string {
  _idCounter += 1;
  return `loan_${Date.now().toString(36)}_${_idCounter.toString(36)}`;
}

export function defaultLoanRow(): LoanRow {
  return {
    id: makeLoanId(),
    lender: "",
    description: "",
    loanType: "long",
    originalAmount: 0,
    openingBalance: 0,
    annualRate: 0,
    repaymentMethod: "equal-principal",
    monthlyPayment: 0,
    amortizationTermMonths: 0,
    newBorrowing: {},
    repayment: {},
    interestOverride: {},
  };
}

export function defaultLoanForecast(): LoanForecastState {
  const rows: LoanRow[] = [];
  for (let i = 0; i < LOAN_MAX_ROWS; i++) {
    rows.push(defaultLoanRow());
  }
  return { rows };
}

export function emptyAppliedLoanTranscription(): AppliedLoanTranscription {
  return { appliedAt: null, deltas: {} };
}
