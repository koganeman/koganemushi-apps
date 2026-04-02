// ============================================================
// 法人なりシミュレーション 型定義
// ============================================================

/** シミュレーション入力 */
export interface HojinnariInput {
  businessIncome: number;          // 事業所得（売上 - 経費）
  blueDeduction: number;           // 青色申告特別控除（0/100000/550000/650000）
  spouseExpense: number;           // 専従者給与（個人側）
  ownerAge: number;                // 代表者年齢
  ownerNationalInsurance: number;  // 国保 + 国民年金（手入力）
  ownerOtherDeductions: number;    // その他所得控除（生保控除等）
  isChildcareHousehold: boolean;   // 子育て介護世帯
  corporateSalary: number;         // 役員給与（法人）
  spouseSalary: number;            // 専従者給与（法人側）
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
  // 事業税
  businessTaxRate1: number;        // 事業税率① 400万以下（例: 0.07）
  businessTaxRate2: number;        // 事業税率② 400〜800万（例: 0.085）
  businessTaxRate3: number;        // 事業税率③ 800万超（例: 0.10）
  localBusinessTaxRate: number;    // 事業税 地方特別税率（例: 0.375）
}

/** 個人事業主の計算結果 */
export interface IndividualResult {
  businessIncome: number;          // 事業所得（入力値）
  blueDeduction: number;           // 青色申告特別控除
  spouseExpense: number;           // 専従者給与
  adjustedIncome: number;          // 調整後所得（青色控除・専従者給与控除後）
  basicDeduction: number;          // 基礎控除
  otherDeductions: number;         // その他控除（入力値）
  nationalInsurance: number;       // 国保 + 国民年金（入力値）
  taxableIncome: number;           // 課税所得
  incomeTax: number;               // 所得税（復興特別税込み）
  residentTax: number;             // 住民税
  netIncome: number;               // 手取り
}

/** 法人の計算結果 */
export interface CorporateResult {
  corporateIncome: number;         // 法人所得（事業所得 - 役員給与）
  corporateTax: number;            // 法人税
  businessTax: number;             // 事業税
  corporateRetained: number;       // 法人内部留保
  ownerSalary: number;             // 役員給与（入力値）
  ownerSalaryAfterDeduction: number; // 役員給与所得（給与所得控除後）
  ownerSocialInsurance: number;    // 社会保険料（役員負担分）
  ownerBasicDeduction: number;     // 基礎控除
  ownerOtherDeductions: number;    // その他控除（入力値から流用）
  ownerTaxableIncome: number;      // 役員課税所得
  ownerIncomeTax: number;          // 役員所得税
  ownerResidentTax: number;        // 役員住民税
  ownerNetIncome: number;          // 役員手取り
  totalNetIncome: number;          // 手取り合計（役員手取り + 内部留保）
}

/** シミュレーション全体の計算結果 */
export interface HojinnariResult {
  individual: IndividualResult;
  corporate: CorporateResult;
  difference: number;              // 法人 - 個人の手取り差額
}
