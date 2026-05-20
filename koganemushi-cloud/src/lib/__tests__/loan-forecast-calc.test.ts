import { describe, it, expect } from "vitest";
import {
  applyLoanTranscriptionCells,
  calcLoanSchedule,
  computeLoanTranscriptionDeltas,
  defaultLoanForecast,
  defaultLoanRow,
  emptyAppliedLoanTranscription,
  LOAN_MAX_ROWS,
  revertLoanTranscriptionCells,
} from "../loan-forecast-calc";
import type { LoanForecastState, LoanRow, MonthKey } from "../../types/shikin-guri";
import { enumerateMonths } from "../shikin-guri-months";

/**
 * Ground truth = docs/shikingurihyou/Excel-data/資金繰り表.xlsm 借入一覧表シート。
 * Excel 数式の逐語移植であり、空テンプレなので具体数値の突合ではなく
 * 数式構造（残高漸化式・月末残ベース利息・5科目振り分け）の再現性を検証する。
 *
 *  Excel 残高セクション (R27, 列 E〜AC):
 *    E27 = E4                       (期首残高 = 入力値)
 *    F27 = E27 - F4                 (前月末残 − 当月返済額; 返済額にはマイナスで新規借入を入力)
 *    G27 = F27 - G4                 (以下同パターン)
 *
 *  Excel 利息セクション (R51, 列 F〜AC):
 *    F51 = F27 * D51 * F$50 / 365   (月末残 × 年利率 × DAY(EOMONTH(月)) / 365)
 *
 *  本実装では Excel の「返済額にマイナスで新規借入」を newBorrowing / repayment に分離するが、
 *  balance[m] = balance[m-1] + newBorrowing[m] - repayment[m] と等価。
 */

function buildRow(over: Partial<LoanRow>): LoanRow {
  return { ...defaultLoanRow(), ...over };
}

function buildState(rows: LoanRow[]): LoanForecastState {
  // LOAN_MAX_ROWS に満たない分は空行で埋める（store と同じ前提）
  const padded = [...rows];
  while (padded.length < LOAN_MAX_ROWS) {
    padded.push(defaultLoanRow());
  }
  return { rows: padded };
}

const START: MonthKey = "2025-07";
const MONTHS = enumerateMonths(START, 36);

describe("calcLoanSchedule", () => {
  it("残高漸化式: balance[m] = balance[m-1] + newBorrowing[m] - repayment[m]", () => {
    const row = buildRow({
      openingBalance: 8_000_000,
      annualRate: 0.017,
      loanType: "long",
      repayment: { "2025-07": 100_000, "2025-08": 100_000, "2025-09": 100_000 },
    });
    const result = calcLoanSchedule(buildState([row]), MONTHS);
    const per = result.rows[0].perMonth;
    expect(per["2025-07"].balance).toBe(7_900_000);
    expect(per["2025-08"].balance).toBe(7_800_000);
    expect(per["2025-09"].balance).toBe(7_700_000);
  });

  it("新規借入と返済が同月に併存できる: balance[m] += nb[m] - rp[m]", () => {
    const row = buildRow({
      openingBalance: 1_000_000,
      newBorrowing: { "2025-07": 500_000 },
      repayment: { "2025-07": 200_000 },
    });
    const per = calcLoanSchedule(buildState([row]), MONTHS).rows[0].perMonth;
    expect(per["2025-07"].balance).toBe(1_300_000);
  });

  it("月末残ベース利息: balance × annualRate × daysInMonth / 365 (Excel F51 と同形式)", () => {
    const row = buildRow({
      openingBalance: 10_000_000,
      annualRate: 0.017,
      // 7月(31日): 残高そのまま 10,000,000
    });
    const per = calcLoanSchedule(buildState([row]), MONTHS).rows[0].perMonth;
    // 7月末残 = 10,000,000 × 0.017 × 31 / 365
    expect(per["2025-07"].interest).toBeCloseTo(10_000_000 * 0.017 * 31 / 365, 6);
  });

  it("2月は28日（平年）/29日（閏年）で利息日割される", () => {
    const row = buildRow({ openingBalance: 12_000_000, annualRate: 0.018 });
    const r = calcLoanSchedule(buildState([row]), MONTHS).rows[0].perMonth;
    // 2026-02 は平年 (28日), 2028-02 は閏年 (29日) ※ 36ヶ月窓内には 2026-02 のみ
    expect(r["2026-02"].interest).toBeCloseTo(12_000_000 * 0.018 * 28 / 365, 6);
    // 4月は30日
    expect(r["2026-04"].interest).toBeCloseTo(12_000_000 * 0.018 * 30 / 365, 6);
  });

  it("openingBalance がゼロでも新規借入で残高が立ち上がる", () => {
    const row = buildRow({
      openingBalance: 0,
      newBorrowing: { "2025-07": 5_000_000 },
    });
    const per = calcLoanSchedule(buildState([row]), MONTHS).rows[0].perMonth;
    expect(per["2025-07"].balance).toBe(5_000_000);
  });

  it("短期と長期の totals 分割: loanType によって newBorrowingShort/Long と repaymentShort/Long に振り分け", () => {
    const shortRow = buildRow({
      loanType: "short",
      openingBalance: 1_000_000,
      newBorrowing: { "2025-07": 500_000 },
      repayment: { "2025-08": 300_000 },
    });
    const longRow = buildRow({
      loanType: "long",
      openingBalance: 5_000_000,
      newBorrowing: { "2025-07": 2_000_000 },
      repayment: { "2025-08": 100_000 },
    });
    const result = calcLoanSchedule(buildState([shortRow, longRow]), MONTHS);
    expect(result.totals["2025-07"].newBorrowingShort).toBe(500_000);
    expect(result.totals["2025-07"].newBorrowingLong).toBe(2_000_000);
    expect(result.totals["2025-07"].repaymentShort).toBe(0);
    expect(result.totals["2025-07"].repaymentLong).toBe(0);
    expect(result.totals["2025-08"].repaymentShort).toBe(300_000);
    expect(result.totals["2025-08"].repaymentLong).toBe(100_000);
  });

  it("totals.balance は全行の月末残合計", () => {
    const rows = [
      buildRow({ openingBalance: 1_000_000 }),
      buildRow({ openingBalance: 2_000_000 }),
    ];
    const totals = calcLoanSchedule(buildState(rows), MONTHS).totals;
    expect(totals["2025-07"].balance).toBe(3_000_000);
  });

  it("finalBalance と期間合計が正しく集約される", () => {
    const row = buildRow({
      openingBalance: 5_000_000,
      annualRate: 0.012,
      newBorrowing: { "2025-07": 1_000_000 },
      repayment: { "2025-08": 100_000, "2025-09": 100_000 },
    });
    const r = calcLoanSchedule(buildState([row]), MONTHS).rows[0];
    expect(r.totalNewBorrowing).toBe(1_000_000);
    expect(r.totalRepayment).toBe(200_000);
    // finalBalance = 最終月（窓内最後）の残高
    expect(r.finalBalance).toBe(5_000_000 + 1_000_000 - 200_000);
  });
});

describe("computeLoanTranscriptionDeltas", () => {
  it("利息は Math.round で整数化される（円未満を切り捨てるのは表示時のみ）", () => {
    const row = buildRow({ openingBalance: 10_000_000, annualRate: 0.017, loanType: "long" });
    const result = calcLoanSchedule(buildState([row]), MONTHS);
    const deltas = computeLoanTranscriptionDeltas(result);
    const raw = 10_000_000 * 0.017 * 31 / 365;
    expect(deltas["shiharaiRisokuHoshou"]["2025-07"]).toBe(Math.round(raw));
  });

  it("値 0 の科目・月は deltas に含まれない（科目キーごと現れない）", () => {
    const row = buildRow({ openingBalance: 0, annualRate: 0 });
    const deltas = computeLoanTranscriptionDeltas(
      calcLoanSchedule(buildState([row]), MONTHS)
    );
    // 全て 0 → deltas は空オブジェクト
    expect(Object.keys(deltas)).toEqual([]);
  });

  it("短期は tankiKariire / tankiKariireHensai に振り分けられる", () => {
    const row = buildRow({
      loanType: "short",
      openingBalance: 1_000_000,
      newBorrowing: { "2025-08": 500_000 },
      repayment: { "2025-09": 200_000 },
    });
    const deltas = computeLoanTranscriptionDeltas(
      calcLoanSchedule(buildState([row]), MONTHS)
    );
    expect(deltas["tankiKariire"]?.["2025-08"]).toBe(500_000);
    expect(deltas["tankiKariireHensai"]?.["2025-09"]).toBe(200_000);
    expect(deltas["choukiKariire"]).toBeUndefined();
    expect(deltas["choukiKariireHensai"]).toBeUndefined();
  });

  it("長期は choukiKariire / choukiKariireHensai に振り分けられる", () => {
    const row = buildRow({
      loanType: "long",
      openingBalance: 5_000_000,
      newBorrowing: { "2025-08": 2_000_000 },
      repayment: { "2025-09": 100_000 },
    });
    const deltas = computeLoanTranscriptionDeltas(
      calcLoanSchedule(buildState([row]), MONTHS)
    );
    expect(deltas["choukiKariire"]?.["2025-08"]).toBe(2_000_000);
    expect(deltas["choukiKariireHensai"]?.["2025-09"]).toBe(100_000);
    expect(deltas["tankiKariire"]).toBeUndefined();
    expect(deltas["tankiKariireHensai"]).toBeUndefined();
  });
});

describe("applyLoanTranscriptionCells (冪等性)", () => {
  function makeDeltas(): Record<string, Record<MonthKey, number>> {
    return {
      choukiKariire: { "2025-07": 1_000_000 },
      choukiKariireHensai: { "2025-08": 100_000 },
      shiharaiRisokuHoshou: { "2025-07": 14_000 },
    };
  }

  it("初回転記で各科目セルに加算される", () => {
    const cells = applyLoanTranscriptionCells({}, {}, makeDeltas());
    expect(cells["choukiKariire"]["2025-07"]).toBe(1_000_000);
    expect(cells["choukiKariireHensai"]["2025-08"]).toBe(100_000);
    expect(cells["shiharaiRisokuHoshou"]["2025-07"]).toBe(14_000);
  });

  it("同じ deltas を二回適用しても結果は一回適用と同じ（差し替えになる）", () => {
    const first = applyLoanTranscriptionCells({}, {}, makeDeltas());
    const second = applyLoanTranscriptionCells(first, makeDeltas(), makeDeltas());
    expect(second).toEqual(first);
  });

  it("既存ユーザー手入力セルを破壊せず加算する（同月に手入力 + 転記）", () => {
    const userCells = { choukiKariire: { "2025-07": 500_000 } };
    const cells = applyLoanTranscriptionCells(userCells, {}, makeDeltas());
    expect(cells["choukiKariire"]["2025-07"]).toBe(500_000 + 1_000_000);
  });

  it("入力変更で再転記すると差し替えになる（前回 delta を引き戻して新 delta を加算）", () => {
    const prev = makeDeltas();
    const first = applyLoanTranscriptionCells({}, {}, prev);
    const next = {
      choukiKariire: { "2025-07": 3_000_000 },  // 入力変更
      choukiKariireHensai: { "2025-08": 200_000 },
      shiharaiRisokuHoshou: { "2025-07": 28_000 },
    };
    const second = applyLoanTranscriptionCells(first, prev, next);
    expect(second["choukiKariire"]["2025-07"]).toBe(3_000_000);
    expect(second["choukiKariireHensai"]["2025-08"]).toBe(200_000);
    expect(second["shiharaiRisokuHoshou"]["2025-07"]).toBe(28_000);
  });

  it("前回 X → 今回 0 (科目消滅) も引き戻す", () => {
    const prev = makeDeltas();
    const first = applyLoanTranscriptionCells({}, {}, prev);
    const second = applyLoanTranscriptionCells(first, prev, {});
    expect(second["choukiKariire"]["2025-07"]).toBe(0);
    expect(second["choukiKariireHensai"]["2025-08"]).toBe(0);
    expect(second["shiharaiRisokuHoshou"]["2025-07"]).toBe(0);
  });

  it("元の cells を mutate しない（ディープコピー返却）", () => {
    const userCells = { choukiKariire: { "2025-07": 500_000 } };
    applyLoanTranscriptionCells(userCells, {}, makeDeltas());
    expect(userCells.choukiKariire["2025-07"]).toBe(500_000);
  });
});

describe("revertLoanTranscriptionCells", () => {
  it("転記前の値に戻る", () => {
    const userCells = { choukiKariire: { "2025-07": 500_000 } };
    const deltas = { choukiKariire: { "2025-07": 1_000_000 as number } };
    const applied = applyLoanTranscriptionCells(userCells, {}, deltas);
    const reverted = revertLoanTranscriptionCells(applied, deltas);
    expect(reverted["choukiKariire"]["2025-07"]).toBe(500_000);
  });

  it("空 deltas を渡せばノーオペ", () => {
    const cells = { choukiKariire: { "2025-07": 500_000 } };
    const reverted = revertLoanTranscriptionCells(cells, {});
    expect(reverted["choukiKariire"]["2025-07"]).toBe(500_000);
  });
});

describe("defaultLoanForecast", () => {
  it("20 行ぴったり生成される (Excel 借入一覧表シートの行数と一致)", () => {
    const state = defaultLoanForecast();
    expect(state.rows.length).toBe(LOAN_MAX_ROWS);
    expect(LOAN_MAX_ROWS).toBe(20);
  });

  it("各行は long 種別・金額0で初期化され、id は一意", () => {
    const state = defaultLoanForecast();
    const ids = new Set<string>();
    for (const r of state.rows) {
      expect(r.loanType).toBe("long");
      expect(r.lender).toBe("");
      expect(r.description).toBe("");
      expect(r.originalAmount).toBe(0);
      expect(r.openingBalance).toBe(0);
      expect(r.annualRate).toBe(0);
      expect(r.newBorrowing).toEqual({});
      expect(r.repayment).toEqual({});
      ids.add(r.id);
    }
    expect(ids.size).toBe(LOAN_MAX_ROWS);
  });

  it("emptyAppliedLoanTranscription は appliedAt=null / deltas={}", () => {
    const applied = emptyAppliedLoanTranscription();
    expect(applied.appliedAt).toBeNull();
    expect(applied.deltas).toEqual({});
  });
});
