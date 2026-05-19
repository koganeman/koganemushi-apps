import { describe, it, expect } from "vitest";
import { eomonth, endOfMonthDay } from "../shikin-guri-months";
import { floorTo, DEFENSE_BAND_LIMIT } from "../tax-forecast-rates";
import {
  calcConsumptionTax,
  calcCorporateIncome,
  calcCorporateTaxAmount,
  calcBusinessTaxAmount,
  calcResidentTaxAmount,
  calcLocalCorporateTaxAmount,
  calcDefenseTaxAmount,
  calcAnnualTaxAmount,
  resolveDefenseMode,
  calcTaxForecast,
  computeTranscriptionCells,
  revertTranscriptionCells,
  type TaxScheduleRow,
} from "../tax-forecast-calc";
import type {
  ConsumptionTaxInput,
  CorporateTaxInput,
  TaxForecastState,
} from "../../types/shikin-guri";

/**
 * ground truth = docs/shikingurihyou/Excel-data/納税予測.xlsx の実値。
 * 年税額 762500 / 3380400 / 3397400、事業税額 269500 / 1227900 / 1233600、
 * 納税予定表 法人税 462500 / 381200 / 2999200 / 1690200 / 1707200 / 1698700。
 * 消費税は税法準拠の「前期概算ベース」配賦（シミュレーションのため確定額を概算で代用）:
 *   確定#0=1200000（概算0 2500000 − 期中納付済 1300000）
 *   中間#0=1250000（前期=概算0 2500000 × 1/2、ctax0=1950000は48万超400万以下＝半期1回）
 *   確定#1=3038000（概算1 4288000 − 中間#0 1250000）
 *   中間#1=2144000（前期=概算1 4288000 × 1/2、ctax1=3344640は半期1回）
 *   確定#2=2244000（概算2 4388000 − 中間#1 2144000）
 *   中間#2(窓外)=2194000（前期=概算2 4388000 × 1/2）
 */

function cons(over: Partial<ConsumptionTaxInput>): ConsumptionTaxInput {
  return {
    preTaxProfit: 0,
    officerCompensation: 0,
    otherSalary: 0,
    legalWelfare: 0,
    depreciation: 0,
    insurance: 0,
    interestPaid: 0,
    otherNonTaxablePurchase: 0,
    interestReceived: 0,
    dividendReceived: 0,
    otherNonTaxableSales: 0,
    prepaidTax: 0,
    ...over,
  };
}

function corp(over: Partial<CorporateTaxInput>): CorporateTaxInput {
  return {
    carryForwardLoss: 0,
    prevBusinessTaxDeduction: 0,
    prevBusinessTaxDeductionManual: false,
    perCapitaLevy: 70000,
    prepaidTax: 0,
    ...over,
  };
}

/** 納税予測.xlsx と同一の入力 */
function excelInput(): TaxForecastState {
  return {
    fiscalPeriod: { closingYear: 2026, closingMonth: 6 },
    consumptionTax: [
      cons({
        preTaxProfit: 3_000_000,
        officerCompensation: 1_000_000,
        otherSalary: 16_000_000,
        legalWelfare: 2_000_000,
        depreciation: 3_000_000,
        prepaidTax: 1_300_000,
      }),
      cons({
        preTaxProfit: 11_000_000,
        officerCompensation: 10_000_000,
        otherSalary: 12_000_000,
        legalWelfare: 1_500_000,
        depreciation: 3_000_000,
        insurance: 1_000_000,
        interestPaid: 5_000_000,
        otherNonTaxablePurchase: 300_000,
        interestReceived: 120_000,
        dividendReceived: 300_000,
        otherNonTaxableSales: 500_000,
      }),
      cons({
        preTaxProfit: 12_000_000,
        officerCompensation: 10_000_000,
        otherSalary: 12_000_000,
        legalWelfare: 1_500_000,
        depreciation: 3_000_000,
        insurance: 1_000_000,
        interestPaid: 5_000_000,
        otherNonTaxablePurchase: 300_000,
        interestReceived: 120_000,
        dividendReceived: 300_000,
        otherNonTaxableSales: 500_000,
      }),
    ],
    corporateTax: [
      corp({ prevBusinessTaxDeduction: 200_000, prepaidTax: 300_000 }),
      corp({}),
      corp({}),
    ],
    defenseTaxMode: "auto",
    withholdingTax: {},
  };
}

describe("floorTo", () => {
  it("100円未満切り捨て", () => {
    expect(floorTo(381250, 100)).toBe(381200);
    expect(floorTo(762580, 100)).toBe(762500);
  });
  it("千円未満切り捨て", () => {
    expect(floorTo(42_880_999, 1000)).toBe(42_880_000);
  });
  it("負数も床方向に切り捨て", () => {
    expect(floorTo(-150, 100)).toBe(-200);
  });
});

describe("eomonth", () => {
  it("末日を返す", () => {
    expect(endOfMonthDay(2026, 6)).toBe(30);
    expect(endOfMonthDay(2028, 2)).toBe(29); // 閏年
    expect(endOfMonthDay(2027, 2)).toBe(28);
  });
  it("決算月+2 = 確定申告期限（2026/6/30 → 2026/8/31）", () => {
    expect(eomonth(2026, 6, 2)).toEqual({ year: 2026, month: 8, day: 31 });
  });
  it("年跨ぎの月送り", () => {
    expect(eomonth(2026, 6, 8)).toEqual({ year: 2027, month: 2, day: 28 });
  });
});

describe("calcConsumptionTax", () => {
  it("消費税対象額は千円未満切り捨て、概算は10%", () => {
    const r = calcConsumptionTax(excelInput().consumptionTax[0]);
    expect(r.base).toBe(25_000_000);
    expect(r.tax).toBe(2_500_000);
  });
  it("控除項目を差し引く（period1 = 42,880,000 → 4,288,000）", () => {
    const r = calcConsumptionTax(excelInput().consumptionTax[1]);
    expect(r.base).toBe(42_880_000);
    expect(r.tax).toBe(4_288_000);
  });
});

describe("法人税・事業税・年税額（階層境界）", () => {
  it("法人所得 = 税引前利益 − 繰越欠損金 − 前期事業税減算", () => {
    expect(calcCorporateIncome(3_000_000, 0, 200_000)).toBe(2_800_000);
  });
  it("法人税額（800万境界）", () => {
    expect(calcCorporateTaxAmount(2_800_000)).toBe(420_000);
    expect(calcCorporateTaxAmount(10_730_500)).toBe(1_833_400);
    expect(calcCorporateTaxAmount(10_772_100)).toBe(1_843_100);
  });
  it("事業税額 = ground truth 269500 / 1227900 / 1233600", () => {
    expect(calcBusinessTaxAmount(2_800_000)).toBe(269_500);
    expect(calcBusinessTaxAmount(10_730_500)).toBe(1_227_900);
    expect(calcBusinessTaxAmount(10_772_100)).toBe(1_233_600);
  });
  it("法人住民税 法人税割 = FLOOR(法人税額 × 0.07, 100)", () => {
    expect(calcResidentTaxAmount(420_000)).toBe(29_400);
    expect(calcResidentTaxAmount(1_833_400)).toBe(128_300); // 128338→100円切捨
    expect(calcResidentTaxAmount(1_843_100)).toBe(129_000); // 129017→100円切捨
  });
  it("地方法人税 = FLOOR(法人税額 × 0.104, 100)", () => {
    expect(calcLocalCorporateTaxAmount(420_000)).toBe(43_600); // 43680→100円切捨
    expect(calcLocalCorporateTaxAmount(1_833_400)).toBe(190_600); // 190673.6→100円切捨
    expect(calcLocalCorporateTaxAmount(6_304_000)).toBe(655_600); // 655616→100円切捨
  });
  it("防衛特別法人税: 適用かつ法人税>500万のみ課税", () => {
    expect(calcDefenseTaxAmount(420_000, true)).toBe(0); // 500万以下
    expect(calcDefenseTaxAmount(1_833_400, true)).toBe(0); // 500万以下
    expect(calcDefenseTaxAmount(6_304_000, true)).toBe(52_100); // (6304000-5000000)*0.04=52160→100円切捨
    expect(calcDefenseTaxAmount(6_304_000, false)).toBe(0); // 非適用期
  });
  it("年税額 防衛なし(現行) = 762500", () => {
    expect(calcAnnualTaxAmount(2_800_000, false)).toBe(762_500);
  });
  it("年税額 防衛あり = 3380400 / 3397400", () => {
    expect(calcAnnualTaxAmount(10_730_500, true)).toBe(3_380_400);
    expect(calcAnnualTaxAmount(10_772_100, true)).toBe(3_397_400);
  });
  it("防衛 r3→r4 境界（所得ベース）", () => {
    expect(DEFENSE_BAND_LIMIT).toBeCloseTo(5_000_000 / 0.232 - 4_000_000, 6);
  });
});

describe("resolveDefenseMode", () => {
  const fp = { closingYear: 2026, closingMonth: 6 };
  it("auto: 事業年度開始 2026/4/1 未満は現行（period0=2025/7開始）", () => {
    expect(resolveDefenseMode("auto", fp, 0)).toBe(false);
  });
  it("auto: 2026/4/1 以降開始は防衛あり（period1=2026/7開始）", () => {
    expect(resolveDefenseMode("auto", fp, 1)).toBe(true);
    expect(resolveDefenseMode("auto", fp, 2)).toBe(true);
  });
  it("on/off で上書き", () => {
    expect(resolveDefenseMode("on", fp, 0)).toBe(true);
    expect(resolveDefenseMode("off", fp, 1)).toBe(false);
  });
});

describe("calcTaxForecast 期別 ground truth", () => {
  const r = calcTaxForecast(excelInput());
  it("年税額 762500 / 3380400 / 3397400", () => {
    expect(r.periods.map((p) => p.annualTaxAmount)).toEqual([
      762_500, 3_380_400, 3_397_400,
    ]);
  });
  it("事業税額 269500 / 1227900 / 1233600", () => {
    expect(r.periods.map((p) => p.businessTaxAmount)).toEqual([
      269_500, 1_227_900, 1_233_600,
    ]);
  });
  it("法人住民税 29400 / 128300 / 129000", () => {
    expect(r.periods.map((p) => p.residentTaxAmount)).toEqual([
      29_400, 128_300, 129_000,
    ]);
  });
  it("地方法人税 43600 / 190600 / 191600", () => {
    // 第3期: 1843100*0.104=191682.4→191600
    expect(r.periods.map((p) => p.localCorporateTaxAmount)).toEqual([
      43_600, 190_600, 191_600,
    ]);
  });
  it("防衛特別法人税: いずれも法人税<500万のため 0", () => {
    expect(r.periods.map((p) => p.defenseTaxAmount)).toEqual([0, 0, 0]);
  });
  it("前期事業税減算の自動連鎖（2期目=1期目事業税, 3期目=2期目事業税）", () => {
    expect(r.periods[1].resolvedPrevBizTaxDeduction).toBe(269_500);
    expect(r.periods[2].resolvedPrevBizTaxDeduction).toBe(1_227_900);
  });
  it("防衛適用: period0=false, period1/2=true", () => {
    expect(r.periods.map((p) => p.defenseApplied)).toEqual([
      false,
      true,
      true,
    ]);
  });
});

describe("納税予定表 ground truth", () => {
  const r = calcTaxForecast(excelInput());
  const byMonth = (m: string) =>
    r.schedule.find((row) => row.month === m) as TaxScheduleRow;

  it("36行・先頭は2026-08（決算+2ヶ月）", () => {
    expect(r.schedule).toHaveLength(36);
    expect(r.schedule[0].month).toBe("2026-08");
  });
  it("確定申告#0 2026-08: 法人税 462500 / 消費税 1200000（第1期概算2500000−期中納付済1300000）", () => {
    const row = byMonth("2026-08");
    expect(row.corporateTaxAmount).toBe(462_500);
    expect(row.consumptionTaxAmount).toBe(1_200_000);
  });
  it("中間#0 2027-02: 法人税 381200 / 消費税 1250000（前期=概算0 2500000×1/2、半期1回）", () => {
    const row = byMonth("2027-02");
    expect(row.corporateTaxAmount).toBe(381_200);
    expect(row.consumptionTaxAmount).toBe(1_250_000);
  });
  it("確定#1 2027-08: 法人税 2999200 / 消費税 3038000（概算1 4288000−中間 1250000）", () => {
    const row = byMonth("2027-08");
    expect(row.corporateTaxAmount).toBe(2_999_200);
    expect(row.consumptionTaxAmount).toBe(3_038_000);
  });
  it("中間#1 2028-02: 法人税 1690200 / 消費税 2144000（前期=概算1 4288000×1/2）", () => {
    const row = byMonth("2028-02");
    expect(row.corporateTaxAmount).toBe(1_690_200);
    expect(row.consumptionTaxAmount).toBe(2_144_000);
  });
  it("確定#2 2028-08: 法人税 1707200 / 消費税 2244000（概算2 4388000−中間 2144000）", () => {
    const row = byMonth("2028-08");
    expect(row.corporateTaxAmount).toBe(1_707_200);
    expect(row.consumptionTaxAmount).toBe(2_244_000);
  });
  it("中間#2 2029-02(窓外): 法人税 1698700 / 消費税 2194000（前期=概算2 4388000×1/2）", () => {
    const row = byMonth("2029-02");
    expect(row.corporateTaxAmount).toBe(1_698_700);
    expect(row.consumptionTaxAmount).toBe(2_194_000);
  });
  it("源泉所得税は毎年 1月末/7月末 が手入力対象", () => {
    const jan = byMonth("2027-01");
    expect(jan.isWithholdingInputRow).toBe(true);
    const aug = byMonth("2026-08");
    expect(aug.isWithholdingInputRow).toBe(false);
  });
  it("源泉所得税の手入力値を反映", () => {
    const input = excelInput();
    input.withholdingTax = { "2027-01": 55_000 };
    const r2 = calcTaxForecast(input);
    expect(
      r2.schedule.find((x) => x.month === "2027-01")?.withholdingTaxAmount
    ).toBe(55_000);
  });
});

describe("computeTranscriptionCells 冪等性", () => {
  const rows: TaxScheduleRow[] = [
    {
      date: { year: 2026, month: 8, day: 31 },
      month: "2026-08",
      kinds: ["kakutei"],
      corporateTaxAmount: 462_500,
      consumptionTaxAmount: 2_988_000,
      withholdingTaxAmount: 0,
      isWithholdingInputRow: false,
    },
  ];

  it("初回転記で houjinzeiTou / shouhizeiSozeiKouka に加算", () => {
    const { cells, nextDeltas } = computeTranscriptionCells({}, {}, rows);
    expect(cells.houjinzeiTou["2026-08"]).toBe(462_500);
    expect(cells.shouhizeiSozeiKouka["2026-08"]).toBe(2_988_000);
    expect(nextDeltas.houjinzeiTou["2026-08"]).toBe(462_500);
  });

  it("同じ行を2回適用しても1回分のみ（二重加算しない）", () => {
    const first = computeTranscriptionCells({}, {}, rows);
    const second = computeTranscriptionCells(
      first.cells,
      first.nextDeltas,
      rows
    );
    expect(second.cells.houjinzeiTou["2026-08"]).toBe(462_500);
    expect(second.cells.shouhizeiSozeiKouka["2026-08"]).toBe(2_988_000);
  });

  it("ユーザー手入力した既存セルを壊さない", () => {
    const base = { houjinzeiTou: { "2026-08": 10_000 } };
    const { cells } = computeTranscriptionCells(base, {}, rows);
    expect(cells.houjinzeiTou["2026-08"]).toBe(10_000 + 462_500);
  });

  it("入力変更で再転記すると差し替えになる", () => {
    const first = computeTranscriptionCells({}, {}, rows);
    const changed: TaxScheduleRow[] = [
      { ...rows[0], corporateTaxAmount: 500_000 },
    ];
    const second = computeTranscriptionCells(
      first.cells,
      first.nextDeltas,
      changed
    );
    expect(second.cells.houjinzeiTou["2026-08"]).toBe(500_000);
  });

  it("前回 X → 今回 0（行が消えた）も引き戻す", () => {
    const first = computeTranscriptionCells({}, {}, rows);
    const second = computeTranscriptionCells(first.cells, first.nextDeltas, []);
    expect(second.cells.houjinzeiTou["2026-08"]).toBe(0);
    expect(Object.keys(second.nextDeltas)).toHaveLength(0);
  });

  it("revert で転記前の値に戻る（他セル非破壊）", () => {
    const base = { houjinzeiTou: { "2026-08": 10_000 } };
    const { cells, nextDeltas } = computeTranscriptionCells(base, {}, rows);
    const reverted = revertTranscriptionCells(cells, nextDeltas);
    expect(reverted.houjinzeiTou["2026-08"]).toBe(10_000);
  });
});
