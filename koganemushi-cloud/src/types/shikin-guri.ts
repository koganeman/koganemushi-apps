/**
 * 資金繰り表アプリ 型定義
 */

/** 月キー: "YYYY-MM" 形式 */
export type MonthKey = string;

export type SubjectSection = "keijou" | "keijouGai" | "zaimu";
export type SubjectKind = "income" | "expense";

export interface SubjectDef {
  id: string;
  label: string;
  section: SubjectSection;
  kind: SubjectKind;
  order: number;
}

export interface PeriodConfig {
  startMonth: MonthKey;
  currentMonth: MonthKey;
}

export interface CashflowMatrix {
  openingBalance: number;
  cells: Record<string, Record<MonthKey, number>>;
}

export interface AccountRow {
  id: string;
  name: string;
  balances: Record<MonthKey, number>;
}

export interface MeisaiRow {
  subjectId: string;
  description: string;
  amounts: Record<MonthKey, number>;
}

/** 資金繰り予測「各科目の試算」用に追加した摘要行 */
export interface MeisaiForecastRow {
  /** 安定ID（追加行の識別。values のキーにも使う） */
  id: string;
  /** 摘要 */
  description: string;
  /** 予測値 */
  value: number;
}

/** 明細（全月）ポップアップの予測入力状態 */
export interface MeisaiForecastState {
  /**
   * subjectId -> rowKey -> 予測値。
   * rowKey は明細行は `m${明細行index}`、追加行はその id。
   */
  values: Record<string, Record<string, number>>;
  /** subjectId -> 明細に存在しない追加行 */
  addedRows: Record<string, MeisaiForecastRow[]>;
}

/**
 * 納税予定（納税予測.xlsx 移植）の決算期設定。
 * 決算日 = この {year, month} の末日（EOMONTH 連鎖の起点に末日が要るので
 * MonthKey ではなく素朴な暦で保持する）。3決算期はこの1期目から推定する。
 */
export interface FiscalPeriodConfig {
  /** 1期目の決算月。例: 2026/6 → 決算日 2026-06-30 */
  closingYear: number;
  /** 1-12 */
  closingMonth: number;
}

/** 消費税概算 入力（決算期ごと） */
export interface ConsumptionTaxInput {
  /** 税引前利益（法人税側でも参照する共通入力） */
  preTaxProfit: number;
  /** （+）役員報酬 */
  officerCompensation: number;
  /** （+）その他給与 */
  otherSalary: number;
  /** （+）法定福利費 */
  legalWelfare: number;
  /** （+）減価償却費 */
  depreciation: number;
  /** （+）保険料 */
  insurance: number;
  /** （+）支払利息 */
  interestPaid: number;
  /** （+）その他非課税仕入れ */
  otherNonTaxablePurchase: number;
  /** （-）受取利息 */
  interestReceived: number;
  /** （-）受取配当金 */
  dividendReceived: number;
  /** （-）その他非課税売上 */
  otherNonTaxableSales: number;
  /** 既納付予定納税（消費税。1期目のみ使用） */
  prepaidTax: number;
}

/** 法人税概算 入力（決算期ごと） */
export interface CorporateTaxInput {
  /** 繰越欠損金 */
  carryForwardLoss: number;
  /**
   * 前期事業税減算。1期目は手入力。2/3期目は前期事業税額の自動連鎖だが、
   * prevBizTaxDeductionManual=true のときこの手入力値で上書きする。
   */
  prevBusinessTaxDeduction: number;
  /** 2/3期目で自動値を手入力上書きしたか（1期目は常に手入力扱い） */
  prevBusinessTaxDeductionManual: boolean;
  /** 住民税均等割（既定 70000） */
  perCapitaLevy: number;
  /** 既納付予定納税（法人税。1期目のみ使用） */
  prepaidTax: number;
}

/** 防衛特別法人税の適用切替（auto=事業年度開始日が2026/4/1以降なら適用） */
export type DefenseTaxMode = "auto" | "on" | "off";

/** 源泉所得税(納期特例) 手入力。キーは MonthKey（1月末=YYYY-01, 7月末=YYYY-07 のみ有効） */
export type WithholdingTaxInput = Record<MonthKey, number>;

/** 納税予定タブの入力状態 */
export interface TaxForecastState {
  /** 1期目の決算月（2/3期目は +12ヶ月で算出） */
  fiscalPeriod: FiscalPeriodConfig;
  /** 消費税概算入力（3決算期分） */
  consumptionTax: [ConsumptionTaxInput, ConsumptionTaxInput, ConsumptionTaxInput];
  /** 法人税概算入力（3決算期分） */
  corporateTax: [CorporateTaxInput, CorporateTaxInput, CorporateTaxInput];
  /** 防衛特別法人税の適用切替 */
  defenseTaxMode: DefenseTaxMode;
  /** 源泉所得税(納期特例) 手入力 */
  withholdingTax: WithholdingTaxInput;
}

/**
 * 冪等転記スナップショット。前回 applyTaxTranscription が資金繰り表に
 * 「加算」した量を subjectId→MonthKey で記録し、再転記時に引き戻して差し替える。
 */
export interface AppliedTaxTranscription {
  /** 転記実行日時(ISO)。未転記は null */
  appliedAt: string | null;
  /** subjectId -> MonthKey -> 前回この転記が加算した金額 */
  deltas: Record<string, Record<MonthKey, number>>;
}

/** 借入種別。短期=tankiKariire 系、長期=choukiKariire 系へ転記分岐。 */
export type LoanType = "short" | "long";

/**
 * 借入金一覧表 1 行分の入力。各借入の月次新規実行と返済を持つ。
 * 月末残高と支払利息は calcLoanSchedule で算出（state には保持しない）。
 */
export interface LoanRow {
  /** 安定 ID（行追加/削除と React key 用） */
  id: string;
  /** 金融機関名 */
  lender: string;
  /** 摘要 */
  description: string;
  /** 借入種別 */
  loanType: LoanType;
  /** 当初借入額（円） */
  originalAmount: number;
  /** 期首残高（= startMonth の前月末残高、円） */
  openingBalance: number;
  /** 年利率（小数 0.017 = 1.7%） */
  annualRate: number;
  /** 月次の新規実行額（MonthKey -> 円） */
  newBorrowing: Record<MonthKey, number>;
  /** 月次の返済額（MonthKey -> 円） */
  repayment: Record<MonthKey, number>;
}

/** 借入金一覧表タブの入力状態 */
export interface LoanForecastState {
  /** 借入行（既定 20 行、空行も保持） */
  rows: LoanRow[];
}

/**
 * 借入金一覧表 → 資金繰り表 への冪等転記スナップショット。
 * tax の AppliedTaxTranscription と同形式。
 */
export interface AppliedLoanTranscription {
  /** 転記実行日時(ISO)。未転記は null */
  appliedAt: string | null;
  /** subjectId -> MonthKey -> 前回この転記が加算した金額 */
  deltas: Record<string, Record<MonthKey, number>>;
}

export interface ShikinGuriExportData {
  version: number;
  period?: PeriodConfig;
  cashflow?: CashflowMatrix;
  accounts?: AccountRow[];
  meisai?: MeisaiRow[];
  /** 明細（全月）の予測入力（各科目の試算） */
  meisaiForecast?: MeisaiForecastState;
  /** 納税予定タブの入力 */
  taxForecast?: TaxForecastState;
  /** 納税予定の資金繰り表転記スナップショット */
  appliedTaxTranscription?: AppliedTaxTranscription | null;
  /** 借入金一覧表タブの入力 */
  loanForecast?: LoanForecastState;
  /** 借入金一覧表の資金繰り表転記スナップショット */
  appliedLoanTranscription?: AppliedLoanTranscription | null;
  /** 予実対比用に保持する予算（予測）スナップショット */
  budget?: CashflowMatrix | null;
  /** 予算スナップショットを取得した日時（ISO文字列） */
  budgetSnapshotAt?: string | null;
  /** 実績取込の学習ルール（科目割当の自動適用） */
  learnedRules?: import("@/types/general-ledger").LearnedRules;
}

/** 列コピー オプション */
export interface CopyColumnOptions {
  subjectIds: string[];
  sourceMonth: MonthKey;
  targetMonths: MonthKey[];
  overwriteExisting: boolean;
}
