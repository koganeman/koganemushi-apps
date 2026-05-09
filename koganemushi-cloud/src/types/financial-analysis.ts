/** 6指標のキー */
export type IndicatorKey =
  | "salesGrowth"
  | "operatingMargin"
  | "laborProductivity"
  | "ebitdaDebtMultiple"
  | "workingCapitalTurnover"
  | "equityRatio";

/** 業種規模区分 */
export type CompanySize = "small" | "medium" | "large";

/** 会社プロファイル（locaben入力情報） */
export interface CompanyProfile {
  /** 業種小分類コード（例: "0301" = 食料品・飼料・飲料製造業） */
  industrySubCode: string;
  /** 業種大分類コード（例: "03"）。industrySubCodeから自動算出される値を保持 */
  industryGroupCode: string;
  /** 資本金（円） */
  capitalYen: number;
  /** 5期分の従業員数（左ほど最新、未入力はnull） */
  employeeCounts: (number | null)[];
}

/** B/S詳細項目（5期分、左ほど最新） */
export interface BSDetail {
  /** 売上債権（売掛金 + 受取手形） */
  receivables: number;
  /** 棚卸資産 */
  inventory: number;
  /** 買掛債務（買掛金 + 支払手形） */
  payables: number;
  /** 借入金合計（短期 + 長期 + 1年内返済予定。役員借入除く） */
  totalDebt: number;
}

/** 1指標の評価結果 */
export interface IndicatorResult {
  /** 計算結果。null=入力不足 */
  value: number | null;
  /** 5段階スコア。null=入力不足 or ベンチマーク不在 */
  score: 1 | 2 | 3 | 4 | 5 | null;
  /** ベンチマーク中央値（参考表示用） */
  benchMedian: number | null;
  /** 4閾値配列 [ⅳ, ⅲ, ⅱ, ⅰ]（参考表示用） */
  benchThresholds: number[] | null;
}

/** 1期分の財務分析結果 */
export interface AnalysisResult {
  periodLabel: string;
  salesGrowth: IndicatorResult;
  operatingMargin: IndicatorResult;
  laborProductivity: IndicatorResult;
  ebitdaDebtMultiple: IndicatorResult;
  workingCapitalTurnover: IndicatorResult;
  equityRatio: IndicatorResult;
  /** 6指標の合計スコア（最大30）。一部nullなら集計除外して残り合計、全null=null */
  totalScore: number | null;
  /** 総合グレード A:24+ / B:18-23 / C:12-17 / D:<12 / null=計算不可 */
  grade: "A" | "B" | "C" | "D" | null;
}

/** エクスポート用 */
export interface FinancialAnalysisExportData {
  version: number;
  profile: CompanyProfile;
  bsDetails: BSDetail[];
}
