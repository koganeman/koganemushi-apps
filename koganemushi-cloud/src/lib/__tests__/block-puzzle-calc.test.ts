import { describe, it, expect } from "vitest";
import { calcBlockPuzzle, createSamplePLPeriods } from "../block-puzzle-calc";

describe("calcBlockPuzzle", () => {
  it("企画書サンプル(2026/1/31)の数値とブロックパズル画像が一致する", () => {
    const samples = createSamplePLPeriods();
    const period2026 = samples.find((p) => p.periodLabel === "2026/1/31")!;
    const r = calcBlockPuzzle(period2026);

    expect(r.sales).toBe(110_000_000);
    expect(r.variableCost).toBe(53_220_000);
    expect(r.grossProfit).toBe(56_780_000);
    expect(r.personnelCost).toBe(32_100_000); // 11,000 + 17,000 + 4,100 (千円)
    expect(r.otherFixedCost).toBe(21_000_000);
    expect(r.fixedCost).toBe(53_100_000);
    expect(r.preTaxProfit).toBe(3_680_000);
    expect(r.grossProfitRate).toBeCloseTo(0.5162, 3);
    expect(r.laborDistributionRate).toBeCloseTo(0.5654, 3);
  });

  it("2027/1/31の税引前は黒字2,800,000", () => {
    const samples = createSamplePLPeriods();
    const r = calcBlockPuzzle(samples.find((p) => p.periodLabel === "2027/1/31")!);
    expect(r.preTaxProfit).toBe(2_800_000);
  });

  it("2028/1/31は赤字で税引前-1,450,000", () => {
    const samples = createSamplePLPeriods();
    const r = calcBlockPuzzle(samples.find((p) => p.periodLabel === "2028/1/31")!);
    expect(r.preTaxProfit).toBe(-1_450_000);
  });

  it("増加キャッシュ = 税引後利益 + 減価償却費 − 借入金返済", () => {
    const r = calcBlockPuzzle({
      periodLabel: "test",
      sales: 100_000_000,
      costOfSales: 50_000_000,
      personnelInVariableCost: 0,
      executiveCompensation: 10_000_000,
      executiveBonus: 0,
      salaryAllowance: 16_000_000,
      miscellaneousSalary: 0,
      bonus: 0,
      retirementBenefits: 0,
      legalWelfare: 4_000_000,
      sellingAdminOther: 19_500_000,
      preTaxIncomeRef: 0,
      depreciation: 1_000_000,
      corporateTaxEtc: 0,
      loanRepayment: 5_000_000,
    });
    // 税引前 = 100,000 - 50,000 - 30,000 - 19,500 = 500
    // 税引後 = 500 - 0 = 500
    // 増加キャッシュ = 500 + 1,000 - 5,000 = -3,500 (千円)
    expect(r.preTaxProfit).toBe(500_000);
    expect(r.afterTaxProfit).toBe(500_000);
    expect(r.cashIncrease).toBe(-3_500_000);
  });

  it("変動費に含まれる人件費等が変動費から人件費に振り替えられる（粗利益・税引前は不変）", () => {
    const baseInput = {
      periodLabel: "adj",
      sales: 100_000_000,
      costOfSales: 50_000_000,
      personnelInVariableCost: 5_000_000,
      executiveCompensation: 10_000_000,
      executiveBonus: 0,
      salaryAllowance: 16_000_000,
      miscellaneousSalary: 0,
      bonus: 0,
      retirementBenefits: 0,
      legalWelfare: 4_000_000,
      sellingAdminOther: 19_500_000,
      preTaxIncomeRef: 0,
      depreciation: 0,
      corporateTaxEtc: 0,
      loanRepayment: 0,
    };
    const r = calcBlockPuzzle(baseInput);
    // 変動費は調整後 50,000 − 5,000 = 45,000
    expect(r.variableCost).toBe(45_000_000);
    // 人件費は元 30,000 + 調整 5,000 = 35,000
    expect(r.personnelCost).toBe(35_000_000);
    // 粗利益 = 100,000 − 45,000 = 55,000（元 50,000 + 調整 5,000）
    expect(r.grossProfit).toBe(55_000_000);
    // 固定費 = 35,000 + 19,500 = 54,500
    expect(r.fixedCost).toBe(54_500_000);
    // 税引前は調整有無で不変： 55,000 − 54,500 = 500
    expect(r.preTaxProfit).toBe(500_000);

    // 比較：調整なしでも税引前は同じ
    const noAdjust = calcBlockPuzzle({ ...baseInput, personnelInVariableCost: 0 });
    expect(noAdjust.preTaxProfit).toBe(r.preTaxProfit);
  });

  it("売上0でも例外なく0を返す（粗利益率・労働分配率）", () => {
    const r = calcBlockPuzzle({
      periodLabel: "empty",
      sales: 0,
      costOfSales: 0,
      personnelInVariableCost: 0,
      executiveCompensation: 0,
      executiveBonus: 0,
      salaryAllowance: 0,
      miscellaneousSalary: 0,
      bonus: 0,
      retirementBenefits: 0,
      legalWelfare: 0,
      sellingAdminOther: 0,
      preTaxIncomeRef: 0,
      depreciation: 0,
      corporateTaxEtc: 0,
      loanRepayment: 0,
    });
    expect(r.grossProfitRate).toBe(0);
    expect(r.laborDistributionRate).toBe(0);
  });
});
