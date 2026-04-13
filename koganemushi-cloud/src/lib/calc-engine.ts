import type {
  RateSettings,
  ExecutiveInput,
  ExecutiveResult,
  EffectiveTaxRates,
  CorporateTaxParams,
} from "@/types/simulation";
import {
  HEALTH_INSURANCE_TABLE,
  HEALTH_INSURANCE_MAX_GRADE,
  PENSION_TABLE,
  PENSION_MAX_GRADE,
  BASIC_DEDUCTION_TABLE,
  INCOME_TAX_TABLE,
} from "./tax-tables";

// ============================================================
// 給与所得控除
// ============================================================

/**
 * 給与所得控除後の金額（通常）- KoujyogoTS
 * 令和7年改正対応
 */
export function salaryIncomeDeduction(salaryIncome: number): number {
  if (salaryIncome < 650000) { return 0; }
  if (salaryIncome <= 1900000) { return salaryIncome - 650000; }
  if (salaryIncome < 3600000) { return salaryIncome * 0.7 - 80000; }
  if (salaryIncome < 6600000) { return salaryIncome * 0.8 - 440000; }
  if (salaryIncome < 8500000) { return salaryIncome * 0.9 - 1100000; }
  return salaryIncome - 1950000;
}

/**
 * 給与所得控除後の金額（子育て介護世帯）- Koujyogo_ch
 * 令和7年改正対応 - 850万円→1,000万円に上限引き上げ
 */
export function salaryIncomeDeductionChildcare(salaryIncome: number): number {
  if (salaryIncome < 650000) { return 0; }
  if (salaryIncome <= 1900000) { return salaryIncome - 650000; }
  if (salaryIncome < 3600000) { return salaryIncome * 0.7 - 80000; }
  if (salaryIncome < 6600000) { return salaryIncome * 0.8 - 440000; }
  if (salaryIncome < 10000000) { return salaryIncome * 0.9 - 1100000; }
  return salaryIncome - 2100000;
}

/**
 * 給与所得金額の計算
 * 子育て介護世帯フラグに応じて適切な関数を選択
 */
export function calcSalaryIncome(
  salaryIncome: number,
  isChildcareHousehold: boolean
): number {
  return isChildcareHousehold
    ? salaryIncomeDeductionChildcare(salaryIncome)
    : salaryIncomeDeduction(salaryIncome);
}

// ============================================================
// 所得税
// ============================================================

/**
 * 所得税の計算 - incometaxTS
 * 復興特別所得税（2.1%）は含まない。呼び出し側で ×1.021 する。
 */
export function calcIncomeTaxBase(taxableIncome: number): number {
  for (const [limit, rate, deduction] of INCOME_TAX_TABLE) {
    if (taxableIncome <= limit) {
      return taxableIncome * rate - deduction;
    }
  }
  return 0;
}

/**
 * 所得税（復興特別所得税込み）
 */
export function calcIncomeTax(taxableIncome: number): number {
  return calcIncomeTaxBase(taxableIncome) * 1.021;
}

/**
 * 所得税の計算（内訳付き）
 * 復興特別所得税（2.1%）込み。100円未満切り捨て。
 */
export function calcIncomeTaxWithDetail(taxableIncome: number): {
  rate: number;
  rateDeduction: number;
  base: number;
  recovery: number;
  total: number;
} {
  let rate = 0;
  let rateDeduction = 0;
  for (const [limit, r, d] of INCOME_TAX_TABLE) {
    if (taxableIncome <= limit) {
      rate = r;
      rateDeduction = d;
      break;
    }
  }
  const base = taxableIncome * rate - rateDeduction;
  const recovery = base * 0.021;
  const total = Math.floor((base + recovery) / 100) * 100;
  return { rate, rateDeduction, base, recovery, total };
}

// ============================================================
// 基礎控除
// ============================================================

/**
 * 基礎控除額の計算
 * 合計所得金額に応じた基礎控除額を返す
 */
export function calcBasicDeduction(totalIncome: number): number {
  for (const [threshold, deduction] of BASIC_DEDUCTION_TABLE) {
    if (totalIncome >= threshold) {
      return deduction;
    }
  }
  return 950000;
}

// ============================================================
// 配当控除
// ============================================================

/**
 * 配当控除額の計算（所得税）
 * 課税所得1,000万円以下部分: 10%、超部分: 5%
 */
export function calcDividendCreditIncomeTax(
  taxableIncome: number,
  dividendIncome: number
): number {
  const nonDividendIncome = taxableIncome - dividendIncome;
  const boundary = 10000000;

  if (nonDividendIncome + dividendIncome <= boundary) {
    return dividendIncome * 0.1;
  }
  if (nonDividendIncome >= boundary) {
    return dividendIncome * 0.05;
  }
  if (dividendIncome <= boundary - nonDividendIncome) {
    return dividendIncome * 0.1;
  }
  const belowBoundary = boundary - nonDividendIncome;
  return belowBoundary * 0.1 + (dividendIncome - belowBoundary) * 0.05;
}

/**
 * 配当控除額の計算（住民税）
 * 課税所得1,000万円以下部分: 2.8%、超部分: 1.4%
 */
export function calcDividendCreditResidentTax(
  taxableIncome: number,
  dividendIncome: number
): number {
  const nonDividendIncome = taxableIncome - dividendIncome;
  const boundary = 10000000;

  if (nonDividendIncome + dividendIncome <= boundary) {
    return dividendIncome * 0.028;
  }
  if (nonDividendIncome >= boundary) {
    return dividendIncome * 0.014;
  }
  if (dividendIncome <= boundary - nonDividendIncome) {
    return dividendIncome * 0.028;
  }
  const belowBoundary = boundary - nonDividendIncome;
  return belowBoundary * 0.028 + (dividendIncome - belowBoundary) * 0.014;
}

// ============================================================
// 社会保険料（月額定期同額ベース）
// ============================================================

/**
 * 標準報酬月額テーブルから標準報酬月額を取得
 */
function lookupStandardMonthlyRemuneration(
  monthlyIncome: number,
  table: [number, number][],
  maxGrade: number
): number {
  if (monthlyIncome <= 0) { return 0; }
  const income = Math.floor(monthlyIncome);
  for (const [limit, standardAmount] of table) {
    if (income < limit) {
      return standardAmount;
    }
  }
  return maxGrade;
}

/**
 * 健康保険料の計算（月額）- health関数
 */
export function calcHealthInsuranceMonthly(
  monthlyIncome: number,
  age: number,
  rates: RateSettings
): number {
  if (monthlyIncome <= 0) { return 0; }

  const standard = lookupStandardMonthlyRemuneration(
    monthlyIncome,
    HEALTH_INSURANCE_TABLE,
    HEALTH_INSURANCE_MAX_GRADE
  );

  let rate: number;
  if (age >= 40 && age <= 64) {
    rate = rates.healthInsuranceRate + rates.nursingCareRate;
  } else {
    rate = rates.healthInsuranceRate;
  }

  return standard * rate / 2;
}

/**
 * 厚生年金保険料の計算（月額）- pension関数
 */
export function calcPensionInsuranceMonthly(
  monthlyIncome: number,
  age: number,
  rates: RateSettings
): number {
  if (monthlyIncome <= 0 || age > 70) { return 0; }

  const standard = lookupStandardMonthlyRemuneration(
    monthlyIncome,
    PENSION_TABLE,
    PENSION_MAX_GRADE
  );

  return standard * rates.pensionRate / 2;
}

// ============================================================
// 社会保険料（賞与ベース）
// ============================================================

/**
 * 賞与の健康保険料 - SocialInsBTS
 */
export function calcBonusHealthInsurance(
  bonusAmount: number,
  age: number,
  rates: RateSettings
): number {
  if (bonusAmount <= 0) { return 0; }

  const standardBonus = Math.min(
    Math.floor(bonusAmount / 1000) * 1000,
    rates.healthBonusAnnualCap
  );

  let rate: number;
  if (age >= 40 && age <= 64) {
    rate = rates.healthInsuranceRate + rates.nursingCareRate;
  } else if (age <= 74) {
    rate = rates.healthInsuranceRate;
  } else {
    return 0;
  }

  return standardBonus * rate / 2;
}

/**
 * 賞与の厚生年金保険料 - SocialInsBPTS
 */
export function calcBonusPensionInsurance(
  bonusAmount: number,
  age: number,
  rates: RateSettings
): number {
  if (bonusAmount <= 0 || age > 65) { return 0; }

  const standardBonus = Math.min(
    Math.floor(bonusAmount / 1000) * 1000,
    rates.pensionBonusPerPaymentCap
  );

  return standardBonus * rates.pensionRate / 2;
}

// ============================================================
// 子ども・子育て拠出金
// ============================================================

export interface ChildcareContributionInput {
  regularSalary: number;
  bonus1: number;
  bonus2: number;
  bonus3: number;
}

/**
 * 子ども・子育て拠出金の計算（会社負担のみ）
 */
export function calcChildcareContribution(
  input: ChildcareContributionInput,
  rates: RateSettings
): number {
  const { regularSalary, bonus1, bonus2, bonus3 } = input;
  // 定期同額ベース: 月額635,000以上は上限650,000×12
  const salaryBase =
    regularSalary / 12 >= 635000 ? 650000 * 12 : regularSalary;

  // 事前確定: 上限150万、千円未満切り捨て
  const cap = 1500000;
  const b1 = bonus1 > cap ? cap : Math.floor(bonus1 / 1000) * 1000;
  const b2 = bonus2 > cap ? cap : Math.floor(bonus2 / 1000) * 1000;
  const b3 = bonus3 > cap ? cap : Math.floor(bonus3 / 1000) * 1000;

  return (salaryBase + b1 + b2 + b3) * rates.childcareContributionRate;
}

// ============================================================
// 法人税
// ============================================================

/**
 * 法人税計算 - ctax関数
 * 実効税率を用いた計算
 */
export function calcCorporateTax(
  corporateIncome: number,
  effectiveRates: EffectiveTaxRates
): number {
  const { rateBelow4M: a, rateBelow8M: b, rateAbove8M: c } = effectiveRates;

  if (corporateIncome <= 4000000) {
    return corporateIncome * a;
  }
  if (corporateIncome <= 8000000) {
    return corporateIncome * b - 4000000 * (b - a);
  }
  return corporateIncome * c - 4000000 * (c - a) - 4000000 * (c - b);
}

/**
 * 法人税金合計の計算
 */
export function calcCorporateTaxTotal(
  params: CorporateTaxParams,
  totalExecutivePay: number,
  totalEmployerInsurance: number,
  effectiveRates: EffectiveTaxRates
): number {
  const corporateIncome =
    params.preTaxCorporateIncome - totalExecutivePay - totalEmployerInsurance;
  const incomeAfterLoss = corporateIncome - params.carryForwardLoss;

  if (incomeAfterLoss <= 0) {
    return params.perCapitaLevy;
  }
  return Math.floor(
    (calcCorporateTax(incomeAfterLoss, effectiveRates) + params.perCapitaLevy) / 100
  ) * 100;
}

// ============================================================
// メイン計算: ヘルパー関数
// ============================================================

export interface CalcExecutiveContext {
  isGovernmentHealthInsurance: boolean;
  combineOtherSalary: boolean;
  executiveIndex: number;
}

/** 健康保険料の計算（個人負担） */
function calcPersonalHealthInsurance(
  exec: ExecutiveInput,
  rates: RateSettings,
  monthlyInsuranceBase: number,
  isGovernmentHealthInsurance: boolean
): number {
  if (!exec.socialInsuranceEnrolled) {
    return 0;
  }
  if (exec.manualHealthInsurance) {
    return exec.manualHealthInsuranceAmount;
  }
  if (!isGovernmentHealthInsurance) {
    return 0;
  }
  const monthlySalaryHealth = calcHealthInsuranceMonthly(
    monthlyInsuranceBase, exec.age, rates
  ) * 12;
  const bonusHealth = calcBonusHealthInsurance(
    exec.predeterminedBonus1 + exec.predeterminedBonus2 + exec.predeterminedBonus3,
    exec.age, rates
  );
  return monthlySalaryHealth + bonusHealth;
}

/** 厚生年金保険料の計算（個人負担） */
function calcPersonalPension(
  exec: ExecutiveInput,
  rates: RateSettings,
  monthlyInsuranceBase: number
): number {
  if (!exec.socialInsuranceEnrolled) {
    return 0;
  }
  const monthlyPension =
    calcPensionInsuranceMonthly(monthlyInsuranceBase, exec.age, rates) * 12;
  const bonusPension =
    calcBonusPensionInsurance(exec.predeterminedBonus1, exec.age, rates) +
    calcBonusPensionInsurance(exec.predeterminedBonus2, exec.age, rates) +
    calcBonusPensionInsurance(exec.predeterminedBonus3, exec.age, rates);
  return monthlyPension + bonusPension;
}

/** 個人税金の計算 */
function calcPersonalTax(
  exec: ExecutiveInput,
  taxableIncome: number
): {
  incomeTax: number; dividendCreditIncomeTax: number;
  residentTax: number; dividendCreditResidentTax: number;
  totalPersonalTax: number;
} {
  const incomeTax = calcIncomeTax(taxableIncome);
  const dividendCreditIncomeTax = calcDividendCreditIncomeTax(taxableIncome, exec.dividendIncome);
  const residentTax = taxableIncome * 0.1;
  const dividendCreditResidentTax = calcDividendCreditResidentTax(taxableIncome, exec.dividendIncome);

  const incomeTaxAfterCredit = incomeTax - dividendCreditIncomeTax - exec.taxCredit;
  const incomeTaxPortion = incomeTaxAfterCredit > 0
    ? Math.floor(incomeTaxAfterCredit / 100) * 100
    : 0;
  const residentTaxPortion = residentTax - dividendCreditResidentTax > 0
    ? residentTax - dividendCreditResidentTax
    : 0;

  return {
    incomeTax,
    dividendCreditIncomeTax,
    residentTax,
    dividendCreditResidentTax,
    totalPersonalTax: incomeTaxPortion + residentTaxPortion,
  };
}

/** 会社負担社会保険料の計算 */
function calcEmployerInsurance(
  exec: ExecutiveInput,
  rates: RateSettings,
  monthlyInsuranceBase: number,
  isGovernmentHealthInsurance: boolean
): number {
  if (!exec.socialInsuranceEnrolled) {
    return 0;
  }

  const employerHealthMonthly = isGovernmentHealthInsurance
    ? calcHealthInsuranceMonthly(monthlyInsuranceBase, exec.age, rates) * 12
    : 0;
  const employerPensionMonthly =
    calcPensionInsuranceMonthly(monthlyInsuranceBase, exec.age, rates) * 12;

  const childcare = calcChildcareContribution({
    regularSalary: exec.regularSalary,
    bonus1: exec.predeterminedBonus1,
    bonus2: exec.predeterminedBonus2,
    bonus3: exec.predeterminedBonus3,
  }, rates);

  const employerBonusPension =
    calcBonusPensionInsurance(exec.predeterminedBonus1, exec.age, rates) +
    calcBonusPensionInsurance(exec.predeterminedBonus2, exec.age, rates) +
    calcBonusPensionInsurance(exec.predeterminedBonus3, exec.age, rates);

  const employerBonusHealth = isGovernmentHealthInsurance
    ? calcBonusHealthInsurance(
        exec.predeterminedBonus1 + exec.predeterminedBonus2 + exec.predeterminedBonus3,
        exec.age, rates
      )
    : 0;

  return employerHealthMonthly + employerPensionMonthly +
    childcare + employerBonusPension + employerBonusHealth;
}

// ============================================================
// メイン計算: 役員1名分
// ============================================================

/** 給与収入・所得・社保ベースの計算 */
function calcIncomeBase(exec: ExecutiveInput, ctx: CalcExecutiveContext) {
  const totalSalaryIncome =
    exec.regularSalary + exec.predeterminedBonus1 +
    exec.predeterminedBonus2 + exec.predeterminedBonus3 +
    exec.otherSalaryIncome - exec.definedBenefitPension;
  const salaryIncomeAfterDeduction = calcSalaryIncome(
    totalSalaryIncome, exec.childcareHousehold
  );
  const totalIncome = salaryIncomeAfterDeduction + exec.dividendIncome + exec.otherIncome;
  let insuranceSalaryBase = exec.regularSalary - exec.definedBenefitPension;
  if (ctx.combineOtherSalary && ctx.executiveIndex === 0) {
    insuranceSalaryBase += exec.otherSalaryIncome;
  }
  return { totalSalaryIncome, salaryIncomeAfterDeduction, totalIncome, insuranceSalaryBase };
}

/** 手取り額の計算 */
function calcNetIncome(exec: ExecutiveInput, totalTaxAndInsurance: number): number {
  const grossIncome = exec.regularSalary + exec.predeterminedBonus1 +
    exec.predeterminedBonus2 + exec.predeterminedBonus3 + exec.otherSalaryIncome;
  return grossIncome - exec.definedBenefitPension +
    exec.dividendIncome + exec.otherIncome - totalTaxAndInsurance;
}

/**
 * 役員1名分の全計算を実行
 */
export function calcExecutive(
  exec: ExecutiveInput,
  rates: RateSettings,
  ctx: CalcExecutiveContext
): ExecutiveResult {
  const base = calcIncomeBase(exec, ctx);
  const monthlyInsuranceBase = base.insuranceSalaryBase / 12;

  const healthInsurance = calcPersonalHealthInsurance(
    exec, rates, monthlyInsuranceBase, ctx.isGovernmentHealthInsurance
  );
  const pensionInsurance = calcPersonalPension(exec, rates, monthlyInsuranceBase);
  const totalSocialInsurance = healthInsurance + pensionInsurance;
  const basicDeduction = calcBasicDeduction(base.totalIncome);

  const taxableIncomeRaw = base.salaryIncomeAfterDeduction +
    exec.dividendIncome + exec.otherIncome -
    totalSocialInsurance - exec.otherDeductions - basicDeduction;
  const taxableIncome =
    taxableIncomeRaw > 0 ? Math.floor(taxableIncomeRaw / 1000) * 1000 : 0;

  const tax = calcPersonalTax(exec, taxableIncome);
  const totalTaxAndInsurance = tax.totalPersonalTax + totalSocialInsurance;
  const netIncome = calcNetIncome(exec, totalTaxAndInsurance);
  const employerSocialInsurance = calcEmployerInsurance(
    exec, rates, monthlyInsuranceBase, ctx.isGovernmentHealthInsurance
  );

  return {
    ...base, socialInsuranceDeduction: totalSocialInsurance, basicDeduction,
    taxableIncome, ...tax, healthInsurance, pensionInsurance,
    totalSocialInsurance, totalTaxAndInsurance, netIncome,
    employerSocialInsurance,
    totalSocialInsuranceCombined: totalSocialInsurance + employerSocialInsurance,
  };
}

/**
 * ExecutiveResultの合計を計算
 */
export function sumResults(results: ExecutiveResult[]): ExecutiveResult {
  const sum: ExecutiveResult = {
    totalSalaryIncome: 0,
    salaryIncomeAfterDeduction: 0,
    totalIncome: 0,
    socialInsuranceDeduction: 0,
    basicDeduction: 0,
    taxableIncome: 0,
    incomeTax: 0,
    dividendCreditIncomeTax: 0,
    residentTax: 0,
    dividendCreditResidentTax: 0,
    totalPersonalTax: 0,
    healthInsurance: 0,
    pensionInsurance: 0,
    totalSocialInsurance: 0,
    totalTaxAndInsurance: 0,
    netIncome: 0,
    employerSocialInsurance: 0,
    totalSocialInsuranceCombined: 0,
  };

  for (const r of results) {
    for (const key of Object.keys(sum) as (keyof ExecutiveResult)[]) {
      (sum[key] as number) += r[key] as number;
    }
  }

  return sum;
}
