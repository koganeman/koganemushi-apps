import { describe, it, expect } from "vitest";
import {
  salaryIncomeDeduction,
  salaryIncomeDeductionChildcare,
  calcIncomeTaxBase,
  calcIncomeTax,
  calcBasicDeduction,
  calcDividendCreditIncomeTax,
  calcDividendCreditResidentTax,
  calcHealthInsuranceMonthly,
  calcPensionInsuranceMonthly,
  calcBonusHealthInsurance,
  calcBonusPensionInsurance,
  calcChildcareContribution,
  calcCorporateTax,
  calcExecutive,
} from "../calc-engine";
import type { RateSettings, ExecutiveInput, EffectiveTaxRates } from "@/types/simulation";
import { DEFAULT_EFFECTIVE_TAX_RATES } from "../tax-tables";

const defaultRates: RateSettings = {
  healthInsuranceRate: 0.0991,
  nursingCareRate: 0.0159,
  pensionRate: 0.183,
  childcareContributionRate: 0.0036,
  healthBonusAnnualCap: 5730000,
  pensionBonusPerPaymentCap: 1500000,
};

// ============================================================
// 給与所得控除 (KoujyogoTS)
// ============================================================
describe("salaryIncomeDeduction (KoujyogoTS)", () => {
  it("65万未満は0", () => {
    expect(salaryIncomeDeduction(640000)).toBe(0);
  });

  it("65万ちょうどは0", () => {
    expect(salaryIncomeDeduction(650000)).toBe(0);
  });

  it("190万以下: 収入-65万", () => {
    expect(salaryIncomeDeduction(1900000)).toBe(1250000);
  });

  it("360万未満: 収入×0.7-8万", () => {
    expect(salaryIncomeDeduction(3000000)).toBe(3000000 * 0.7 - 80000);
  });

  it("660万未満: 収入×0.8-44万", () => {
    expect(salaryIncomeDeduction(5000000)).toBe(5000000 * 0.8 - 440000);
  });

  it("850万未満: 収入×0.9-110万", () => {
    expect(salaryIncomeDeduction(8000000)).toBe(8000000 * 0.9 - 1100000);
  });

  it("850万以上: 収入-195万", () => {
    expect(salaryIncomeDeduction(10000000)).toBe(10000000 - 1950000);
  });

  it("1000万: 収入-195万", () => {
    expect(salaryIncomeDeduction(10000000)).toBe(8050000);
  });
});

// ============================================================
// 給与所得控除 子育て介護 (Koujyogo_ch)
// ============================================================
describe("salaryIncomeDeductionChildcare (Koujyogo_ch)", () => {
  it("850万未満は通常と同じ", () => {
    expect(salaryIncomeDeductionChildcare(8000000)).toBe(
      salaryIncomeDeduction(8000000)
    );
  });

  it("850万〜1000万未満: 収入×0.9-110万（通常は収入-195万になるところ）", () => {
    expect(salaryIncomeDeductionChildcare(9000000)).toBe(
      9000000 * 0.9 - 1100000
    );
  });

  it("1000万以上: 収入-210万", () => {
    expect(salaryIncomeDeductionChildcare(10000000)).toBe(
      10000000 - 2100000
    );
  });

  it("1200万: 収入-210万", () => {
    expect(salaryIncomeDeductionChildcare(12000000)).toBe(9900000);
  });
});

// ============================================================
// 所得税 (incometaxTS)
// ============================================================
describe("calcIncomeTaxBase (incometaxTS)", () => {
  it("195万以下: 5%", () => {
    expect(calcIncomeTaxBase(1950000)).toBe(1950000 * 0.05);
  });

  it("330万: 10%-97,500", () => {
    expect(calcIncomeTaxBase(3300000)).toBe(3300000 * 0.1 - 97500);
  });

  it("695万: 20%-427,500", () => {
    expect(calcIncomeTaxBase(6950000)).toBe(6950000 * 0.2 - 427500);
  });

  it("900万: 23%-636,000", () => {
    expect(calcIncomeTaxBase(9000000)).toBe(9000000 * 0.23 - 636000);
  });

  it("1800万: 33%-1,536,000", () => {
    expect(calcIncomeTaxBase(18000000)).toBe(18000000 * 0.33 - 1536000);
  });

  it("4000万: 40%-2,796,000", () => {
    expect(calcIncomeTaxBase(40000000)).toBe(40000000 * 0.4 - 2796000);
  });

  it("5000万: 45%-4,796,000", () => {
    expect(calcIncomeTaxBase(50000000)).toBe(50000000 * 0.45 - 4796000);
  });
});

describe("calcIncomeTax (復興特別所得税込み)", () => {
  it("所得税 × 1.021", () => {
    const base = calcIncomeTaxBase(5000000);
    expect(calcIncomeTax(5000000)).toBeCloseTo(base * 1.021, 0);
  });
});

// ============================================================
// 基礎控除
// ============================================================
describe("calcBasicDeduction", () => {
  it("所得0円: 95万", () => {
    expect(calcBasicDeduction(0)).toBe(950000);
  });

  it("所得132万: 95万", () => {
    expect(calcBasicDeduction(1320000)).toBe(950000);
  });

  it("所得132万1円: 88万", () => {
    expect(calcBasicDeduction(1320001)).toBe(880000);
  });

  it("所得2350万: 58万", () => {
    expect(calcBasicDeduction(23500000)).toBe(580000);
  });

  it("所得2350万1円: 58万", () => {
    expect(calcBasicDeduction(23500001)).toBe(580000);
  });

  it("所得2500万1円: 0", () => {
    expect(calcBasicDeduction(25000001)).toBe(0);
  });
});

// ============================================================
// 配当控除（所得税）
// ============================================================
describe("calcDividendCreditIncomeTax", () => {
  it("課税所得+配当が1000万以下: 配当×10%", () => {
    expect(calcDividendCreditIncomeTax(5000000, 1000000)).toBe(100000);
  });

  it("課税所得-配当が1000万以上: 配当×5%", () => {
    expect(calcDividendCreditIncomeTax(15000000, 1000000)).toBe(50000);
  });

  it("境界をまたぐケース", () => {
    // 前所得=900万、配当=200万 → 1000万以下部分100万×10% + 超部分100万×5%
    const result = calcDividendCreditIncomeTax(11000000, 2000000);
    expect(result).toBeCloseTo(1000000 * 0.1 + 1000000 * 0.05, 0);
  });
});

// ============================================================
// 配当控除（住民税）
// ============================================================
describe("calcDividendCreditResidentTax", () => {
  it("1000万以下: 配当×2.8%", () => {
    expect(calcDividendCreditResidentTax(5000000, 1000000)).toBe(28000);
  });

  it("1000万超: 配当×1.4%", () => {
    expect(calcDividendCreditResidentTax(15000000, 1000000)).toBe(14000);
  });
});

// ============================================================
// 健康保険料（月額）
// ============================================================
describe("calcHealthInsuranceMonthly", () => {
  it("月額0以下は0", () => {
    expect(calcHealthInsuranceMonthly(0, 42, defaultRates)).toBe(0);
  });

  it("月額50万（40〜64歳）: 標準報酬500,000 × (Hins+Cins) / 2", () => {
    const expected = 500000 * (0.0991 + 0.0159) / 2;
    expect(calcHealthInsuranceMonthly(500000, 42, defaultRates)).toBeCloseTo(
      expected,
      0
    );
  });

  it("月額50万（30歳）: 標準報酬500,000 × Hins / 2", () => {
    const expected = 500000 * 0.0991 / 2;
    expect(calcHealthInsuranceMonthly(500000, 30, defaultRates)).toBeCloseTo(
      expected,
      0
    );
  });

  it("月額50万（70歳）: 標準報酬500,000 × Hins / 2", () => {
    const expected = 500000 * 0.0991 / 2;
    expect(calcHealthInsuranceMonthly(500000, 70, defaultRates)).toBeCloseTo(
      expected,
      0
    );
  });

  it("上限: 月額140万以上 → 標準報酬1,390,000", () => {
    const expected = 1390000 * 0.0991 / 2;
    expect(calcHealthInsuranceMonthly(1500000, 30, defaultRates)).toBeCloseTo(
      expected,
      0
    );
  });
});

// ============================================================
// 厚生年金保険料（月額）
// ============================================================
describe("calcPensionInsuranceMonthly", () => {
  it("月額0は0", () => {
    expect(calcPensionInsuranceMonthly(0, 42, defaultRates)).toBe(0);
  });

  it("71歳以上は0", () => {
    expect(calcPensionInsuranceMonthly(500000, 71, defaultRates)).toBe(0);
  });

  it("月額50万: 標準報酬500,000 × Pins / 2", () => {
    const expected = 500000 * 0.183 / 2;
    expect(calcPensionInsuranceMonthly(500000, 42, defaultRates)).toBeCloseTo(
      expected,
      0
    );
  });

  it("上限: 月額64万以上 → 標準報酬650,000", () => {
    const expected = 650000 * 0.183 / 2;
    expect(calcPensionInsuranceMonthly(700000, 42, defaultRates)).toBeCloseTo(
      expected,
      0
    );
  });
});

// ============================================================
// 賞与の社会保険料
// ============================================================
describe("calcBonusHealthInsurance (SocialInsBTS)", () => {
  it("賞与0は0", () => {
    expect(calcBonusHealthInsurance(0, 42, defaultRates)).toBe(0);
  });

  it("賞与100万（42歳）: 千円切捨→100万 × (Hins+Cins)/2", () => {
    const expected = 1000000 * (0.0991 + 0.0159) / 2;
    expect(calcBonusHealthInsurance(1000000, 42, defaultRates)).toBeCloseTo(
      expected,
      0
    );
  });

  it("上限超え: 573万超→573万で計算", () => {
    const expected = 5730000 * (0.0991 + 0.0159) / 2;
    expect(calcBonusHealthInsurance(10000000, 42, defaultRates)).toBeCloseTo(
      expected,
      0
    );
  });
});

describe("calcBonusPensionInsurance (SocialInsBPTS)", () => {
  it("賞与100万（42歳）: 千円切捨→100万 × Pins/2", () => {
    const expected = 1000000 * 0.183 / 2;
    expect(calcBonusPensionInsurance(1000000, 42, defaultRates)).toBeCloseTo(
      expected,
      0
    );
  });

  it("上限超え: 150万超→150万で計算", () => {
    const expected = 1500000 * 0.183 / 2;
    expect(calcBonusPensionInsurance(3000000, 42, defaultRates)).toBeCloseTo(
      expected,
      0
    );
  });
});

// ============================================================
// 子ども・子育て拠出金
// ============================================================
describe("calcChildcareContribution", () => {
  it("定期同額600万、事前確定なし", () => {
    const expected = 6000000 * 0.0036;
    expect(
      calcChildcareContribution(6000000, 0, 0, 0, defaultRates)
    ).toBeCloseTo(expected, 0);
  });

  it("定期同額月額635,000以上は上限", () => {
    // 月額800,000 → 650,000×12 = 7,800,000
    const salary = 800000 * 12;
    const expected = (650000 * 12) * 0.0036;
    expect(
      calcChildcareContribution(salary, 0, 0, 0, defaultRates)
    ).toBeCloseTo(expected, 0);
  });

  it("事前確定150万超は上限150万", () => {
    const expected = (6000000 + 1500000) * 0.0036;
    expect(
      calcChildcareContribution(6000000, 2000000, 0, 0, defaultRates)
    ).toBeCloseTo(expected, 0);
  });
});

// ============================================================
// 法人税
// ============================================================
describe("calcCorporateTax (ctax)", () => {
  const rates = DEFAULT_EFFECTIVE_TAX_RATES;

  it("400万以下", () => {
    const expected = 3000000 * rates.rateBelow4M;
    expect(calcCorporateTax(3000000, rates)).toBeCloseTo(expected, 0);
  });

  it("800万以下", () => {
    const { rateBelow4M: a, rateBelow8M: b } = rates;
    const expected = 6000000 * b - 4000000 * (b - a);
    expect(calcCorporateTax(6000000, rates)).toBeCloseTo(expected, 0);
  });

  it("800万超", () => {
    const { rateBelow4M: a, rateBelow8M: b, rateAbove8M: c } = rates;
    const expected =
      20000000 * c - 4000000 * (c - a) - 4000000 * (c - b);
    expect(calcCorporateTax(20000000, rates)).toBeCloseTo(expected, 0);
  });
});

// ============================================================
// 統合テスト: 役員1名の全計算
// ============================================================
describe("calcExecutive - 統合テスト", () => {
  it("年収1000万、42歳、社保加入、政管健保ON", () => {
    const exec: ExecutiveInput = {
      name: "テスト太郎",
      age: 42,
      regularSalary: 10000000,
      predeterminedBonus1: 0,
      predeterminedBonus2: 0,
      predeterminedBonus3: 0,
      otherSalaryIncome: 0,
      definedBenefitPension: 0,
      dividendIncome: 0,
      otherIncome: 0,
      otherDeductions: 1000000,
      taxCredit: 0,
      socialInsuranceEnrolled: true,
      childcareHousehold: true,
      manualHealthInsurance: false,
      manualHealthInsuranceAmount: 0,
    };

    const result = calcExecutive(exec, defaultRates, true, false, 0);

    // 給与収入 = 1000万
    expect(result.totalSalaryIncome).toBe(10000000);

    // 給与所得金額（子育て）= 1000万 × 0.9 - 110万 = 790万
    expect(result.salaryIncomeAfterDeduction).toBe(7900000);

    // 基礎控除 = 58万（合計所得790万 → 655万超なので58万）
    expect(result.basicDeduction).toBe(580000);

    // 社会保険加入中なので保険料 > 0
    expect(result.healthInsurance).toBeGreaterThan(0);
    expect(result.pensionInsurance).toBeGreaterThan(0);

    // 課税所得 > 0
    expect(result.taxableIncome).toBeGreaterThan(0);

    // 手取り額は給与収入未満
    expect(result.netIncome).toBeLessThan(10000000);
    expect(result.netIncome).toBeGreaterThan(0);
  });

  it("社保未加入の場合、保険料は0", () => {
    const exec: ExecutiveInput = {
      name: "未加入花子",
      age: 50,
      regularSalary: 5000000,
      predeterminedBonus1: 0,
      predeterminedBonus2: 0,
      predeterminedBonus3: 0,
      otherSalaryIncome: 0,
      definedBenefitPension: 0,
      dividendIncome: 0,
      otherIncome: 0,
      otherDeductions: 0,
      taxCredit: 0,
      socialInsuranceEnrolled: false,
      childcareHousehold: false,
      manualHealthInsurance: false,
      manualHealthInsuranceAmount: 0,
    };

    const result = calcExecutive(exec, defaultRates, true, false, 0);

    expect(result.healthInsurance).toBe(0);
    expect(result.pensionInsurance).toBe(0);
    expect(result.totalSocialInsurance).toBe(0);
    expect(result.employerSocialInsurance).toBe(0);
  });

  it("健康保険任意入力", () => {
    const exec: ExecutiveInput = {
      name: "医師国保太郎",
      age: 45,
      regularSalary: 8000000,
      predeterminedBonus1: 0,
      predeterminedBonus2: 0,
      predeterminedBonus3: 0,
      otherSalaryIncome: 0,
      definedBenefitPension: 0,
      dividendIncome: 0,
      otherIncome: 0,
      otherDeductions: 0,
      taxCredit: 0,
      socialInsuranceEnrolled: true,
      childcareHousehold: false,
      manualHealthInsurance: true,
      manualHealthInsuranceAmount: 500000,
    };

    const result = calcExecutive(exec, defaultRates, true, false, 0);

    expect(result.healthInsurance).toBe(500000);
    expect(result.pensionInsurance).toBeGreaterThan(0);
  });
});
