import type {
  HojinnariInput,
  HojinnariRates,
  IndividualResult,
  CorporateResult,
  HojinnariResult,
} from "@/types/hojinnari";
import type { RateSettings } from "@/types/simulation";
import {
  calcIncomeTax,
  calcBasicDeduction,
  calcSalaryIncome,
  calcHealthInsuranceMonthly,
  calcPensionInsuranceMonthly,
} from "./calc-engine";

// ============================================================
// 法人税計算 - ctax()
// ============================================================

/**
 * 法人税の計算（800万円境界の2段階税率）
 * 地方法人特別税を含む実効税率で計算
 */
export function calcCorporateTaxHojinnari(
  income: number,
  rates: HojinnariRates
): number {
  if (income <= 0) { return 0; }
  const ch = rates.localCorpTaxRate + 1;
  const h1 = rates.corporateTaxRate1 * ch;
  const h2 = rates.corporateTaxRate2 * ch;
  const boundary = 8000000;

  if (income <= boundary) {
    return Math.floor(income * h1);
  }
  return Math.floor(income * h2 - boundary * (h2 - h1));
}

// ============================================================
// 事業税計算 - biztax()
// ============================================================

/**
 * 法人事業税の計算（400万・800万境界の3段階税率）
 * 地方特別税を含む
 */
export function calcBusinessTax(
  income: number,
  rates: HojinnariRates
): number {
  if (income <= 0) { return 0; }
  const cht = rates.localBusinessTaxRate + 1;
  const b1 = rates.businessTaxRate1 * cht;
  const b2 = rates.businessTaxRate2 * cht;
  const b3 = rates.businessTaxRate3 * cht;
  const boundary1 = 4000000;
  const boundary2 = 8000000;

  if (income <= boundary1) {
    return Math.floor(income * b1);
  }
  if (income <= boundary2) {
    return Math.floor(income * b2 - boundary1 * (b2 - b1));
  }
  return Math.floor(
    income * b3 - boundary1 * (b3 - b2) - boundary1 * (b3 - b1)
  );
}

// ============================================================
// 社会保険料（法人役員）
// ============================================================

/**
 * 役員給与に対する社会保険料（役員負担分）
 * calc-engine.ts の関数を HojinnariRates に適合させてラップ
 */
function calcOwnerSocialInsurance(
  annualSalary: number,
  age: number,
  rates: HojinnariRates
): number {
  if (annualSalary <= 0) { return 0; }
  const monthlySalary = annualSalary / 12;
  // HojinnariRates を RateSettings 相当に変換して既存関数を再利用
  const rateSettings: RateSettings = {
    healthInsuranceRate: rates.healthInsuranceRate,
    nursingCareRate: rates.nursingCareRate,
    pensionRate: rates.pensionRate,
    childcareContributionRate: 0,
    healthBonusAnnualCap: 5730000,
    pensionBonusPerPaymentCap: 1500000,
  };
  const healthMonthly = calcHealthInsuranceMonthly(monthlySalary, age, rateSettings);
  const pensionMonthly = calcPensionInsuranceMonthly(monthlySalary, age, rateSettings);
  return Math.floor((healthMonthly + pensionMonthly) * 12);
}

// ============================================================
// 個人事業主の計算
// ============================================================

export function calcIndividual(
  input: HojinnariInput,
  rates: HojinnariRates
): IndividualResult {
  const { businessIncome, blueDeduction, spouseExpense, ownerAge } = input;

  // 事業所得 → 青色控除・専従者給与を差し引く
  const adjustedIncome = Math.max(0, businessIncome - blueDeduction - spouseExpense);

  // 基礎控除
  const basicDeduction = calcBasicDeduction(adjustedIncome);

  // 課税所得（国保・年金・その他控除を引く）
  const totalDeductions =
    basicDeduction +
    input.ownerNationalInsurance +
    input.ownerOtherDeductions;
  const taxableIncome = Math.max(0, adjustedIncome - totalDeductions);

  // 所得税（復興特別税込み）
  const incomeTax = Math.floor(calcIncomeTax(taxableIncome));

  // 住民税（課税所得の約10%）
  const residentTax = Math.floor(taxableIncome * 0.1);

  // 手取り
  const netIncome =
    businessIncome -
    blueDeduction -
    spouseExpense -
    input.ownerNationalInsurance -
    incomeTax -
    residentTax;

  void ownerAge; // 個人事業主では社会保険計算に使わない（入力値を使用）

  return {
    businessIncome,
    blueDeduction,
    spouseExpense,
    adjustedIncome,
    basicDeduction,
    otherDeductions: input.ownerOtherDeductions,
    nationalInsurance: input.ownerNationalInsurance,
    taxableIncome,
    incomeTax,
    residentTax,
    netIncome,
  };
}

// ============================================================
// 法人の計算
// ============================================================

export function calcCorporate(
  input: HojinnariInput,
  rates: HojinnariRates
): CorporateResult {
  const {
    businessIncome,
    corporateSalary,
    spouseSalary,
    ownerAge,
    isChildcareHousehold,
    ownerOtherDeductions,
  } = input;

  // 法人所得 = 事業所得 - 役員給与 - 専従者給与
  const totalSalaryPaid = corporateSalary + spouseSalary;
  const corporateIncome = Math.max(0, businessIncome - totalSalaryPaid);

  // 法人税
  const corporateTax = calcCorporateTaxHojinnari(corporateIncome, rates);

  // 事業税
  const businessTax = calcBusinessTax(corporateIncome, rates);

  // 法人内部留保
  const corporateRetained = Math.max(0, corporateIncome - corporateTax - businessTax);

  // 役員給与所得（給与所得控除後）
  const ownerSalaryAfterDeduction = calcSalaryIncome(corporateSalary, isChildcareHousehold);

  // 社会保険料（役員負担分）
  const ownerSocialInsurance = calcOwnerSocialInsurance(corporateSalary, ownerAge, rates);

  // 基礎控除
  const ownerBasicDeduction = calcBasicDeduction(ownerSalaryAfterDeduction);

  // 役員課税所得
  const ownerTaxableIncome = Math.max(
    0,
    ownerSalaryAfterDeduction -
      ownerBasicDeduction -
      ownerSocialInsurance -
      ownerOtherDeductions
  );

  // 役員所得税（復興特別税込み）
  const ownerIncomeTax = Math.floor(calcIncomeTax(ownerTaxableIncome));

  // 役員住民税
  const ownerResidentTax = Math.floor(ownerTaxableIncome * 0.1);

  // 役員手取り
  const ownerNetIncome =
    corporateSalary - ownerSocialInsurance - ownerIncomeTax - ownerResidentTax;

  // 手取り合計（役員手取り + 法人内部留保）
  const totalNetIncome = ownerNetIncome + corporateRetained;

  return {
    corporateIncome,
    corporateTax,
    businessTax,
    corporateRetained,
    ownerSalary: corporateSalary,
    ownerSalaryAfterDeduction,
    ownerSocialInsurance,
    ownerBasicDeduction,
    ownerOtherDeductions,
    ownerTaxableIncome,
    ownerIncomeTax,
    ownerResidentTax,
    ownerNetIncome,
    totalNetIncome,
  };
}

// ============================================================
// メイン計算関数
// ============================================================

export function calcHojinnari(
  input: HojinnariInput,
  rates: HojinnariRates
): HojinnariResult {
  const individual = calcIndividual(input, rates);
  const corporate = calcCorporate(input, rates);
  const difference = corporate.totalNetIncome - individual.netIncome;
  return { individual, corporate, difference };
}

// ============================================================
// 最適化: 役員給与を変えて手取りが最大になる点を探索
// ============================================================

export interface OptimizationPoint {
  salary: number;
  totalNetIncome: number;
  ownerNetIncome: number;
  corporateRetained: number;
}

/**
 * 役員給与を0〜事業所得の範囲で変えて手取りを計算
 * step刻みで試算し、最適値のリストを返す
 */
export function optimizeCorporateSalary(
  input: HojinnariInput,
  rates: HojinnariRates,
  step = 1000000
): OptimizationPoint[] {
  const results: OptimizationPoint[] = [];
  const max = input.businessIncome;

  for (let salary = 0; salary <= max; salary += step) {
    const modified = { ...input, corporateSalary: salary };
    const corporate = calcCorporate(modified, rates);
    results.push({
      salary,
      totalNetIncome: corporate.totalNetIncome,
      ownerNetIncome: corporate.ownerNetIncome,
      corporateRetained: corporate.corporateRetained,
    });
  }
  return results;
}

/** 最適な役員給与（手取り合計が最大になる値）を返す */
export function findOptimalSalary(
  input: HojinnariInput,
  rates: HojinnariRates,
  step = 1000000
): number {
  const points = optimizeCorporateSalary(input, rates, step);
  if (points.length === 0) { return 0; }
  return points.reduce((best, p) =>
    p.totalNetIncome > best.totalNetIncome ? p : best
  ).salary;
}
