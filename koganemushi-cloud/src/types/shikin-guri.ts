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

export interface ShikinGuriExportData {
  version: number;
  period?: PeriodConfig;
  cashflow?: CashflowMatrix;
  accounts?: AccountRow[];
  meisai?: MeisaiRow[];
  /** 予実対比用に保持する予算（予測）スナップショット */
  budget?: CashflowMatrix | null;
  /** 予算スナップショットを取得した日時（ISO文字列） */
  budgetSnapshotAt?: string | null;
}

/** 列コピー オプション */
export interface CopyColumnOptions {
  subjectIds: string[];
  sourceMonth: MonthKey;
  targetMonths: MonthKey[];
  overwriteExisting: boolean;
}
