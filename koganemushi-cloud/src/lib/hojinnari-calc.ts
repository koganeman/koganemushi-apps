import type {
  HojinnariInput,
  HojinnariRates,
  FamilyMember,
  FamilyMemberResult,
  IndividualResult,
  PlanResult,
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
// 事業税計算（法人） - biztax()
// ============================================================

/**
 * 社会保険分の所得金額（医療法人）
 * 法人所得 × (社会保険分医業収入 / 総収入金額)
 */
export function calcSocialInsuranceIncome(
  corporateIncome: number,
  socialInsuranceMedicalRevenue: number,
  totalRevenue: number
): number {
  if (totalRevenue <= 0 || socialInsuranceMedicalRevenue <= 0) return 0;
  const ratio = Math.min(1, socialInsuranceMedicalRevenue / totalRevenue);
  return Math.floor(corporateIncome * ratio);
}

export function calcBusinessTax(
  income: number,
  rates: HojinnariRates,
  isMedicalCorporation = false,
  socialInsuranceIncome = 0
): number {
  if (income <= 0) { return 0; }

  // 医療法人: 社会保険分の所得を課税対象から除外し、低い税率を適用
  const taxableIncome = isMedicalCorporation
    ? Math.max(0, income - socialInsuranceIncome)
    : income;

  const r1 = isMedicalCorporation ? rates.medicalBusinessTaxRate1 : rates.businessTaxRate1;
  const r2 = isMedicalCorporation ? rates.medicalBusinessTaxRate2 : rates.businessTaxRate2;
  const r3 = isMedicalCorporation ? rates.medicalBusinessTaxRate3 : rates.businessTaxRate3;

  const cht = rates.localBusinessTaxRate + 1;
  const b1 = r1 * cht;
  const b2 = r2 * cht;
  const b3 = r3 * cht;
  const boundary1 = 4000000;
  const boundary2 = 8000000;

  if (taxableIncome <= boundary1) {
    return Math.floor(taxableIncome * b1);
  }
  if (taxableIncome <= boundary2) {
    return Math.floor(taxableIncome * b2 - boundary1 * (b2 - b1));
  }
  return Math.floor(
    taxableIncome * b3 - boundary1 * (b3 - b2) - boundary1 * (b3 - b1)
  );
}

// ============================================================
// 個人事業税（個人事業主側）
// ============================================================

/**
 * 個人事業税（概算）
 * 所得 - 290万円 の5%（第三種事業）
 * ※ 実際は業種によって異なる
 */
export function calcIndividualBusinessTax(income: number): number {
  const deduction = 2900000;
  if (income <= deduction) { return 0; }
  return Math.floor((income - deduction) * 0.05);
}

// ============================================================
// 社会保険料（法人役員・月額給与ベース）
// ============================================================

function toRateSettings(rates: HojinnariRates): RateSettings {
  return {
    healthInsuranceRate: rates.healthInsuranceRate,
    nursingCareRate: rates.nursingCareRate,
    pensionRate: rates.pensionRate,
    childcareContributionRate: 0,
    healthBonusAnnualCap: 5730000,
    pensionBonusPerPaymentCap: 1500000,
  };
}

const CHILDCARE_CONTRIBUTION_RATE = 0.0036;

/**
 * 年間役員給与に対する社会保険料（個人負担分・法人負担分）
 * 法人負担分は個人負担分 + 子ども・子育て拠出金
 */
function calcSocialInsurancePair(
  annualSalary: number,
  age: number,
  rates: HojinnariRates
): { owner: number; employer: number } {
  if (annualSalary <= 0) { return { owner: 0, employer: 0 }; }
  const monthlySalary = annualSalary / 12;
  const rs = toRateSettings(rates);
  // 月額を円未満切り捨てしてから年額に
  const healthMonthly = Math.floor(calcHealthInsuranceMonthly(monthlySalary, age, rs));
  const pensionMonthly = Math.floor(calcPensionInsuranceMonthly(monthlySalary, age, rs));
  const owner = (healthMonthly + pensionMonthly) * 12;
  // 子ども・子育て拠出金（法人のみ負担、標準報酬月額ベース）
  const childcare = Math.floor(annualSalary * CHILDCARE_CONTRIBUTION_RATE);
  const employer = owner + childcare;
  return { owner, employer };
}

// ============================================================
// 公的年金等控除 → 年金雑所得
// ============================================================

/**
 * 公的年金等控除を適用して年金雑所得を計算
 * 年齢（65歳以上/未満）と公的年金等以外の合計所得金額で控除額が変わる
 * 参考: 国税庁「公的年金等に係る雑所得の速算表」
 */
export function calcPensionIncome(
  pensionRevenue: number,
  age: number,
  otherTotalIncome: number = 0
): number {
  // 公的年金等以外の合計所得金額による控除額の調整
  // 1000万以下: 0、1000万超2000万以下: -100000、2000万超: -200000
  const adj = otherTotalIncome <= 10000000 ? 0
    : otherTotalIncome <= 20000000 ? 100000
    : 200000;

  if (age >= 65) {
    // 65歳以上
    const minDeduction = 1100000 - adj;
    if (pensionRevenue <= minDeduction) return 0;
    if (pensionRevenue <= 3300000) return pensionRevenue - minDeduction;
    if (pensionRevenue <= 4100000) return Math.floor(pensionRevenue * 0.75) - (275000 - adj);
    if (pensionRevenue <= 7700000) return Math.floor(pensionRevenue * 0.85) - (685000 - adj);
    if (pensionRevenue <= 10000000) return Math.floor(pensionRevenue * 0.95) - (1455000 - adj);
    return pensionRevenue - (1955000 - adj);
  }
  // 65歳未満
  const minDeduction = 600000 - adj;
  if (pensionRevenue <= minDeduction) return 0;
  if (pensionRevenue <= 1300000) return pensionRevenue - minDeduction;
  if (pensionRevenue <= 4100000) return Math.floor(pensionRevenue * 0.75) - (375000 - adj);
  if (pensionRevenue <= 7700000) return Math.floor(pensionRevenue * 0.85) - (785000 - adj);
  if (pensionRevenue <= 10000000) return Math.floor(pensionRevenue * 0.95) - (1555000 - adj);
  return pensionRevenue - (1955000 - adj);
}

// ============================================================
// 家族構成員の税計算
// ============================================================

export function calcFamilyMemberTax(
  member: FamilyMember,
  isChildcareHousehold: boolean
): FamilyMemberResult {
  const salaryAfterDeduction = calcSalaryIncome(member.salaryIncome, isChildcareHousehold);
  const otherIncome = member.otherIncome;
  const otherTotalIncome = salaryAfterDeduction + otherIncome;
  const pensionAfterDeduction = calcPensionIncome(member.pensionIncome, member.age, otherTotalIncome);

  const totalIncome = salaryAfterDeduction + pensionAfterDeduction + otherIncome;
  const basicDeduction = calcBasicDeduction(totalIncome);
  const totalDeductions = basicDeduction + member.socialInsurance + member.otherDeductions;
  // 課税所得は1,000円未満切り捨て
  const taxableIncome = Math.floor(Math.max(0, totalIncome - totalDeductions) / 1000) * 1000;
  const incomeTax = Math.floor(calcIncomeTax(taxableIncome));
  const residentTax = Math.floor(taxableIncome * 0.1);
  const taxTotal = incomeTax + residentTax;
  const netIncome =
    member.salaryIncome + member.pensionIncome + otherIncome -
    member.socialInsurance - incomeTax - residentTax;

  return {
    salaryIncome: member.salaryIncome,
    salaryAfterDeduction,
    pensionIncome: member.pensionIncome,
    pensionAfterDeduction,
    otherIncome,
    totalIncome,
    socialInsurance: member.socialInsurance,
    otherDeductions: member.otherDeductions,
    basicDeduction,
    totalDeductions,
    taxableIncome,
    incomeTax,
    residentTax,
    taxTotal,
    netIncome,
  };
}

// ============================================================
// 現状（個人事業主）計算
// ============================================================

export function calcIndividual(
  input: HojinnariInput,
): IndividualResult {
  const { businessIncome, blueDeduction, ownerSalaryIncome, ownerPensionIncome, ownerOtherIncome, ownerNationalInsurance, ownerOtherDeductions, isChildcareHousehold } = input;

  // 事業所得 → 青色控除
  const adjustedIncome = Math.max(0, businessIncome - blueDeduction);

  // 給与所得控除
  const salaryAfterDeduction = calcSalaryIncome(ownerSalaryIncome, isChildcareHousehold);

  // 年金雑所得（公的年金等控除後）
  const ownerOtherTotalIncome = adjustedIncome + salaryAfterDeduction + ownerOtherIncome;
  const pensionAfterDeduction = calcPensionIncome(ownerPensionIncome, input.ownerAge, ownerOtherTotalIncome);

  // 所得金額（事業所得 + 給与所得 + 年金雑所得 + 他の所得）
  const totalIncome = adjustedIncome + salaryAfterDeduction + pensionAfterDeduction + ownerOtherIncome;

  // 基礎控除
  const basicDeduction = calcBasicDeduction(totalIncome);
  const totalDeductions = basicDeduction + ownerNationalInsurance + ownerOtherDeductions;
  // 課税所得は1,000円未満切り捨て
  const taxableIncome = Math.floor(Math.max(0, totalIncome - totalDeductions) / 1000) * 1000;

  // 所得税（復興特別税込み）
  const incomeTax = Math.floor(calcIncomeTax(taxableIncome));

  // 住民税
  const residentTax = Math.floor(taxableIncome * 0.1);
  const taxTotal = incomeTax + residentTax;

  // 個人事業税（事業所得 = 青色控除前の金額で計算）
  const individualBusinessTax = calcIndividualBusinessTax(businessIncome);

  // 手取り = 収入合計 - 税金 - 社会保険料
  const netIncome =
    businessIncome +
    ownerSalaryIncome +
    ownerPensionIncome +
    ownerOtherIncome -
    ownerNationalInsurance -
    incomeTax -
    residentTax -
    individualBusinessTax;

  // 家族計算
  const family: ReturnType<typeof calcFamilyMemberTax>[] = [];
  if (input.hasSpouse) {
    family.push(calcFamilyMemberTax(input.spouse, isChildcareHousehold));
  }
  for (let i = 0; i < input.childCount; i++) {
    family.push(calcFamilyMemberTax(input.children[i], isChildcareHousehold));
  }

  const familyNetIncome = family.reduce((sum, m) => sum + m.netIncome, 0);
  const combinedNetIncome = netIncome + familyNetIncome;

  return {
    businessIncome,
    blueDeduction,
    adjustedIncome,
    salaryAfterDeduction,
    pensionAfterDeduction,
    totalIncome,
    nationalInsurance: ownerNationalInsurance,
    otherDeductions: ownerOtherDeductions,
    basicDeduction,
    totalDeductions,
    taxableIncome,
    incomeTax,
    residentTax,
    taxTotal,
    individualBusinessTax,
    netIncome,
    family,
    combinedNetIncome,
  };
}

// ============================================================
// 共通ヘルパー: 個人税計算
// ============================================================

interface IndivTaxInput {
  totalIncome: number;
  socialInsurance: number;
  otherDeductions: number;
}

interface IndivTaxResult {
  incomeTax: number;
  residentTax: number;
  taxTotal: number;
}

function calcIndivTax(p: IndivTaxInput): IndivTaxResult {
  const basic = calcBasicDeduction(p.totalIncome);
  // 課税所得は1,000円未満切り捨て
  const taxable = Math.floor(Math.max(0, p.totalIncome - basic - p.socialInsurance - p.otherDeductions) / 1000) * 1000;
  const incomeTax = Math.floor(calcIncomeTax(taxable));
  const residentTax = Math.floor(taxable * 0.1);
  return { incomeTax, residentTax, taxTotal: incomeTax + residentTax };
}

interface CorpSideResult {
  corporateIncome: number;
  corporateTax: number;
  corporateBusinessTax: number;
  corporateRetained: number;
  employeeEmployerSI: number;
  medicalSocialInsuranceIncome: number;
}

function calcCorpSide(
  revenue: number,
  salaries: number,
  ownerEmployerSI: number,
  rates: HojinnariRates,
  input: HojinnariInput
): CorpSideResult {
  // 従業員会社負担社会保険料
  const employeeEmployerSI = Math.floor(input.employeeSalary * rates.employeeInsuranceRate);
  const totalEmployerSI = ownerEmployerSI + employeeEmployerSI;

  const corporateIncomeRaw = Math.max(0, revenue - salaries - totalEmployerSI);
  // 法人所得は1,000円未満切り捨て
  const corporateIncome = Math.floor(corporateIncomeRaw / 1000) * 1000;

  // 医療法人: 社会保険分の所得金額を計算
  const medicalSocialInsuranceIncome = input.isMedicalCorporation
    ? calcSocialInsuranceIncome(corporateIncome, input.socialInsuranceMedicalRevenue, input.totalRevenue)
    : 0;

  const corporateTax = calcCorporateTaxHojinnari(corporateIncome, rates);
  const corporateBusinessTax = calcBusinessTax(
    corporateIncome,
    rates,
    input.isMedicalCorporation,
    medicalSocialInsuranceIncome
  );
  const corporateRetained = Math.max(0, corporateIncomeRaw - corporateTax - corporateBusinessTax);
  return { corporateIncome, corporateTax, corporateBusinessTax, corporateRetained, employeeEmployerSI, medicalSocialInsuranceIncome };
}

// ============================================================
// PLAN1: マイクロ法人成り
// ============================================================

export function calcPlan1(
  input: HojinnariInput,
  rates: HojinnariRates
): PlanResult {
  const {
    businessIncome, blueDeduction, ownerAge, ownerSalaryIncome, ownerPensionIncome, ownerOtherIncome, ownerOtherDeductions,
    isChildcareHousehold, plan1MicroRevenue, plan1MicroSalary, plan1SpouseSalary,
  } = input;

  const remainingBusiness = Math.max(0, businessIncome - plan1MicroRevenue);
  const adjustedIndividual = Math.max(0, remainingBusiness - blueDeduction);
  const salaryAfterDeduction = calcSalaryIncome(plan1MicroSalary + ownerSalaryIncome, isChildcareHousehold);
  const otherTotalIncomeForPension = adjustedIndividual + salaryAfterDeduction + ownerOtherIncome;
  const pensionAfterDeduction = calcPensionIncome(ownerPensionIncome, ownerAge, otherTotalIncomeForPension);
  const individualTotalIncome = adjustedIndividual + salaryAfterDeduction + pensionAfterDeduction + ownerOtherIncome;

  const si = calcSocialInsurancePair(plan1MicroSalary, ownerAge, rates);
  const ownerSocialInsurance = si.owner;
  const employerSocialInsurance = si.employer;

  const tax = calcIndivTax({
    totalIncome: individualTotalIncome,
    socialInsurance: ownerSocialInsurance,
    otherDeductions: ownerOtherDeductions,
  });
  const individualBusinessTax = calcIndividualBusinessTax(adjustedIndividual);

  const ownerNetIncome =
    remainingBusiness + plan1MicroSalary + ownerSalaryIncome + ownerPensionIncome + ownerOtherIncome -
    ownerSocialInsurance - tax.incomeTax - tax.residentTax - individualBusinessTax;

  const corp = calcCorpSide(
    plan1MicroRevenue,
    plan1MicroSalary + plan1SpouseSalary,
    employerSocialInsurance,
    rates,
    input
  );

  return {
    individualBusinessIncome: remainingBusiness,
    individualAdjustedIncome: adjustedIndividual,
    individualSalaryIncome: plan1MicroSalary,
    individualSalaryAfterDeduction: salaryAfterDeduction,
    individualTotalIncome,
    individualIncomeTax: tax.incomeTax,
    individualResidentTax: tax.residentTax,
    individualBusinessTax,
    individualTaxTotal: tax.taxTotal,
    ownerSocialInsurance,
    employerSocialInsurance,
    employeeEmployerSocialInsurance: corp.employeeEmployerSI,
    totalSocialInsurance: ownerSocialInsurance + employerSocialInsurance + corp.employeeEmployerSI,
    corporateSalary: plan1MicroSalary,
    spouseSalary: plan1SpouseSalary,
    corporateRevenue: plan1MicroRevenue,
    ...corp,
    medicalSocialInsuranceIncome: corp.medicalSocialInsuranceIncome,
    ownerNetIncome,
    corporateNetIncome: corp.corporateRetained,
    combinedNetIncome: ownerNetIncome + corp.corporateRetained,
  };
}

// ============================================================
// PLAN2: 完全法人成り
// ============================================================

export function calcPlan2(
  input: HojinnariInput,
  rates: HojinnariRates
): PlanResult {
  const {
    businessIncome, ownerAge, ownerSalaryIncome, ownerPensionIncome, ownerOtherIncome, ownerOtherDeductions,
    isChildcareHousehold, plan2Salary, plan2SpouseSalary,
  } = input;

  const salaryAfterDeduction = calcSalaryIncome(plan2Salary + ownerSalaryIncome, isChildcareHousehold);
  const otherTotalIncomeForPension = salaryAfterDeduction + ownerOtherIncome;
  const pensionAfterDeduction = calcPensionIncome(ownerPensionIncome, ownerAge, otherTotalIncomeForPension);
  const individualTotalIncome = salaryAfterDeduction + pensionAfterDeduction + ownerOtherIncome;

  const si = calcSocialInsurancePair(plan2Salary, ownerAge, rates);
  const ownerSocialInsurance = si.owner;
  const employerSocialInsurance = si.employer;

  const tax = calcIndivTax({
    totalIncome: individualTotalIncome,
    socialInsurance: ownerSocialInsurance,
    otherDeductions: ownerOtherDeductions,
  });

  const ownerNetIncome = plan2Salary + ownerSalaryIncome + ownerPensionIncome + ownerOtherIncome -
    ownerSocialInsurance - tax.incomeTax - tax.residentTax;

  const corp = calcCorpSide(
    businessIncome,
    plan2Salary + plan2SpouseSalary,
    employerSocialInsurance,
    rates,
    input
  );

  return {
    individualBusinessIncome: 0,
    individualAdjustedIncome: 0,
    individualSalaryIncome: plan2Salary,
    individualSalaryAfterDeduction: salaryAfterDeduction,
    individualTotalIncome,
    individualIncomeTax: tax.incomeTax,
    individualResidentTax: tax.residentTax,
    individualBusinessTax: 0,
    individualTaxTotal: tax.taxTotal,
    ownerSocialInsurance,
    employerSocialInsurance,
    employeeEmployerSocialInsurance: corp.employeeEmployerSI,
    totalSocialInsurance: ownerSocialInsurance + employerSocialInsurance + corp.employeeEmployerSI,
    corporateSalary: plan2Salary,
    spouseSalary: plan2SpouseSalary,
    corporateRevenue: businessIncome,
    ...corp,
    medicalSocialInsuranceIncome: corp.medicalSocialInsuranceIncome,
    ownerNetIncome,
    corporateNetIncome: corp.corporateRetained,
    combinedNetIncome: ownerNetIncome + corp.corporateRetained,
  };
}

// ============================================================
// 旧互換用 calcCorporate (シンプルな法人計算)
// ============================================================

export function calcCorporate(
  input: HojinnariInput,
  rates: HojinnariRates
): CorporateResult {
  const {
    businessIncome, plan2Salary, plan2SpouseSalary, ownerAge,
    isChildcareHousehold, ownerOtherDeductions,
  } = input;
  const totalSalaryPaid = plan2Salary + plan2SpouseSalary;
  const corporateIncome = Math.max(0, businessIncome - totalSalaryPaid);
  const corporateTax = calcCorporateTaxHojinnari(corporateIncome, rates);
  const businessTax = calcBusinessTax(corporateIncome, rates);
  const corporateRetained = Math.max(0, corporateIncome - corporateTax - businessTax);
  const ownerSalaryAfterDeduction = calcSalaryIncome(plan2Salary, isChildcareHousehold);
  const ownerSocialInsurance = calcSocialInsurancePair(plan2Salary, ownerAge, rates).owner;
  const ownerBasicDeduction = calcBasicDeduction(ownerSalaryAfterDeduction);
  const ownerTaxableIncome = Math.max(
    0,
    ownerSalaryAfterDeduction - ownerBasicDeduction - ownerSocialInsurance - ownerOtherDeductions
  );
  const ownerIncomeTax = Math.floor(calcIncomeTax(ownerTaxableIncome));
  const ownerResidentTax = Math.floor(ownerTaxableIncome * 0.1);
  const ownerNetIncome = plan2Salary - ownerSocialInsurance - ownerIncomeTax - ownerResidentTax;
  const totalNetIncome = ownerNetIncome + corporateRetained;

  return {
    corporateIncome,
    corporateTax,
    businessTax,
    corporateRetained,
    ownerSalary: plan2Salary,
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
  const individual = calcIndividual(input);
  const plan1 = calcPlan1(input, rates);
  const plan2 = calcPlan2(input, rates);
  const corporate = calcCorporate(input, rates);
  const difference = plan2.combinedNetIncome - individual.netIncome;

  return { individual, plan1, plan2, corporate, difference };
}

// ============================================================
// 最適化: PLAN2の役員給与を変えて手取りが最大になる点を探索
// ============================================================

export interface OptimizationPoint {
  salary: number;
  totalNetIncome: number;
  ownerNetIncome: number;
  corporateRetained: number;
}

export function optimizePlan2Salary(
  input: HojinnariInput,
  rates: HojinnariRates,
  step = 1000000
): OptimizationPoint[] {
  const results: OptimizationPoint[] = [];
  const max = input.businessIncome;

  for (let salary = 0; salary <= max; salary += step) {
    const modified = { ...input, plan2Salary: salary };
    const plan2 = calcPlan2(modified, rates);
    results.push({
      salary,
      totalNetIncome: plan2.combinedNetIncome,
      ownerNetIncome: plan2.ownerNetIncome,
      corporateRetained: plan2.corporateRetained,
    });
  }
  return results;
}

export function findOptimalPlan2Salary(
  input: HojinnariInput,
  rates: HojinnariRates,
  step = 1000000
): number {
  const points = optimizePlan2Salary(input, rates, step);
  if (points.length === 0) { return 0; }
  return points.reduce((best, p) =>
    p.totalNetIncome > best.totalNetIncome ? p : best
  ).salary;
}

// ============================================================
// 最適化: PLAN1のマイクロ法人役員給与を変えて最適化
// ============================================================

export interface MicroOptPoint {
  microRevenue: number;
  microSalary: number;
  combinedNetIncome: number;
  ownerNetIncome: number;
  corporateRetained: number;
}

export function optimizePlan1(
  input: HojinnariInput,
  rates: HojinnariRates,
  step = 1000000
): MicroOptPoint[] {
  const results: MicroOptPoint[] = [];
  const maxRevenue = input.businessIncome;

  for (let microRevenue = 0; microRevenue <= maxRevenue; microRevenue += step) {
    const modified = { ...input, plan1MicroRevenue: microRevenue };
    const plan1 = calcPlan1(modified, rates);
    results.push({
      microRevenue,
      microSalary: input.plan1MicroSalary,
      combinedNetIncome: plan1.combinedNetIncome,
      ownerNetIncome: plan1.ownerNetIncome,
      corporateRetained: plan1.corporateRetained,
    });
  }
  return results;
}

// 旧互換用エクスポート
export { calcPlan2 as calcCorporateNew };
export function optimizeCorporateSalary(
  input: HojinnariInput,
  rates: HojinnariRates,
  step = 1000000
): OptimizationPoint[] {
  return optimizePlan2Salary(input, rates, step);
}
export function findOptimalSalary(
  input: HojinnariInput,
  rates: HojinnariRates,
  step = 1000000
): number {
  return findOptimalPlan2Salary(input, rates, step);
}
