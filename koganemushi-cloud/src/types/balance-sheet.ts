/** 1期分の貸借対照表入力データ（円単位、整数） */
export interface BSPeriodInput {
  /** 期末日ラベル（例: "2026/3/31"） */
  periodLabel: string;
  /** 現預金 */
  cash: number;
  /** 流動資産（現預金を除く合計：売掛金・棚卸資産など） */
  currentAssetsExCash: number;
  /** 固定資産合計 */
  fixedAssets: number;
  /** 流動負債合計 */
  currentLiabilities: number;
  /** 固定負債合計 */
  longTermLiabilities: number;
  /** 純資産合計 */
  netAssets: number;
}

/** 表示単位（P/Lと共通の概念） */
export type BalanceSheetUnit = "yen" | "thousand";

/** 1期分のB/S派生指標（全て円単位、整数または比率） */
export interface BalanceSheetResult {
  /** 期末日ラベル */
  periodLabel: string;
  cash: number;
  currentAssetsExCash: number;
  fixedAssets: number;
  currentLiabilities: number;
  longTermLiabilities: number;
  netAssets: number;
  /** 総資産（cash + currentAssetsExCash + fixedAssets） */
  totalAssets: number;
  /** 総資本（currentLiabilities + longTermLiabilities + netAssets） */
  totalCapital: number;
  /** 負債合計 */
  totalLiabilities: number;
  /** 当座資産（cash + currentAssetsExCash） */
  quickAssets: number;
  /** 流動比率（quickAssets ÷ currentLiabilities） */
  currentRatio: number;
  /** 自己資本比率（netAssets ÷ totalAssets） */
  equityRatio: number;
  /** 固定比率（fixedAssets ÷ netAssets） */
  fixedRatio: number;
  /** 固定長期適合率（fixedAssets ÷ (netAssets + longTermLiabilities)） */
  fixedLongTermRatio: number;
  /** 貸借差額（totalAssets − totalCapital）。0でないとき警告対象。 */
  imbalance: number;
}

/** AIアドバイスの保存型（hashで stale 検出） */
export interface BalanceSheetAdvice {
  text: string;
  generatedAt: string;
  periodsHash: string;
}

/** エクスポート/インポート用のJSONフォーマット */
export interface BalanceSheetExportData {
  version: number;
  periods: BSPeriodInput[];
  unit?: BalanceSheetUnit;
}
