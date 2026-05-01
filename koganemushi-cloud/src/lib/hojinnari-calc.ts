import type {
  HojinnariInput,
  HojinnariRates,
  FamilyMember,
  FamilyMemberResult,
  IndividualResult,
  PlanResult,
  CorporateResult,
  HojinnariResult,
  TaxDetailBreakdown,
  CorpTaxDetailBreakdown,
  NetIncomeDetailBreakdown,
} from "@/types/hojinnari";
import {
  calcIncomeTax,
  calcIncomeTaxWithDetail,
  calcBasicDeduction,
  calcSalaryIncome,
} from "./calc-engine";
import type { TaxYear } from "./tax-tables";
import {
  HEALTH_INSURANCE_TABLE,
  PENSION_TABLE,
} from "./tax-tables";

// ============================================================
// 法人税計算 - ctax()
// ============================================================

/**
 * 法人税の前段（地方法人税・住民税法人税割を乗じる前）。
 * 800万円境界で税率切替。
 */
function calcCorporateTaxRaw(income: number, rates: HojinnariRates): number {
  if (income <= 0) { return 0; }
  const boundary = 8000000;
  if (income <= boundary) {
    return income * rates.corporateTaxRate1;
  }
  return income * rates.corporateTaxRate2
    - boundary * (rates.corporateTaxRate2 - rates.corporateTaxRate1);
}

/**
 * 法人税本体（地方法人税含む）と法人住民税（法人税割）を分けて返す。
 */
export function calcCorporateTaxParts(
  income: number,
  rates: HojinnariRates
): { corporateTaxBase: number; residentTax: number } {
  const raw = calcCorporateTaxRaw(income, rates);
  if (raw <= 0) { return { corporateTaxBase: 0, residentTax: 0 }; }
  const corporateTaxBase = Math.floor(raw * (1 + rates.localCorpTaxRate));
  const residentTax = Math.floor(
    raw * (rates.prefecturalTaxRate1 + rates.municipalTaxRate)
  );
  return { corporateTaxBase, residentTax };
}

/**
 * 法人税合計（地方法人税＋法人住民税法人税割を含む。均等割は含まない）。
 * houkokusho-sheet 等の既存呼び出しがこの値を「法人税」として参照する。
 */
export function calcCorporateTaxHojinnari(
  income: number,
  rates: HojinnariRates
): number {
  const { corporateTaxBase, residentTax } = calcCorporateTaxParts(income, rates);
  return corporateTaxBase + residentTax;
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
// VBA SocialInsTS 関数に準拠
// ============================================================

/** 健康保険の上限標準報酬月額（VBA準拠: 1,210,000円） */
const HOJINNARI_HEALTH_MAX_GRADE = 1210000;

/** 厚生年金の上限標準報酬月額 */
const HOJINNARI_PENSION_MAX_GRADE = 650000;

/** 厚生年金の最低標準報酬月額（VBA準拠: 98,000円） */
const PENSION_MIN_GRADE = 98000;

/**
 * 社会保険料の端数処理（被保険者負担分）
 * 料率表注記: 50銭以下は切り捨て、50銭を超える場合は切り上げ
 */
function roundInsurance(amount: number): number {
  const fraction = amount - Math.floor(amount);
  return fraction > 0.5 ? Math.ceil(amount) : Math.floor(amount);
}

/**
 * 標準報酬月額テーブルから標準報酬月額を取得
 */
function lookupStandard(
  monthlyIncome: number,
  table: [number, number][],
  maxGrade: number
): number {
  if (monthlyIncome <= 0) return 0;
  const income = Math.floor(monthlyIncome);
  for (const [limit, standardAmount] of table) {
    if (income < limit) return standardAmount;
  }
  return maxGrade;
}

/**
 * 健康保険料（月額・個人負担分）— VBA SocialInsTS 準拠
 * 介護保険: 40〜70歳（VBA準拠）
 * 上限等級: 1,210,000円（VBA準拠）
 */
function calcHojinnariHealthMonthly(
  monthlyIncome: number,
  age: number,
  rates: HojinnariRates
): number {
  if (monthlyIncome <= 0) return 0;
  if (age > 74) return 0;

  const standard = lookupStandard(
    monthlyIncome,
    HEALTH_INSURANCE_TABLE,
    HOJINNARI_HEALTH_MAX_GRADE
  );
  // VBA: 上限は1,210,000円
  const capped = Math.min(standard, HOJINNARI_HEALTH_MAX_GRADE);

  // 介護保険第2号被保険者: 40〜64歳
  const rate = (age >= 40 && age <= 64)
    ? rates.healthInsuranceRate + rates.nursingCareRate
    : rates.healthInsuranceRate;

  return capped * rate / 2;
}

/**
 * 厚生年金保険料（月額・個人負担分）— VBA SocialInsTS 準拠
 * 最低等級: 98,000円（VBA準拠）
 * 70歳超は対象外
 */
function calcHojinnariPensionMonthly(
  monthlyIncome: number,
  age: number,
  rates: HojinnariRates
): number {
  if (monthlyIncome <= 0 || age > 70) return 0;

  // VBA: 月額93,000未満でも厚生年金の標準報酬月額は98,000円
  let standard: number;
  if (monthlyIncome < 93000) {
    standard = PENSION_MIN_GRADE;
  } else {
    standard = lookupStandard(
      monthlyIncome,
      PENSION_TABLE,
      HOJINNARI_PENSION_MAX_GRADE
    );
  }

  return standard * rates.pensionRate / 2;
}

/**
 * 年間役員給与に対する社会保険料（個人負担分・法人負担分）
 * 個人負担: 健康保険 + 厚生年金 + 子ども・子育て支援金(折半)
 * 法人負担: 個人負担と同額 + 子ども・子育て拠出金(会社のみ)
 */
function calcSocialInsurancePair(
  annualSalary: number,
  age: number,
  rates: HojinnariRates,
  options: { useIndustryInsurance?: boolean; industryInsuranceMonthly?: number } = {}
): { owner: number; employer: number } {
  const useIndustry = options.useIndustryInsurance ?? false;
  const industryMonthly = options.industryInsuranceMonthly ?? 0;
  const industryAnnual = useIndustry ? industryMonthly * 12 : 0;

  if (annualSalary <= 0) {
    // 給与なしでも業種別国保は個人負担として発生
    return { owner: industryAnnual, employer: 0 };
  }
  const monthlySalary = annualSalary / 12;

  // 健康保険（業種別国保パターンでは0）
  const healthMonthly = useIndustry
    ? 0
    : roundInsurance(calcHojinnariHealthMonthly(monthlySalary, age, rates));
  // 厚生年金（業種別国保パターンでも通常加入）
  const pensionMonthly = roundInsurance(calcHojinnariPensionMonthly(monthlySalary, age, rates));

  // 子ども・子育て支援金（健保ベースのため業種別国保パターンでは0）
  const healthStandard = lookupStandard(
    Math.floor(monthlySalary),
    HEALTH_INSURANCE_TABLE,
    HOJINNARI_HEALTH_MAX_GRADE
  );
  const cappedHealthStandard = Math.min(healthStandard, HOJINNARI_HEALTH_MAX_GRADE);
  const childcareSupportMonthly = useIndustry
    ? 0
    : roundInsurance(cappedHealthStandard * rates.childcareSupportRate / 2);

  const folvableMonthly = healthMonthly + pensionMonthly + childcareSupportMonthly;
  // 個人負担 = 折半分 + 業種別国保（個人負担のみ）
  const owner = folvableMonthly * 12 + industryAnnual;

  // 法人負担 = 折半分（個人と同額・業種別国保は含まない）+ 子ども・子育て拠出金（厚生年金の標準報酬月額 × 拠出金率）
  let pensionStandard: number;
  if (monthlySalary < 93000) {
    pensionStandard = PENSION_MIN_GRADE;
  } else {
    pensionStandard = lookupStandard(
      Math.floor(monthlySalary),
      PENSION_TABLE,
      HOJINNARI_PENSION_MAX_GRADE
    );
  }
  const childcareContribution = Math.floor(pensionStandard * 12 * rates.childcareContributionRate);
  const employer = folvableMonthly * 12 + childcareContribution;

  return { owner, employer };
}

/**
 * 従業員会社負担保険料率を自動計算
 * = (健康保険率 + 介護保険率) / 2 + 厚生年金率 / 2 + 支援金率 / 2 + 拠出金率
 */
export function calcEmployeeInsuranceRate(rates: HojinnariRates): number {
  return (rates.healthInsuranceRate + rates.nursingCareRate) / 2
    + rates.pensionRate / 2
    + rates.childcareSupportRate / 2
    + rates.childcareContributionRate;
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

/**
 * 配偶者など家族メンバーの税金計算（結果＋計算明細）
 */
export function calcFamilyMemberTaxWithDetail(
  member: FamilyMember,
  isChildcareHousehold: boolean,
  taxYear: TaxYear = "R7"
): { result: FamilyMemberResult; taxDetail: TaxDetailBreakdown } {
  const salaryAfterDeduction = calcSalaryIncome(member.salaryIncome, isChildcareHousehold, taxYear);
  const otherIncome = member.otherIncome;
  const otherTotalIncome = salaryAfterDeduction + otherIncome;
  const pensionAfterDeduction = calcPensionIncome(member.pensionIncome, member.age, otherTotalIncome);

  const totalIncome = salaryAfterDeduction + pensionAfterDeduction + otherIncome;
  const basicDeduction = calcBasicDeduction(totalIncome, taxYear);
  const totalDeductions = basicDeduction + member.socialInsurance + member.otherDeductions;
  // 課税所得は1,000円未満切り捨て
  const taxableIncome = Math.floor(Math.max(0, totalIncome - totalDeductions) / 1000) * 1000;
  const incomeTaxBreakdown = calcIncomeTaxWithDetail(taxableIncome);
  const incomeTax = incomeTaxBreakdown.total;
  const residentTax = Math.floor(taxableIncome * 0.1);
  const taxTotal = incomeTax + residentTax;
  const netIncome =
    member.salaryIncome + member.pensionIncome + otherIncome -
    member.socialInsurance - incomeTax - residentTax;

  const result: FamilyMemberResult = {
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

  const taxDetail: TaxDetailBreakdown = {
    salaryRevenue: member.salaryIncome,
    salaryAfterDeduction,
    pensionRevenue: member.pensionIncome,
    pensionAfterDeduction,
    businessIncome: 0,
    otherIncome,
    totalIncome,
    socialInsuranceDeduction: member.socialInsurance,
    otherDeductions: member.otherDeductions,
    basicDeduction,
    totalDeductions,
    taxableIncome,
    incomeTaxRate: incomeTaxBreakdown.rate,
    incomeTaxRateDeduction: incomeTaxBreakdown.rateDeduction,
    incomeTaxBase: incomeTaxBreakdown.base,
    incomeTaxRecovery: incomeTaxBreakdown.recovery,
    incomeTax,
    residentTax,
    individualBusinessTax: 0,
  };

  return { result, taxDetail };
}

export function calcFamilyMemberTax(
  member: FamilyMember,
  isChildcareHousehold: boolean,
  taxYear: TaxYear = "R7"
): FamilyMemberResult {
  return calcFamilyMemberTaxWithDetail(member, isChildcareHousehold, taxYear).result;
}

// ============================================================
// 現状（個人事業主）計算
// ============================================================

export function calcIndividual(
  input: HojinnariInput,
  taxYear: TaxYear = "R7"
): IndividualResult {
  const { businessIncome, blueDeduction, ownerSalaryIncome, ownerPensionIncome, ownerOtherIncome, ownerNationalInsurance, ownerOtherDeductions, isChildcareHousehold } = input;

  // 事業所得 → 青色控除
  const adjustedIncome = Math.max(0, businessIncome - blueDeduction);

  // 給与所得控除
  const salaryAfterDeduction = calcSalaryIncome(ownerSalaryIncome, isChildcareHousehold, taxYear);

  // 年金雑所得（公的年金等控除後）
  const ownerOtherTotalIncome = adjustedIncome + salaryAfterDeduction + ownerOtherIncome;
  const pensionAfterDeduction = calcPensionIncome(ownerPensionIncome, input.ownerAge, ownerOtherTotalIncome);

  // 所得金額（事業所得 + 給与所得 + 年金雑所得 + 他の所得）
  const totalIncome = adjustedIncome + salaryAfterDeduction + pensionAfterDeduction + ownerOtherIncome;

  // 基礎控除
  const basicDeduction = calcBasicDeduction(totalIncome, taxYear);
  const totalDeductions = basicDeduction + ownerNationalInsurance + ownerOtherDeductions;
  // 課税所得は1,000円未満切り捨て
  const taxableIncome = Math.floor(Math.max(0, totalIncome - totalDeductions) / 1000) * 1000;

  // 所得税（復興特別税込み・100円未満切り捨て）
  const incomeTaxDetail = calcIncomeTaxWithDetail(taxableIncome);
  const incomeTax = incomeTaxDetail.total;

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

  // 配偶者計算（給与所得 = 青色事業専従者給与 + 他社給与）
  const spouseCalc = input.hasSpouse
    ? calcFamilyMemberTaxWithDetail(
        {
          ...input.spouse,
          salaryIncome: input.spouse.salaryIncome + input.spouseBusinessSalary,
        },
        isChildcareHousehold,
        taxYear
      )
    : null;
  const family: FamilyMemberResult[] = spouseCalc ? [spouseCalc.result] : [];

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
    spouseResult: spouseCalc?.result ?? null,
    spouseTaxDetail: spouseCalc?.taxDetail ?? null,
    family,
    combinedNetIncome,
    taxDetail: {
      salaryRevenue: ownerSalaryIncome,
      salaryAfterDeduction,
      pensionRevenue: ownerPensionIncome,
      pensionAfterDeduction,
      businessIncome: adjustedIncome,
      otherIncome: ownerOtherIncome,
      totalIncome,
      socialInsuranceDeduction: ownerNationalInsurance,
      otherDeductions: ownerOtherDeductions,
      basicDeduction,
      totalDeductions: basicDeduction + ownerNationalInsurance + ownerOtherDeductions,
      taxableIncome,
      incomeTaxRate: incomeTaxDetail.rate,
      incomeTaxRateDeduction: incomeTaxDetail.rateDeduction,
      incomeTaxBase: incomeTaxDetail.base,
      incomeTaxRecovery: incomeTaxDetail.recovery,
      incomeTax,
      residentTax,
      individualBusinessTax,
    },
    netIncomeDetail: {
      businessIncome: input.businessIncome,
      salaryRevenue: ownerSalaryIncome,
      pensionRevenue: ownerPensionIncome,
      otherIncome: ownerOtherIncome,
      totalRevenue: input.businessIncome + ownerSalaryIncome + ownerPensionIncome + ownerOtherIncome,
      incomeTax,
      residentTax,
      individualBusinessTax,
      socialInsurance: ownerNationalInsurance,
      totalDeductions: incomeTax + residentTax + individualBusinessTax + ownerNationalInsurance,
      netIncome,
    },
  };
}

// ============================================================
// 共通ヘルパー: 個人税計算
// ============================================================

interface IndivTaxInput {
  totalIncome: number;
  socialInsurance: number;
  otherDeductions: number;
  // 明細用の追加情報
  salaryRevenue: number;
  salaryAfterDeduction: number;
  pensionRevenue: number;
  pensionAfterDeduction: number;
  businessIncome: number;
  otherIncome: number;
}

interface IndivTaxResult {
  incomeTax: number;
  residentTax: number;
  taxTotal: number;
  detail: TaxDetailBreakdown;
}

function calcIndivTax(p: IndivTaxInput, individualBusinessTax: number = 0, taxYear: TaxYear = "R7"): IndivTaxResult {
  const basic = calcBasicDeduction(p.totalIncome, taxYear);
  const totalDeductions = basic + p.socialInsurance + p.otherDeductions;
  // 課税所得は1,000円未満切り捨て
  const taxable = Math.floor(Math.max(0, p.totalIncome - totalDeductions) / 1000) * 1000;
  const taxDetail = calcIncomeTaxWithDetail(taxable);
  const incomeTax = taxDetail.total;
  const residentTax = Math.floor(taxable * 0.1);

  const detail: TaxDetailBreakdown = {
    salaryRevenue: p.salaryRevenue,
    salaryAfterDeduction: p.salaryAfterDeduction,
    pensionRevenue: p.pensionRevenue,
    pensionAfterDeduction: p.pensionAfterDeduction,
    businessIncome: p.businessIncome,
    otherIncome: p.otherIncome,
    totalIncome: p.totalIncome,
    socialInsuranceDeduction: p.socialInsurance,
    otherDeductions: p.otherDeductions,
    basicDeduction: basic,
    totalDeductions,
    taxableIncome: taxable,
    incomeTaxRate: taxDetail.rate,
    incomeTaxRateDeduction: taxDetail.rateDeduction,
    incomeTaxBase: taxDetail.base,
    incomeTaxRecovery: taxDetail.recovery,
    incomeTax,
    residentTax,
    individualBusinessTax,
  };

  return { incomeTax, residentTax, taxTotal: incomeTax + residentTax, detail };
}

interface CorpSideResult {
  corporateIncome: number;
  corporateTax: number;
  corporateBusinessTax: number;
  corporateRetained: number;
  employeeEmployerSI: number;
  medicalSocialInsuranceIncome: number;
  corpTaxDetail: CorpTaxDetailBreakdown;
}

function calcCorpSide(
  revenue: number,
  salaries: number,
  ownerEmployerSI: number,
  rates: HojinnariRates,
  input: HojinnariInput
): CorpSideResult {
  // 従業員会社負担社会保険料（自動計算した料率を使用）
  const employeeRate = calcEmployeeInsuranceRate(rates);
  const employeeEmployerSI = Math.floor(input.employeeSalary * employeeRate);
  const totalEmployerSI = ownerEmployerSI + employeeEmployerSI;

  const corporateIncomeRaw = revenue - salaries - totalEmployerSI;
  // 法人所得は1,000円未満切り捨て（赤字の場合は0）
  const corporateIncome = Math.floor(Math.max(0, corporateIncomeRaw) / 1000) * 1000;

  // 医療法人: 社会保険分の所得金額を計算
  const medicalSocialInsuranceIncome = input.isMedicalCorporation
    ? calcSocialInsuranceIncome(corporateIncome, input.socialInsuranceMedicalRevenue, input.totalRevenue)
    : 0;

  const taxParts = calcCorporateTaxParts(corporateIncome, rates);
  const perCapitaLevy = input.perCapitaLevy;
  // 法人税合計 = 法人税(地方法人税含む) + 法人住民税(法人税割) + 均等割
  // 均等割は赤字でも発生（taxParts は赤字時に 0 を返すため自然に均等割のみとなる）
  const corporateTax = taxParts.corporateTaxBase + taxParts.residentTax + perCapitaLevy;
  const corporateBusinessTax = calcBusinessTax(
    corporateIncome,
    rates,
    input.isMedicalCorporation,
    medicalSocialInsuranceIncome
  );
  const corporateRetained = corporateIncomeRaw - corporateTax - corporateBusinessTax;

  const corpTaxDetail: CorpTaxDetailBreakdown = {
    revenue,
    salaries,
    employerSocialInsurance: totalEmployerSI,
    corporateIncome,
    corporateTaxRate: corporateIncome <= 8000000 ? "800万以下" : "800万超",
    corporateTaxBase: taxParts.corporateTaxBase,
    residentTax: taxParts.residentTax,
    perCapitaLevy,
    corporateTax,
    businessTax: corporateBusinessTax,
    corporateRetained,
  };

  return { corporateIncome, corporateTax, corporateBusinessTax, corporateRetained, employeeEmployerSI, medicalSocialInsuranceIncome, corpTaxDetail };
}

// ============================================================
// PLAN1: マイクロ法人成り
// ============================================================

export function calcPlan1(
  input: HojinnariInput,
  rates: HojinnariRates,
  taxYear: TaxYear = "R7"
): PlanResult {
  const {
    businessIncome, blueDeduction, ownerAge, ownerSalaryIncome, ownerPensionIncome, ownerOtherIncome, ownerOtherDeductions,
    isChildcareHousehold, plan1MicroRevenue, plan1MicroSalary, plan1SpouseSalary, isNonExecutive,
  } = input;

  const remainingBusiness = Math.max(0, businessIncome - plan1MicroRevenue);
  const adjustedIndividual = Math.max(0, remainingBusiness - blueDeduction);
  const salaryAfterDeduction = calcSalaryIncome(plan1MicroSalary + ownerSalaryIncome, isChildcareHousehold, taxYear);
  const otherTotalIncomeForPension = adjustedIndividual + salaryAfterDeduction + ownerOtherIncome;
  const pensionAfterDeduction = calcPensionIncome(ownerPensionIncome, ownerAge, otherTotalIncomeForPension);
  const individualTotalIncome = adjustedIndividual + salaryAfterDeduction + pensionAfterDeduction + ownerOtherIncome;

  const ownerSiOptions = {
    useIndustryInsurance: input.useIndustryInsurance,
    industryInsuranceMonthly: input.industryInsuranceMonthlyOwner,
  };
  const siBaseSalary = (isNonExecutive ?? true) ? plan1MicroSalary : plan1MicroSalary + ownerSalaryIncome;
  const si = calcSocialInsurancePair(siBaseSalary, ownerAge, rates, ownerSiOptions);
  const ownerSocialInsurance = si.owner;
  const employerSocialInsurance = si.employer;

  // 配偶者の社保（法人成り後は配偶者も社保加入）
  const spouseSi = (input.hasSpouse && plan1SpouseSalary > 0)
    ? calcSocialInsurancePair(plan1SpouseSalary, input.spouse.age, rates, {
        useIndustryInsurance: input.useIndustryInsurance,
        industryInsuranceMonthly: input.industryInsuranceMonthlySpouse,
      })
    : { owner: 0, employer: 0 };

  const individualBusinessTax = calcIndividualBusinessTax(adjustedIndividual);

  const tax = calcIndivTax({
    totalIncome: individualTotalIncome,
    socialInsurance: ownerSocialInsurance,
    otherDeductions: ownerOtherDeductions,
    salaryRevenue: plan1MicroSalary + ownerSalaryIncome,
    salaryAfterDeduction,
    pensionRevenue: ownerPensionIncome,
    pensionAfterDeduction,
    businessIncome: adjustedIndividual,
    otherIncome: ownerOtherIncome,
  }, individualBusinessTax, taxYear);

  const ownerNetIncome =
    remainingBusiness + plan1MicroSalary + ownerSalaryIncome + ownerPensionIncome + ownerOtherIncome -
    ownerSocialInsurance - tax.incomeTax - tax.residentTax - individualBusinessTax;

  // 配偶者の会社負担社保も法人側に乗せる
  const corp = calcCorpSide(
    plan1MicroRevenue,
    plan1MicroSalary + plan1SpouseSalary,
    employerSocialInsurance + spouseSi.employer,
    rates,
    input
  );

  // 配偶者: 給与は法人給与のみ・社保は法人成り後の計算値で上書き
  const spouseCalc = calcSpouseWithCorporateSalary(
    input,
    plan1SpouseSalary,
    isChildcareHousehold,
    taxYear,
    input.hasSpouse && plan1SpouseSalary > 0 ? spouseSi.owner : null
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
    spouseEmployeeSocialInsurance: spouseSi.owner,
    employerSocialInsurance: employerSocialInsurance + spouseSi.employer,
    employeeEmployerSocialInsurance: corp.employeeEmployerSI,
    totalSocialInsurance:
      ownerSocialInsurance + spouseSi.owner +
      employerSocialInsurance + spouseSi.employer +
      corp.employeeEmployerSI,
    corporateSalary: plan1MicroSalary,
    spouseSalary: plan1SpouseSalary,
    corporateRevenue: plan1MicroRevenue,
    ...corp,
    medicalSocialInsuranceIncome: corp.medicalSocialInsuranceIncome,
    ownerNetIncome,
    corporateNetIncome: corp.corporateRetained,
    combinedNetIncome: ownerNetIncome + corp.corporateRetained,
    spouseResult: spouseCalc?.result ?? null,
    spouseTaxDetail: spouseCalc?.taxDetail ?? null,
    taxDetail: tax.detail,
    corpTaxDetail: corp.corpTaxDetail,
    netIncomeDetail: {
      businessIncome: remainingBusiness,
      salaryRevenue: plan1MicroSalary + ownerSalaryIncome,
      pensionRevenue: ownerPensionIncome,
      otherIncome: ownerOtherIncome,
      totalRevenue: remainingBusiness + plan1MicroSalary + ownerSalaryIncome + ownerPensionIncome + ownerOtherIncome,
      incomeTax: tax.incomeTax,
      residentTax: tax.residentTax,
      individualBusinessTax,
      socialInsurance: ownerSocialInsurance,
      totalDeductions: tax.incomeTax + tax.residentTax + individualBusinessTax + ownerSocialInsurance,
      netIncome: ownerNetIncome,
    },
  };
}

/**
 * 法人成り後の配偶者計算用ヘルパー。
 * 給与収入は法人からの給与のみで計算（既存の給与収入・国保は引き継がない）。
 * - 配偶者が法人給与を受け取る場合: 社保（厚年＋健保 or 業種別国保）を上書きで渡す
 * - 受け取らない場合: 役員（事業主）が社保加入のため配偶者は被扶養者扱い → 社保=0
 */
function calcSpouseWithCorporateSalary(
  input: HojinnariInput,
  corporateSpouseSalary: number,
  isChildcareHousehold: boolean,
  taxYear: TaxYear,
  spouseSocialInsuranceOverride: number | null = null
): { result: FamilyMemberResult; taxDetail: TaxDetailBreakdown } | null {
  if (!input.hasSpouse) { return null; }
  const adjustedSpouse: FamilyMember = {
    ...input.spouse,
    // 法人成り後は法人からの給与のみ（既存給与は加算しない）
    salaryIncome: corporateSpouseSalary,
    // 法人成り後は現状の国保(input.spouse.socialInsurance)を引き継がない。
    // 上書き値があれば社保（法人社保）、なければ 0（被扶養者）。
    socialInsurance: spouseSocialInsuranceOverride ?? 0,
  };
  return calcFamilyMemberTaxWithDetail(adjustedSpouse, isChildcareHousehold, taxYear);
}

// ============================================================
// PLAN2: 完全法人成り
// ============================================================

export function calcPlan2(
  input: HojinnariInput,
  rates: HojinnariRates,
  taxYear: TaxYear = "R7"
): PlanResult {
  const {
    businessIncome, ownerAge, ownerSalaryIncome, ownerPensionIncome, ownerOtherIncome, ownerOtherDeductions,
    isChildcareHousehold, plan2Salary, plan2SpouseSalary, isNonExecutive,
  } = input;

  const salaryAfterDeduction = calcSalaryIncome(plan2Salary + ownerSalaryIncome, isChildcareHousehold, taxYear);
  const otherTotalIncomeForPension = salaryAfterDeduction + ownerOtherIncome;
  const pensionAfterDeduction = calcPensionIncome(ownerPensionIncome, ownerAge, otherTotalIncomeForPension);
  const individualTotalIncome = salaryAfterDeduction + pensionAfterDeduction + ownerOtherIncome;

  const ownerSiOptions = {
    useIndustryInsurance: input.useIndustryInsurance,
    industryInsuranceMonthly: input.industryInsuranceMonthlyOwner,
  };
  // 非常勤役員: 役員報酬のみで標準報酬月額を算定（他社給与を合算しない）
  // 通常役員: 他社給与を合算して標準報酬月額を算定
  const siBaseSalary = (isNonExecutive ?? true) ? plan2Salary : plan2Salary + ownerSalaryIncome;
  const si = calcSocialInsurancePair(siBaseSalary, ownerAge, rates, ownerSiOptions);
  const ownerSocialInsurance = si.owner;
  const employerSocialInsurance = si.employer;

  // 配偶者の社保（法人成り後は配偶者も社保加入）
  const spouseSi = (input.hasSpouse && plan2SpouseSalary > 0)
    ? calcSocialInsurancePair(plan2SpouseSalary, input.spouse.age, rates, {
        useIndustryInsurance: input.useIndustryInsurance,
        industryInsuranceMonthly: input.industryInsuranceMonthlySpouse,
      })
    : { owner: 0, employer: 0 };

  const tax = calcIndivTax({
    totalIncome: individualTotalIncome,
    socialInsurance: ownerSocialInsurance,
    otherDeductions: ownerOtherDeductions,
    salaryRevenue: plan2Salary + ownerSalaryIncome,
    salaryAfterDeduction,
    pensionRevenue: ownerPensionIncome,
    pensionAfterDeduction,
    businessIncome: 0,
    otherIncome: ownerOtherIncome,
  }, 0, taxYear);

  const ownerNetIncome = plan2Salary + ownerSalaryIncome + ownerPensionIncome + ownerOtherIncome -
    ownerSocialInsurance - tax.incomeTax - tax.residentTax;

  // 完全法人成り: 個人事業の青色事業専従者給与は経費から外れるため、
  // 役員報酬支払前の法人所得は businessIncome + spouseBusinessSalary
  const preSalaryCorpIncome =
    businessIncome + (input.hasSpouse ? input.spouseBusinessSalary : 0);
  // 配偶者の会社負担社保も法人側に乗せる
  const corp = calcCorpSide(
    preSalaryCorpIncome,
    plan2Salary + plan2SpouseSalary,
    employerSocialInsurance + spouseSi.employer,
    rates,
    input
  );

  // 配偶者: 給与は法人給与のみ・社保は法人成り後の計算値で上書き
  const spouseCalc = calcSpouseWithCorporateSalary(
    input,
    plan2SpouseSalary,
    isChildcareHousehold,
    taxYear,
    input.hasSpouse && plan2SpouseSalary > 0 ? spouseSi.owner : null
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
    spouseEmployeeSocialInsurance: spouseSi.owner,
    employerSocialInsurance: employerSocialInsurance + spouseSi.employer,
    employeeEmployerSocialInsurance: corp.employeeEmployerSI,
    totalSocialInsurance:
      ownerSocialInsurance + spouseSi.owner +
      employerSocialInsurance + spouseSi.employer +
      corp.employeeEmployerSI,
    corporateSalary: plan2Salary,
    spouseSalary: plan2SpouseSalary,
    corporateRevenue: businessIncome,
    ...corp,
    medicalSocialInsuranceIncome: corp.medicalSocialInsuranceIncome,
    ownerNetIncome,
    corporateNetIncome: corp.corporateRetained,
    combinedNetIncome: ownerNetIncome + corp.corporateRetained,
    spouseResult: spouseCalc?.result ?? null,
    spouseTaxDetail: spouseCalc?.taxDetail ?? null,
    taxDetail: tax.detail,
    corpTaxDetail: corp.corpTaxDetail,
    netIncomeDetail: {
      businessIncome: 0,
      salaryRevenue: plan2Salary + ownerSalaryIncome,
      pensionRevenue: ownerPensionIncome,
      otherIncome: ownerOtherIncome,
      totalRevenue: plan2Salary + ownerSalaryIncome + ownerPensionIncome + ownerOtherIncome,
      incomeTax: tax.incomeTax,
      residentTax: tax.residentTax,
      individualBusinessTax: 0,
      socialInsurance: ownerSocialInsurance,
      totalDeductions: tax.incomeTax + tax.residentTax + ownerSocialInsurance,
      netIncome: ownerNetIncome,
    },
  };
}

// ============================================================
// 旧互換用 calcCorporate (シンプルな法人計算)
// ============================================================

export function calcCorporate(
  input: HojinnariInput,
  rates: HojinnariRates,
  taxYear: TaxYear = "R7"
): CorporateResult {
  const {
    businessIncome, plan2Salary, plan2SpouseSalary, ownerAge,
    isChildcareHousehold, ownerOtherDeductions,
  } = input;
  const totalSalaryPaid = plan2Salary + plan2SpouseSalary;
  const corporateIncome = Math.max(0, businessIncome - totalSalaryPaid);
  const corporateTax = calcCorporateTaxHojinnari(corporateIncome, rates);
  const businessTax = calcBusinessTax(corporateIncome, rates);
  const corporateRetained = corporateIncome - corporateTax - businessTax;
  const ownerSalaryAfterDeduction = calcSalaryIncome(plan2Salary, isChildcareHousehold, taxYear);
  const ownerSocialInsurance = calcSocialInsurancePair(plan2Salary, ownerAge, rates).owner;
  const ownerBasicDeduction = calcBasicDeduction(ownerSalaryAfterDeduction, taxYear);
  const ownerTaxableIncome = Math.max(
    0,
    ownerSalaryAfterDeduction - ownerBasicDeduction - ownerSocialInsurance - ownerOtherDeductions
  );
  const ownerIncomeTax = calcIncomeTaxWithDetail(ownerTaxableIncome).total;
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
  rates: HojinnariRates,
  taxYear: TaxYear = "R7"
): HojinnariResult {
  const individual = calcIndividual(input, taxYear);
  const plan1 = calcPlan1(input, rates, taxYear);
  const plan2 = calcPlan2(input, rates, taxYear);
  const corporate = calcCorporate(input, rates, taxYear);
  const difference = plan2.combinedNetIncome - individual.netIncome;

  return { individual, plan1, plan2, corporate, difference };
}

// ============================================================
// 決算対策の反映
// ============================================================

/** 決算対策の集計値（決算対策テーブルから合計したもの） */
export interface DecisionTotals {
  corporateExpense: number;        // 法人支出額（合計）
  taxDeductible: number;           // 損金算入額（合計）
  personalIncomeIncrease: number;  // 個人手取り増加（合計）
}

/** 決算対策反映後のプラン結果 */
export interface AdjustedPlanResult {
  corporateIncome: number;          // 対策反映後の法人所得（1,000円未満切捨後）
  corporateTax: number;             // 対策反映後の法人税合計（均等割含む）
  corporateBusinessTax: number;     // 対策反映後の法人事業税
  corporateNet: number;             // 対策反映後の法人手取り（内部留保）
  personalNet: number;              // 対策反映後の個人手取り
  combinedNet: number;              // 対策反映後の合算CF手取り
}

/**
 * 決算対策を「法人成り後」の値に反映:
 *   - 法人所得 = 法人所得 − 損金算入額（再計算で法人税・事業税が減少）
 *   - 法人手取額 = 法人手取額 − 法人支出額 + (法人税・事業税の減少額)
 *   - 個人手取額 = 個人手取額 + 個人手取り増加分
 *   - 合算手取額 = 個人手取額 + 法人手取額（再計算後）
 */
export function applyDecisionMeasures(
  planResult: PlanResult,
  totals: DecisionTotals,
  input: HojinnariInput,
  rates: HojinnariRates
): AdjustedPlanResult {
  const newCorporateIncome =
    Math.floor(Math.max(0, planResult.corporateIncome - totals.taxDeductible) / 1000) * 1000;

  const newSocialInsuranceIncome = input.isMedicalCorporation
    ? calcSocialInsuranceIncome(newCorporateIncome, input.socialInsuranceMedicalRevenue, input.totalRevenue)
    : 0;

  // calcCorporateTaxHojinnari は 法人税+地方法人税+法人住民税(法人税割) を返す。
  // 均等割は赤字でも発生する固定額なので、ここで加算して planResult.corporateTax と整合させる
  const newCorporateTax =
    calcCorporateTaxHojinnari(newCorporateIncome, rates) + input.perCapitaLevy;
  const newBusinessTax = calcBusinessTax(
    newCorporateIncome,
    rates,
    input.isMedicalCorporation,
    newSocialInsuranceIncome
  );

  const taxSavings =
    planResult.corporateTax + planResult.corporateBusinessTax - (newCorporateTax + newBusinessTax);

  const corporateNet = planResult.corporateRetained - totals.corporateExpense + taxSavings;
  const personalNet = planResult.ownerNetIncome + totals.personalIncomeIncrease;
  const combinedNet = personalNet + corporateNet;

  return {
    corporateIncome: newCorporateIncome,
    corporateTax: newCorporateTax,
    corporateBusinessTax: newBusinessTax,
    corporateNet,
    personalNet,
    combinedNet,
  };
}

/** 決算対策テーブル要素の配列から DecisionTotals を集計する */
export function sumDecisionMeasures(
  measures: { corporateExpense: number; taxDeductible: number; personalIncomeIncrease: number }[]
): DecisionTotals {
  return (measures ?? []).reduce(
    (acc, m) => ({
      corporateExpense: acc.corporateExpense + m.corporateExpense,
      taxDeductible: acc.taxDeductible + m.taxDeductible,
      personalIncomeIncrease: acc.personalIncomeIncrease + m.personalIncomeIncrease,
    }),
    { corporateExpense: 0, taxDeductible: 0, personalIncomeIncrease: 0 }
  );
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
  step = 1000000,
  taxYear: TaxYear = "R7"
): OptimizationPoint[] {
  const results: OptimizationPoint[] = [];
  const max = input.businessIncome;

  for (let salary = 0; salary <= max; salary += step) {
    const modified = { ...input, plan2Salary: salary };
    const plan2 = calcPlan2(modified, rates, taxYear);
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
  step = 1000000,
  taxYear: TaxYear = "R7"
): number {
  const points = optimizePlan2Salary(input, rates, step, taxYear);
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
  step = 1000000,
  taxYear: TaxYear = "R7"
): MicroOptPoint[] {
  const results: MicroOptPoint[] = [];
  const maxRevenue = input.businessIncome;

  for (let microRevenue = 0; microRevenue <= maxRevenue; microRevenue += step) {
    const modified = { ...input, plan1MicroRevenue: microRevenue };
    const plan1 = calcPlan1(modified, rates, taxYear);
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
  step = 1000000,
  taxYear: TaxYear = "R7"
): OptimizationPoint[] {
  return optimizePlan2Salary(input, rates, step, taxYear);
}
export function findOptimalSalary(
  input: HojinnariInput,
  rates: HojinnariRates,
  step = 1000000,
  taxYear: TaxYear = "R7"
): number {
  return findOptimalPlan2Salary(input, rates, step, taxYear);
}
