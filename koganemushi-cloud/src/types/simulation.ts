/** 料率設定パラメータ */
export interface RateSettings {
  /** 健康保険料率 (例: 0.0991) */
  healthInsuranceRate: number;
  /** 介護保険料率 (例: 0.0159) */
  nursingCareRate: number;
  /** 厚生年金保険料率 (例: 0.183) */
  pensionRate: number;
  /** 子ども・子育て支援金率（労使折半、例: 0.0023） */
  childcareSupportRate: number;
  /** 子ども・子育て拠出金率（会社のみ、例: 0.0036） */
  childcareContributionRate: number;
  /** 健保・介護 標準賞与額上限（年間・円） */
  healthBonusAnnualCap: number;
  /** 厚生年金 標準賞与額上限（月間・円） */
  pensionBonusPerPaymentCap: number;
}

/** 法人税関連パラメータ */
export interface CorporateTaxParams {
  /** 役員報酬支払前法人所得 */
  preTaxCorporateIncome: number;
  /** 均等割 */
  perCapitaLevy: number;
  /** 繰越欠損金 */
  carryForwardLoss: number;
}

/** 法人税実効税率 */
export interface EffectiveTaxRates {
  /** 400万円以下の実効税率 */
  rateBelow4M: number;
  /** 800万円以下の実効税率 */
  rateBelow8M: number;
  /** 800万円超の実効税率 */
  rateAbove8M: number;
}

/** 役員1名の入力データ */
export interface ExecutiveInput {
  /** 役員名 */
  name: string;
  /** 年齢 */
  age: number;
  /** 定期同額給与（年間） */
  regularSalary: number;
  /** 事前確定給与1回目 */
  predeterminedBonus1: number;
  /** 事前確定給与2回目 */
  predeterminedBonus2: number;
  /** 事前確定給与3回目 */
  predeterminedBonus3: number;
  /** 他の給与収入 */
  otherSalaryIncome: number;
  /** 確定給付年金掛金 */
  definedBenefitPension: number;
  /** 配当所得 */
  dividendIncome: number;
  /** 他の所得金額 */
  otherIncome: number;
  /** 他の所得控除額 */
  otherDeductions: number;
  /** 税額控除 */
  taxCredit: number;
  /** 社会保険加入フラグ */
  socialInsuranceEnrolled: boolean;
  /** 子育て介護世帯フラグ */
  childcareHousehold: boolean;
  /** 健康保険任意入力フラグ */
  manualHealthInsurance: boolean;
  /** 健康保険料（任意入力時の値） */
  manualHealthInsuranceAmount: number;
  /** 変更前月額報酬（円） */
  preChangeMonthlyRemuneration: number;
  /** 変更後月額報酬（円） */
  postChangeMonthlyRemuneration: number;
  /** 標準報酬改定月（1〜13、1=期首から改定後月額を使用） */
  standardRemunerationChangeMonth: number;
}

/** 役員1名の計算結果 */
export interface ExecutiveResult {
  /** 給与収入合計 */
  totalSalaryIncome: number;
  /** 給与所得金額 */
  salaryIncomeAfterDeduction: number;
  /** 合計所得金額 */
  totalIncome: number;
  /** 社会保険料控除額 */
  socialInsuranceDeduction: number;
  /** 基礎控除額 */
  basicDeduction: number;
  /** 課税所得金額 */
  taxableIncome: number;
  /** 所得税 */
  incomeTax: number;
  /** 配当控除額（所得税） */
  dividendCreditIncomeTax: number;
  /** 住民税 */
  residentTax: number;
  /** 配当控除額（住民税） */
  dividendCreditResidentTax: number;
  /** 個人税金合計 */
  totalPersonalTax: number;
  /** 健康保険料 */
  healthInsurance: number;
  /** 厚生年金保険料 */
  pensionInsurance: number;
  /** 社会保険料計 */
  totalSocialInsurance: number;
  /** 税金＋社会保険料 */
  totalTaxAndInsurance: number;
  /** 手取り額 */
  netIncome: number;
  /** 会社負担社会保険料 */
  employerSocialInsurance: number;
  /** 社会保険料合計（個人＋会社） */
  totalSocialInsuranceCombined: number;
}

/** シミュレーション全体の結果 */
export interface SimulationResult {
  /** 各役員の計算結果 */
  executives: ExecutiveResult[];
  /** 合計 */
  totals: ExecutiveResult;
  /** 法人税（現状/比較で個別計算） */
  corporateTax: number;
  /** 法人税金合計 */
  corporateTaxTotal: number;
}

/** シミュレーションデータ全体 */
export interface SimulationData {
  /** 料率設定 */
  rates: RateSettings;
  /** 法人税パラメータ */
  corporateTaxParams: CorporateTaxParams;
  /** 法人税実効税率 */
  effectiveTaxRates: EffectiveTaxRates;
  /** 現状の役員データ */
  currentExecutives: ExecutiveInput[];
  /** 比較用の役員データ */
  comparisonExecutives: ExecutiveInput[];
  /** 他の給与社保合算フラグ（1人目のみ） */
  combineOtherSalaryForInsurance: boolean;
}
