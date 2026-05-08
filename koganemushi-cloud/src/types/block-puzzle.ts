/** 1期分のP/L入力データ（円単位、整数） */
export interface PLPeriodInput {
  /** 期末日ラベル（例: "2026/1/31"） */
  periodLabel: string;
  /** 売上高合計 */
  sales: number;
  /** 売上原価（変動費として扱う） */
  costOfSales: number;
  /** 変動費に含まれる人件費等（変動費から差し引き、人件費に加算する調整額） */
  personnelInVariableCost: number;
  /** 役員報酬 */
  executiveCompensation: number;
  /** 役員賞与 */
  executiveBonus: number;
  /** 給料手当 */
  salaryAllowance: number;
  /** 雑給 */
  miscellaneousSalary: number;
  /** 賞与 */
  bonus: number;
  /** 退職金 */
  retirementBenefits: number;
  /** 法定福利費 */
  legalWelfare: number;
  /** 販売管理費計（人件費を含まない販管費の合計） */
  sellingAdminOther: number;
  /** 税引前当期純損益金額（参考表示用） */
  preTaxIncomeRef: number;
  /** 減価償却費 */
  depreciation: number;
  /** 法人税等 */
  corporateTaxEtc: number;
  /** 借入金返済（年間） */
  loanRepayment: number;
}

/** ブロックパズル表示単位 */
export type BlockPuzzleUnit = "yen" | "thousand";

/** AI理想P/L生成パラメータ */
export type IdealHorizon = 1;

export interface IdealPLParams {
  /** 何年後の理想PLか（現状は1年後のみ） */
  horizonYears: IdealHorizon;
  /** 売上目標（円）。null=AI自動 */
  salesTarget: number | null;
  /** 目標粗利益率（0〜100）。null=AI自動 */
  targetGrossMarginPct: number | null;
  /** 目標労働分配率（0〜100）。null=AI自動 */
  targetLaborDistributionPct: number | null;
  /** 目標増加キャッシュ（円）。null=AI自動 */
  targetCashIncrease: number | null;
  /** 重視ポイント（自由記述） */
  focus: string;
}

/** 1期分のブロックパズル計算結果（全て円単位、整数） */
export interface BlockPuzzleResult {
  /** 期末日ラベル */
  periodLabel: string;
  /** 売上高 */
  sales: number;
  /** 変動費 */
  variableCost: number;
  /** 粗利益（= 売上高 − 変動費） */
  grossProfit: number;
  /** 粗利益率（小数、例: 0.516） */
  grossProfitRate: number;
  /** 人件費（= 役員報酬+役員賞与+給料手当+雑給+賞与+退職金+法定福利費） */
  personnelCost: number;
  /** 労働分配率（= 人件費 ÷ 粗利益、小数） */
  laborDistributionRate: number;
  /** その他固定費（= 販売管理費計） */
  otherFixedCost: number;
  /** 固定費（= 人件費 + その他） */
  fixedCost: number;
  /** 税引前当期利益（= 粗利益 − 固定費） */
  preTaxProfit: number;
  /** 法人税等 */
  corporateTaxEtc: number;
  /** 税引後利益（= 税引前利益 − 法人税等） */
  afterTaxProfit: number;
  /** 借入金返済 */
  loanRepayment: number;
  /** 減価償却費 */
  depreciation: number;
  /** 増加キャッシュ（= 税引後利益 + 減価償却費 − 借入金返済） */
  cashIncrease: number;
}
