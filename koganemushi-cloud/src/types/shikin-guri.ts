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

export interface ShikinGuriExportData {
  version: number;
  period?: PeriodConfig;
  cashflow?: CashflowMatrix;
  accounts?: AccountRow[];
  meisai?: MeisaiRow[];
  /** 明細（全月）の予測入力（各科目の試算） */
  meisaiForecast?: MeisaiForecastState;
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
