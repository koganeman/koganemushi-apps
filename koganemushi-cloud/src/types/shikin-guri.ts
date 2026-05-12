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

export interface ShikinGuriExportData {
  version: number;
  period?: PeriodConfig;
  cashflow?: CashflowMatrix;
  accounts?: AccountRow[];
}

/** 過去平均オプション */
export interface PastAverageOptions {
  subjectIds: string[];
  targetMonths: MonthKey[];
  windowMonths: 3 | 6 | 12;
  overwriteExisting: boolean;
}
