// ============================================================
// 法人なりシミュレーション 型定義
// ============================================================

/** 法人成り後の決算対策 */
export interface DecisionMeasure {
  name: string;                    // 項目名
  corporateExpense: number;        // 法人支出額
  taxDeductible: number;           // 損金算入額
  personalIncomeIncrease: number;  // 個人手取り増加
  hiddenAssetIncrease: number;     // 法人の簿外資産
}

/** 家族構成員（配偶者・子供）の入力 */
export interface FamilyMember {
  age: number;             // 年齢
  salaryIncome: number;    // 給与収入
  pensionIncome: number;   // 年金収入
  otherIncome: number;     // その他所得
  socialInsurance: number; // 社会保険料控除額（国保等）
  otherDeductions: number; // その他所得控除
}

/** 家族構成員の税計算結果 */
export interface FamilyMemberResult {
  salaryIncome: number;
  salaryAfterDeduction: number; // 給与所得控除後
  pensionIncome: number;
  pensionAfterDeduction: number;  // 年金雑所得（公的年金等控除後）
  otherIncome: number;
  totalIncome: number;          // 所得金額
  socialInsurance: number;
  otherDeductions: number;
  basicDeduction: number;
  totalDeductions: number;      // 所得控除合計
  taxableIncome: number;        // 課税所得
  incomeTax: number;            // 所得税
  residentTax: number;          // 住民税
  taxTotal: number;             // 個人税金合計
  netIncome: number;            // 手取り額
}

/** シミュレーション入力 */
export interface HojinnariInput {
  // 個人事業主（現状・事業主）
  businessIncome: number;           // 事業所得（売上 - 経費）
  blueDeduction: number;            // 青色申告特別控除
  ownerAge: number;                 // 代表者年齢
  ownerNationalInsurance: number;   // 国保 + 国民年金（年額）
  ownerSalaryIncome: number;        // 給与収入
  ownerPensionIncome: number;       // 年金収入
  ownerOtherIncome: number;         // 他の所得金額
  ownerOtherDeductions: number;     // その他所得控除（生保控除等）
  isChildcareHousehold: boolean;    // 子育て・介護世帯

  // 家族構成
  hasSpouse: boolean;
  spouse: FamilyMember;
  // 配偶者の青色事業専従者給与（事業主の事業から）。
  // 事業所得(input.businessIncome)からは既に控除済として扱う。
  // 法人成り(完全法人成り)時はこの金額を法人所得に加算する。
  spouseBusinessSalary: number;

  // PLAN1: マイクロ法人成り
  plan1MicroRevenue: number;    // 法人に移転する売上
  plan1MicroSalary: number;     // マイクロ法人からの役員報酬（年額）
  plan1SpouseSalary: number;    // 配偶者への法人給与
  plan1SpouseIsDependent: boolean; // 配偶者は事業主の扶養に入る（社保非加入）

  // PLAN2: 完全法人成り
  plan2Salary: number;          // 役員報酬（年額）
  plan2SpouseSalary: number;    // 配偶者への給与
  plan2SpouseIsDependent: boolean; // 配偶者は事業主の扶養に入る（社保非加入）

  // 非常勤役員フラグ（true: 他社給与を標準報酬に合算しない）
  isNonExecutive: boolean;

  // 医療法人
  isMedicalCorporation: boolean;          // 医療法人フラグ
  socialInsuranceMedicalRevenue: number;  // 社会保険分医業収入
  totalRevenue: number;                   // 総収入金額

  // 従業員
  employeeSalary: number;  // 年間従業員給料額

  // 業種別国保パターン（健保のみ国保固定額・厚年は通常加入）
  useIndustryInsurance: boolean;
  industryInsuranceMonthlyOwner: number;   // 事業主（役員）の業種別国保 月額
  industryInsuranceMonthlySpouse: number;  // 配偶者の業種別国保 月額

  // 法人住民税 均等割（年額・円、例: 70,000）
  perCapitaLevy: number;
}

/** 料率・税率設定 */
export interface HojinnariRates {
  // 社会保険料率（法人役員向け）
  healthInsuranceRate: number;     // 健康保険料率（例: 0.0985）
  nursingCareRate: number;         // 介護保険料率（例: 0.0162）
  pensionRate: number;             // 厚生年金料率（例: 0.183）
  childcareSupportRate: number;    // 子ども・子育て支援金率（労使折半、例: 0.0023）
  childcareContributionRate: number; // 子ども・子育て拠出金率（会社のみ、例: 0.0036）
  // 法人税
  corporateTaxRate1: number;       // 法人税率① 800万以下（例: 0.15）
  corporateTaxRate2: number;       // 法人税率② 800万超（例: 0.23）
  localCorpTaxRate: number;        // 地方法人特別税率（例: 0.104）
  // 法人住民税（法人税割）
  prefecturalTaxRate1: number;     // 都道府県民税率①（標準・例: 0.01）
  prefecturalTaxRate2: number;     // 都道府県民税率②（超過・参考表示用、例: 0.018）
  municipalTaxRate: number;        // 市町村民税率（例: 0.06）
  // 事業税（一般）
  businessTaxRate1: number;        // 事業税率① 400万以下（例: 0.07）
  businessTaxRate2: number;        // 事業税率② 400〜800万（例: 0.085）
  businessTaxRate3: number;        // 事業税率③ 800万超（例: 0.10）
  localBusinessTaxRate: number;    // 事業税 地方特別税率（例: 0.375）
  // 事業税（医療法人）
  medicalBusinessTaxRate1: number; // 医療法人事業税率① 400万以下（例: 0.035）
  medicalBusinessTaxRate2: number; // 医療法人事業税率② 400〜800万（例: 0.049）
  medicalBusinessTaxRate3: number; // 医療法人事業税率③ 800万超（例: 0.07）
  // 従業員社会保険（自動計算: 健康保険+介護+年金+支援金+拠出金の会社負担）
  // employeeInsuranceRate は rates から自動算出
}

/** 現状（個人事業主）の計算結果 */
export interface IndividualResult {
  // 事業主
  businessIncome: number;
  blueDeduction: number;
  adjustedIncome: number;
  salaryAfterDeduction: number;  // 給与所得控除後
  pensionAfterDeduction: number; // 年金雑所得（公的年金等控除後）
  totalIncome: number;
  nationalInsurance: number;
  otherDeductions: number;
  basicDeduction: number;
  totalDeductions: number;
  taxableIncome: number;
  incomeTax: number;
  residentTax: number;
  taxTotal: number;
  individualBusinessTax: number; // 個人事業税
  netIncome: number;
  // 配偶者
  spouseResult: FamilyMemberResult | null;     // 配偶者の計算結果（hasSpouse=falseのときnull）
  spouseTaxDetail: TaxDetailBreakdown | null;  // 配偶者の計算明細
  // 家族合計
  family: FamilyMemberResult[];  // 各家族メンバーの結果（現状は配偶者のみ）
  combinedNetIncome: number;     // 家族合算手取り
  // 計算明細
  taxDetail: TaxDetailBreakdown;
  netIncomeDetail: NetIncomeDetailBreakdown;
}

/** プラン計算結果（PLAN1/PLAN2共通） */
export interface PlanResult {
  // 個人側（事業主）
  individualBusinessIncome: number;    // 個人側事業所得（PLAN1は残余、PLAN2は0）
  individualAdjustedIncome: number;    // 青色控除後
  individualSalaryIncome: number;      // 役員報酬（給与収入として）
  individualSalaryAfterDeduction: number; // 給与所得控除後
  individualTotalIncome: number;       // 所得金額（事業+給与）
  individualIncomeTax: number;         // 個人所得税
  individualResidentTax: number;       // 住民税
  individualBusinessTax: number;       // 個人事業税
  individualTaxTotal: number;          // 個人税金合計
  // 社会保険
  ownerSocialInsurance: number;        // 役員（事業主）負担分
  spouseEmployeeSocialInsurance: number; // 配偶者（従業員）負担分（法人成り後）
  employerSocialInsurance: number;     // 会社負担分（役員＋配偶者）
  employeeEmployerSocialInsurance: number; // 会社負担分（その他従業員分）
  totalSocialInsurance: number;        // 社保計（個人＋会社、全員分）
  // 法人側
  corporateSalary: number;             // 役員報酬（法人が支払う）
  spouseSalary: number;                // 配偶者給与
  corporateRevenue: number;            // 法人売上（移転した売上）
  corporateIncome: number;             // 法人所得
  corporateTax: number;                // 法人税
  corporateBusinessTax: number;        // 法人事業税
  corporateRetained: number;           // 法人内部留保（法人手取り）
  medicalSocialInsuranceIncome: number; // 社会保険分の所得金額（医療法人）
  // 手取り
  ownerNetIncome: number;              // 役員手取り
  corporateNetIncome: number;          // 法人手取り（内部留保）
  combinedNetIncome: number;           // 合算CF手取り（役員+法人）
  // 配偶者（法人成り後・配偶者給与受取後）
  spouseResult: FamilyMemberResult | null;     // 配偶者の計算結果
  spouseTaxDetail: TaxDetailBreakdown | null;  // 配偶者の計算明細
  // 計算明細
  taxDetail: TaxDetailBreakdown;
  corpTaxDetail: CorpTaxDetailBreakdown;
  netIncomeDetail: NetIncomeDetailBreakdown;
}

/** 旧互換用: 法人の計算結果 */
export interface CorporateResult {
  corporateIncome: number;
  corporateTax: number;
  businessTax: number;
  corporateRetained: number;
  ownerSalary: number;
  ownerSalaryAfterDeduction: number;
  ownerSocialInsurance: number;
  ownerBasicDeduction: number;
  ownerOtherDeductions: number;
  ownerTaxableIncome: number;
  ownerIncomeTax: number;
  ownerResidentTax: number;
  ownerNetIncome: number;
  totalNetIncome: number;
}

/** 個人所得税・住民税の計算明細 */
export interface TaxDetailBreakdown {
  // 収入・所得金額
  salaryRevenue: number;              // 給与収入
  salaryAfterDeduction: number;       // 給与所得金額
  pensionRevenue: number;             // 年金収入
  pensionAfterDeduction: number;      // 年金雑所得
  businessIncome: number;             // 事業所得（青色控除後）
  otherIncome: number;                // 他の所得金額
  totalIncome: number;                // 所得金額（合計）
  // 所得控除
  socialInsuranceDeduction: number;   // 社会保険料控除額
  otherDeductions: number;            // その他所得控除
  basicDeduction: number;             // 基礎控除
  totalDeductions: number;            // 所得控除合計
  // 税金計算
  taxableIncome: number;              // 課税所得金額
  incomeTaxRate: number;              // 適用税率
  incomeTaxRateDeduction: number;     // 税率控除額
  incomeTaxBase: number;              // 所得税額（基本）
  incomeTaxRecovery: number;          // 復興特別所得税
  incomeTax: number;                  // 所得税（100円未満切り捨て）
  residentTax: number;                // 住民税
  // 個人事業税
  individualBusinessTax: number;      // 個人事業税
}

/** 法人税の計算明細 */
export interface CorpTaxDetailBreakdown {
  // 法人所得
  revenue: number;                    // 法人売上
  salaries: number;                   // 役員報酬＋配偶者給与
  employerSocialInsurance: number;    // 社保会社負担（役員＋従業員）
  corporateIncome: number;            // 法人所得（1,000円未満切り捨て後）
  // 法人税
  corporateTaxRate: string;           // 適用区分（"800万以下" or "800万超"）
  corporateTaxBase: number;           // 法人税（地方法人税含む）
  residentTax: number;                // 法人住民税（法人税割）
  perCapitaLevy: number;              // 均等割
  corporateTax: number;               // 法人税合計（=corporateTaxBase + residentTax + perCapitaLevy）
  // 法人事業税
  businessTax: number;                // 法人事業税
  // 内部留保
  corporateRetained: number;          // 法人内部留保
}

/** 手取り額の計算明細 */
export interface NetIncomeDetailBreakdown {
  // 収入合計
  businessIncome: number;             // 事業所得（事業収入そのもの、青色控除前）
  salaryRevenue: number;              // 給与収入
  pensionRevenue: number;             // 年金収入
  otherIncome: number;                // 他の所得
  totalRevenue: number;               // 収入合計
  // 控除項目
  incomeTax: number;                  // 所得税
  residentTax: number;                // 住民税
  individualBusinessTax: number;      // 個人事業税
  socialInsurance: number;            // 社会保険料
  totalDeductions: number;            // 控除合計
  // 手取り
  netIncome: number;                  // 手取り額
}

/** シミュレーション全体の計算結果 */
export interface HojinnariResult {
  individual: IndividualResult;
  plan1: PlanResult;
  plan2: PlanResult;
  // 旧互換用
  corporate: CorporateResult;
  difference: number;
}
