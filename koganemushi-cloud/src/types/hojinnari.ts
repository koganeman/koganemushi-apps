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
  childCount: 0 | 1 | 2;
  children: [FamilyMember, FamilyMember];

  // PLAN1: マイクロ法人成り
  plan1MicroRevenue: number;    // 法人に移転する売上
  plan1MicroSalary: number;     // マイクロ法人からの役員報酬（年額）
  plan1SpouseSalary: number;    // 配偶者への法人給与

  // PLAN2: 完全法人成り
  plan2Salary: number;          // 役員報酬（年額）
  plan2SpouseSalary: number;    // 配偶者への給与

  // 医療法人
  isMedicalCorporation: boolean;          // 医療法人フラグ
  socialInsuranceMedicalRevenue: number;  // 社会保険分医業収入
  totalRevenue: number;                   // 総収入金額

  // 従業員
  employeeSalary: number;  // 年間従業員給料額

  // 決算対策
  decisionMeasures: DecisionMeasure[];
}

/** 料率・税率設定 */
export interface HojinnariRates {
  // 社会保険料率（法人役員向け）
  healthInsuranceRate: number;     // 健康保険料率（例: 0.0991）
  nursingCareRate: number;         // 介護保険料率（例: 0.018）
  pensionRate: number;             // 厚生年金料率（例: 0.183）
  // 法人税
  corporateTaxRate1: number;       // 法人税率① 800万以下（例: 0.15）
  corporateTaxRate2: number;       // 法人税率② 800万超（例: 0.23）
  localCorpTaxRate: number;        // 地方法人特別税率（例: 0.104）
  // 事業税（一般）
  businessTaxRate1: number;        // 事業税率① 400万以下（例: 0.07）
  businessTaxRate2: number;        // 事業税率② 400〜800万（例: 0.085）
  businessTaxRate3: number;        // 事業税率③ 800万超（例: 0.10）
  localBusinessTaxRate: number;    // 事業税 地方特別税率（例: 0.375）
  // 事業税（医療法人）
  medicalBusinessTaxRate1: number; // 医療法人事業税率① 400万以下（例: 0.035）
  medicalBusinessTaxRate2: number; // 医療法人事業税率② 400〜800万（例: 0.049）
  medicalBusinessTaxRate3: number; // 医療法人事業税率③ 800万超（例: 0.07）
  // 従業員社会保険
  employeeInsuranceRate: number;   // 従業員会社負担保険料率（例: 0.153）
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
  // 家族合計
  family: FamilyMemberResult[];  // 各家族メンバーの結果
  combinedNetIncome: number;     // 家族合算手取り
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
  ownerSocialInsurance: number;        // 役員負担分（協会けんぽ）
  employerSocialInsurance: number;     // 会社負担分（役員分）
  employeeEmployerSocialInsurance: number; // 会社負担分（従業員分）
  totalSocialInsurance: number;        // 社保計
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

/** シミュレーション全体の計算結果 */
export interface HojinnariResult {
  individual: IndividualResult;
  plan1: PlanResult;
  plan2: PlanResult;
  // 旧互換用
  corporate: CorporateResult;
  difference: number;
}
