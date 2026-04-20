/**
 * Excel ground truth テスト
 *
 * calcExecutive() の全中間値を手計算で検証するシナリオテスト。
 * 各シナリオの期待値は calc-engine.ts のロジックと税率テーブルから
 * ステップごとに手計算で導出。
 */
import { describe, it, expect } from "vitest";
import {
  calcExecutive,
  calcCorporateTaxTotal,
  sumResults,
} from "../calc-engine";
import type {
  ExecutiveInput,
  RateSettings,
  CorporateTaxParams,
} from "@/types/simulation";
import { DEFAULT_EFFECTIVE_TAX_RATES } from "../tax-tables";

const rates: RateSettings = {
  healthInsuranceRate: 0.0991,
  nursingCareRate: 0.0159,
  pensionRate: 0.183,
  childcareSupportRate: 0,  // Excel ground truthは支援金制度導入前のデータ
  childcareContributionRate: 0.0036,
  healthBonusAnnualCap: 5730000,
  pensionBonusPerPaymentCap: 1500000,
};

function makeExec(overrides: Partial<ExecutiveInput> = {}): ExecutiveInput {
  const regularSalary = overrides.regularSalary ?? 0;
  return {
    name: "",
    age: 0,
    regularSalary: 0,
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
    childcareHousehold: true,
    manualHealthInsurance: false,
    manualHealthInsuranceAmount: 0,
    preChangeMonthlyRemuneration: 0,
    postChangeMonthlyRemuneration: regularSalary / 12,
    standardRemunerationChangeMonth: 1,
    ...overrides,
  };
}

// ============================================================
// シナリオ1: 年収1200万、45歳、社保加入、政管健保、子育て世帯
// ============================================================
describe("シナリオ1: 年収1200万、45歳、子育て世帯", () => {
  const exec = makeExec({
    name: "シナリオ1",
    age: 45,
    regularSalary: 12000000,
    childcareHousehold: true,
  });
  const result = calcExecutive(exec, rates, {
    combineOtherSalary: false,
    executiveIndex: 0,
  });

  it("給与収入 = 1200万", () => {
    expect(result.totalSalaryIncome).toBe(12000000);
  });

  it("給与所得金額（子育て） = 1200万 - 210万 = 990万", () => {
    // salaryIncomeDeductionChildcare(12000000) = 12000000 - 2100000
    expect(result.salaryIncomeAfterDeduction).toBe(9900000);
  });

  it("合計所得金額 = 990万", () => {
    expect(result.totalIncome).toBe(9900000);
  });

  it("健康保険料: 標準報酬980,000 × (9.91%+1.59%)/2 × 12", () => {
    // monthly = 1,000,000 → lookup → 980,000 (< 1,005,000)
    // rate = 0.115, monthly = 980000 * 0.115 / 2 = 56,350
    // annual = 56,350 * 12 = 676,200
    expect(result.healthInsurance).toBeCloseTo(676200, 0);
  });

  it("厚生年金: 標準報酬650,000（上限） × 18.3%/2 × 12", () => {
    // monthly = 650000 * 0.183 / 2 = 59,475
    // annual = 59,475 * 12 = 713,700
    expect(result.pensionInsurance).toBeCloseTo(713700, 0);
  });

  it("社会保険料計 = 健保 + 年金", () => {
    expect(result.totalSocialInsurance).toBeCloseTo(676200 + 713700, 0);
  });

  it("基礎控除 = 58万（合計所得990万 > 655万）", () => {
    expect(result.basicDeduction).toBe(580000);
  });

  it("課税所得 = floor((990万 - 1,389,900 - 58万) / 1000) * 1000 = 7,930,000", () => {
    expect(result.taxableIncome).toBe(7930000);
  });

  it("所得税（復興税込み）", () => {
    // base = 7,930,000 * 0.23 - 636,000 = 1,187,900
    // tax = 1,187,900 * 1.021 = 1,212,825.9
    expect(result.incomeTax).toBeCloseTo(1187900 * 1.021, 0);
  });

  it("住民税 = 課税所得 × 10%", () => {
    expect(result.residentTax).toBe(793000);
  });

  it("個人税金合計", () => {
    // incomeTaxPortion = floor(1,212,825.9 / 100) * 100 = 1,212,800
    // residentTaxPortion = 793,000
    expect(result.totalPersonalTax).toBe(1212800 + 793000);
  });

  it("手取り額 = 給与収入 - 税金社保合計", () => {
    expect(result.netIncome).toBe(12000000 - result.totalTaxAndInsurance);
  });

  it("会社負担社保 = 健保 + 年金 + 子育て拠出金", () => {
    // employerHealth = 676,200
    // employerPension = 713,700
    // childcare: monthly 1,000,000 >= 635,000 → base = 650,000*12 = 7,800,000
    // childcare = 7,800,000 * 0.0036 = 28,080
    expect(result.employerSocialInsurance).toBeCloseTo(676200 + 713700 + 28080, 0);
  });
});

// ============================================================
// シナリオ2: 年収600万＋事前確定200万、55歳、非子育て世帯
// ============================================================
describe("シナリオ2: 年収600万＋事前確定200万、55歳", () => {
  const exec = makeExec({
    name: "シナリオ2",
    age: 55,
    regularSalary: 6000000,
    predeterminedBonus1: 2000000,
    childcareHousehold: false,
  });
  const result = calcExecutive(exec, rates, {
    combineOtherSalary: false,
    executiveIndex: 0,
  });

  it("給与収入 = 800万", () => {
    expect(result.totalSalaryIncome).toBe(8000000);
  });

  it("給与所得金額（通常） = 800万 × 0.9 - 110万 = 610万", () => {
    expect(result.salaryIncomeAfterDeduction).toBe(6100000);
  });

  it("健康保険料: 定期＋賞与", () => {
    // 定期: 月額500,000 → lookup → 500,000 (< 515,000)
    // rate = 0.115, monthly = 500,000 * 0.115 / 2 = 28,750
    // annual = 28,750 * 12 = 345,000
    // 賞与: 2,000,000, standardBonus = 2,000,000
    // bonusHealth = 2,000,000 * 0.115 / 2 = 115,000
    expect(result.healthInsurance).toBeCloseTo(345000 + 115000, 0);
  });

  it("厚生年金: 定期＋賞与", () => {
    // 定期: 標準報酬500,000 × 0.183/2 = 45,750 × 12 = 549,000
    // 賞与: min(2,000,000, 1,500,000) = 1,500,000 × 0.183/2 = 137,250
    expect(result.pensionInsurance).toBeCloseTo(549000 + 137250, 0);
  });

  it("基礎控除 = 63万（合計所得610万 > 489万）", () => {
    expect(result.basicDeduction).toBe(630000);
  });

  it("課税所得", () => {
    // raw = 6,100,000 - (460,000+686,250) - 630,000 = 4,323,750
    // taxableIncome = 4,323,000
    expect(result.taxableIncome).toBe(4323000);
  });

  it("所得税（復興税込み）", () => {
    // base = 4,323,000 * 0.20 - 427,500 = 437,100
    // tax = 437,100 * 1.021 = 446,481.1
    expect(result.incomeTax).toBeCloseTo(437100 * 1.021, 0);
  });

  it("個人税金合計", () => {
    // incomeTax = 437,100 * 1.021 = 446,279.1
    // incomeTaxPortion = floor(446,279.1 / 100) * 100 = 446,200
    // residentTax = 432,300
    expect(result.totalPersonalTax).toBe(446200 + 432300);
  });

  it("手取り額", () => {
    // grossIncome = 8,000,000
    // netIncome = 8,000,000 - totalTaxAndInsurance
    expect(result.netIncome).toBe(8000000 - result.totalTaxAndInsurance);
  });

  it("会社負担社保", () => {
    // employerHealth = 345,000
    // employerPension = 549,000
    // childcare: monthly 500,000 < 635,000 → base = 6,000,000
    //   b1 = min(2,000,000, 1,500,000) = 1,500,000
    //   childcare = (6,000,000 + 1,500,000) * 0.0036 = 27,000
    // employerBonusPension = 137,250
    // employerBonusHealth = 115,000
    expect(result.employerSocialInsurance).toBeCloseTo(
      345000 + 549000 + 27000 + 137250 + 115000,
      0
    );
  });
});

// ============================================================
// シナリオ3: 年収3600万、60歳、配当300万、子育て世帯（高額報酬）
// ============================================================
describe("シナリオ3: 年収3600万、60歳、配当300万", () => {
  const exec = makeExec({
    name: "シナリオ3",
    age: 60,
    regularSalary: 36000000,
    dividendIncome: 3000000,
    childcareHousehold: true,
  });
  const result = calcExecutive(exec, rates, {
    combineOtherSalary: false,
    executiveIndex: 0,
  });

  it("給与収入 = 3600万", () => {
    expect(result.totalSalaryIncome).toBe(36000000);
  });

  it("給与所得金額（子育て） = 3600万 - 210万 = 3390万", () => {
    expect(result.salaryIncomeAfterDeduction).toBe(33900000);
  });

  it("合計所得金額 = 3390万 + 300万 = 3690万", () => {
    expect(result.totalIncome).toBe(36900000);
  });

  it("基礎控除 = 0（合計所得2500万超）", () => {
    expect(result.basicDeduction).toBe(0);
  });

  it("健康保険料: 上限標準報酬1,390,000", () => {
    // rate = 0.115 (60歳 → 40-64歳), monthly = 1,390,000 * 0.115 / 2 = 79,925
    // annual = 79,925 * 12 = 959,100
    expect(result.healthInsurance).toBeCloseTo(959100, 0);
  });

  it("厚生年金: 上限標準報酬650,000", () => {
    // monthly = 650,000 * 0.183 / 2 = 59,475 × 12 = 713,700
    expect(result.pensionInsurance).toBeCloseTo(713700, 0);
  });

  it("配当控除（所得税）= 300万 × 5%（課税所得が1000万超）", () => {
    expect(result.dividendCreditIncomeTax).toBe(150000);
  });

  it("配当控除（住民税）= 300万 × 1.4%", () => {
    expect(result.dividendCreditResidentTax).toBe(42000);
  });

  it("課税所得", () => {
    // raw = 33,900,000 + 3,000,000 - 1,672,800 - 0 = 35,227,200
    // taxableIncome = 35,227,000
    expect(result.taxableIncome).toBe(35227000);
  });

  it("所得税（復興税込み）", () => {
    // base = 35,227,000 * 0.40 - 2,796,000 = 11,294,800
    // tax = 11,294,800 * 1.021 = 11,534,010.8
    expect(result.incomeTax).toBeCloseTo(11294800 * 1.021, 0);
  });

  it("個人税金合計", () => {
    // incomeTax = 11,294,800 * 1.021 = 11,531,990.8
    // incomeTaxAfterCredit = 11,531,990.8 - 150,000 = 11,381,990.8
    // incomeTaxPortion = 11,381,900
    // residentTax = 3,522,700 - 42,000 = 3,480,700
    expect(result.totalPersonalTax).toBe(11381900 + 3480700);
  });

  it("手取り額", () => {
    // grossIncome = 36,000,000
    // netIncome = 36,000,000 + 3,000,000 - totalTaxAndInsurance
    expect(result.netIncome).toBe(36000000 + 3000000 - result.totalTaxAndInsurance);
  });
});

// ============================================================
// シナリオ4: 年収480万、35歳（介護保険なし）、非子育て世帯
// ============================================================
describe("シナリオ4: 年収480万、35歳（介護なし）", () => {
  const exec = makeExec({
    name: "シナリオ4",
    age: 35,
    regularSalary: 4800000,
    childcareHousehold: false,
  });
  const result = calcExecutive(exec, rates, {
    combineOtherSalary: false,
    executiveIndex: 0,
  });

  it("給与収入 = 480万", () => {
    expect(result.totalSalaryIncome).toBe(4800000);
  });

  it("給与所得金額（通常） = 480万 × 0.8 - 44万 = 340万", () => {
    expect(result.salaryIncomeAfterDeduction).toBe(3400000);
  });

  it("健康保険料: 介護なし", () => {
    // monthly 400,000 → lookup → 410,000 (< 425,000)
    // rate = 0.0991 (no nursing care for age 35)
    // monthly = 410,000 * 0.0991 / 2 = 20,315.5
    // annual = 20,315.5 * 12 = 243,786
    expect(result.healthInsurance).toBeCloseTo(243786, 0);
  });

  it("厚生年金", () => {
    // 410,000 * 0.183 / 2 = 37,515 × 12 = 450,180
    expect(result.pensionInsurance).toBeCloseTo(450180, 0);
  });

  it("基礎控除 = 68万（合計所得340万 > 336万）", () => {
    expect(result.basicDeduction).toBe(680000);
  });

  it("課税所得", () => {
    // raw = 3,400,000 - 693,966 - 680,000 = 2,026,034
    // taxableIncome = 2,026,000
    expect(result.taxableIncome).toBe(2026000);
  });

  it("所得税（復興税込み）", () => {
    // base = 2,026,000 * 0.10 - 97,500 = 105,100
    // tax = 105,100 * 1.021 = 107,307.1
    expect(result.incomeTax).toBeCloseTo(105100 * 1.021, 0);
  });

  it("個人税金合計", () => {
    // incomeTaxPortion = 107,300
    // residentTax = 202,600
    expect(result.totalPersonalTax).toBe(107300 + 202600);
  });

  it("手取り額", () => {
    expect(result.netIncome).toBe(4800000 - result.totalTaxAndInsurance);
  });

  it("会社負担社保", () => {
    // health = 243,786
    // pension = 450,180
    // childcare = 4,800,000 * 0.0036 = 17,280
    expect(result.employerSocialInsurance).toBeCloseTo(243786 + 450180 + 17280, 0);
  });
});

// ============================================================
// シナリオ5: 年収1800万＋事前確定600万×2、50歳、配当100万、
//            他所得200万、他控除50万、税額控除10万、子育て世帯
// ============================================================
describe("シナリオ5: 複合ケース（高額＋事前確定＋配当＋他所得＋税額控除）", () => {
  const exec = makeExec({
    name: "シナリオ5",
    age: 50,
    regularSalary: 18000000,
    predeterminedBonus1: 6000000,
    predeterminedBonus2: 6000000,
    dividendIncome: 1000000,
    otherIncome: 2000000,
    otherDeductions: 500000,
    taxCredit: 100000,
    childcareHousehold: true,
  });
  const result = calcExecutive(exec, rates, {
    combineOtherSalary: false,
    executiveIndex: 0,
  });

  it("給与収入 = 1800万 + 600万 + 600万 = 3000万", () => {
    expect(result.totalSalaryIncome).toBe(30000000);
  });

  it("給与所得金額（子育て） = 3000万 - 210万 = 2790万", () => {
    expect(result.salaryIncomeAfterDeduction).toBe(27900000);
  });

  it("合計所得金額 = 2790万 + 100万 + 200万 = 3090万", () => {
    expect(result.totalIncome).toBe(30900000);
  });

  it("健康保険料: 定期（上限）＋ 賞与（上限573万）", () => {
    // 定期: 1,390,000 * 0.115 / 2 * 12 = 959,100
    // 賞与: min(12,000,000, 5,730,000) = 5,730,000 * 0.115 / 2 = 329,475
    expect(result.healthInsurance).toBeCloseTo(959100 + 329475, 0);
  });

  it("厚生年金: 定期（上限）＋ 賞与（各回上限150万）", () => {
    // 定期: 650,000 * 0.183 / 2 * 12 = 713,700
    // 賞与1: min(6,000,000, 1,500,000) * 0.183 / 2 = 137,250
    // 賞与2: 同上 = 137,250
    expect(result.pensionInsurance).toBeCloseTo(713700 + 137250 + 137250, 0);
  });

  it("基礎控除 = 0（合計所得2500万超）", () => {
    expect(result.basicDeduction).toBe(0);
  });

  it("課税所得", () => {
    // socialInsurance = 1,288,575 + 988,200 = 2,276,775
    // raw = 27,900,000 + 1,000,000 + 2,000,000 - 2,276,775 - 500,000 - 0 = 28,123,225
    // taxableIncome = 28,123,000
    expect(result.taxableIncome).toBe(28123000);
  });

  it("配当控除（所得税）= 100万 × 5%（1000万超）", () => {
    expect(result.dividendCreditIncomeTax).toBe(50000);
  });

  it("配当控除（住民税）= 100万 × 1.4%", () => {
    expect(result.dividendCreditResidentTax).toBe(14000);
  });

  it("所得税（復興税込み）", () => {
    // base = 28,123,000 * 0.40 - 2,796,000 = 8,453,200
    // tax = 8,453,200 * 1.021 = 8,630,717.2
    expect(result.incomeTax).toBeCloseTo(8453200 * 1.021, 0);
  });

  it("個人税金合計（税額控除10万あり）", () => {
    // incomeTaxAfterCredit = 8,630,717.2 - 50,000 - 100,000 = 8,480,717.2
    // incomeTaxPortion = 8,480,700
    // residentTax = 2,812,300 - 14,000 = 2,798,300
    expect(result.totalPersonalTax).toBe(8480700 + 2798300);
  });

  it("手取り額", () => {
    // grossIncome = 30,000,000
    // netIncome = 30,000,000 + 1,000,000 + 2,000,000 - totalTaxAndInsurance
    expect(result.netIncome).toBe(30000000 + 1000000 + 2000000 - result.totalTaxAndInsurance);
  });

  it("会社負担社保", () => {
    // health = 959,100
    // pension = 713,700
    // childcare: base = 7,800,000, b1 = 1,500,000, b2 = 1,500,000
    //   (7,800,000 + 1,500,000 + 1,500,000) * 0.0036 = 38,880
    // bonusPension = 137,250 + 137,250 = 274,500
    // bonusHealth = 329,475
    expect(result.employerSocialInsurance).toBeCloseTo(
      959100 + 713700 + 38880 + 274500 + 329475,
      0
    );
  });
});

// ============================================================
// 法人税 統合テスト
// ============================================================
describe("法人税統合テスト", () => {
  const effectiveRates = DEFAULT_EFFECTIVE_TAX_RATES;

  it("法人所得1000万の場合", () => {
    const params: CorporateTaxParams = {
      preTaxCorporateIncome: 30000000,
      perCapitaLevy: 70000,
      carryForwardLoss: 0,
    };
    // 役員報酬合計1200万、会社負担社保150万の場合
    // corporateIncome = 30,000,000 - 12,000,000 - 1,500,000 = 16,500,000
    // incomeAfterLoss = 16,500,000
    // tax = 16,500,000 * rateAbove8M - 4M*(c-a) - 4M*(c-b)
    const { rateBelow4M: a, rateBelow8M: b, rateAbove8M: c } = effectiveRates;
    const rawTax = 16500000 * c - 4000000 * (c - a) - 4000000 * (c - b);
    const expected = Math.floor((rawTax + 70000) / 100) * 100;
    expect(calcCorporateTaxTotal(params, 12000000, 1500000, effectiveRates)).toBe(expected);
  });

  it("法人所得がマイナス（繰越欠損金超過）→ 均等割のみ", () => {
    const params: CorporateTaxParams = {
      preTaxCorporateIncome: 10000000,
      perCapitaLevy: 70000,
      carryForwardLoss: 5000000,
    };
    // corporateIncome = 10,000,000 - 12,000,000 - 0 = -2,000,000
    // incomeAfterLoss = -2,000,000 - 5,000,000 → 均等割のみ
    expect(calcCorporateTaxTotal(params, 12000000, 0, effectiveRates)).toBe(70000);
  });

  it("繰越欠損金で所得減少", () => {
    const params: CorporateTaxParams = {
      preTaxCorporateIncome: 20000000,
      perCapitaLevy: 70000,
      carryForwardLoss: 3000000,
    };
    // corporateIncome = 20,000,000 - 6,000,000 - 500,000 = 13,500,000
    // incomeAfterLoss = 13,500,000 - 3,000,000 = 10,500,000
    const { rateBelow4M: a, rateBelow8M: b, rateAbove8M: c } = effectiveRates;
    const rawTax = 10500000 * c - 4000000 * (c - a) - 4000000 * (c - b);
    const expected = Math.floor((rawTax + 70000) / 100) * 100;
    expect(calcCorporateTaxTotal(params, 6000000, 500000, effectiveRates)).toBe(expected);
  });
});

// ============================================================
// sumResults テスト
// ============================================================
describe("sumResults - 合計計算", () => {
  it("複数役員の結果を正しく合計する", () => {
    const exec1 = makeExec({
      age: 45,
      regularSalary: 12000000,
      childcareHousehold: true,
    });
    const exec2 = makeExec({
      age: 55,
      regularSalary: 6000000,
      predeterminedBonus1: 2000000,
      childcareHousehold: false,
    });

    const r1 = calcExecutive(exec1, rates, {
      isGovernmentHealthInsurance: true,
      combineOtherSalary: false,
      executiveIndex: 0,
    });
    const r2 = calcExecutive(exec2, rates, {
      isGovernmentHealthInsurance: true,
      combineOtherSalary: false,
      executiveIndex: 1,
    });
    const totals = sumResults([r1, r2]);

    expect(totals.totalSalaryIncome).toBe(r1.totalSalaryIncome + r2.totalSalaryIncome);
    expect(totals.netIncome).toBe(r1.netIncome + r2.netIncome);
    expect(totals.totalPersonalTax).toBe(r1.totalPersonalTax + r2.totalPersonalTax);
    expect(totals.employerSocialInsurance).toBeCloseTo(
      r1.employerSocialInsurance + r2.employerSocialInsurance,
      0
    );
  });
});
