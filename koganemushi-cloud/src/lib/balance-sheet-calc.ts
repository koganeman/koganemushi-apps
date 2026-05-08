import type { BSPeriodInput, BalanceSheetResult } from "@/types/balance-sheet";

/** 安全な除算（0除算時は0を返す） */
function safeDiv(a: number, b: number): number {
  if (b === 0) { return 0; }
  return a / b;
}

/**
 * 1期分のB/Sデータから派生指標を算出する純粋関数。
 * 全ての金額は円（整数）で扱う。
 */
export function calcBalanceSheet(input: BSPeriodInput): BalanceSheetResult {
  const totalAssets =
    input.cash + input.currentAssetsExCash + input.fixedAssets;
  const totalLiabilities = input.currentLiabilities + input.longTermLiabilities;
  const totalCapital = totalLiabilities + input.netAssets;
  const quickAssets = input.cash + input.currentAssetsExCash;
  const imbalance = totalAssets - totalCapital;

  return {
    periodLabel: input.periodLabel,
    cash: input.cash,
    currentAssetsExCash: input.currentAssetsExCash,
    fixedAssets: input.fixedAssets,
    currentLiabilities: input.currentLiabilities,
    longTermLiabilities: input.longTermLiabilities,
    netAssets: input.netAssets,
    totalAssets,
    totalCapital,
    totalLiabilities,
    quickAssets,
    currentRatio: safeDiv(quickAssets, input.currentLiabilities),
    equityRatio: safeDiv(input.netAssets, totalAssets),
    fixedRatio: safeDiv(input.fixedAssets, input.netAssets),
    fixedLongTermRatio: safeDiv(
      input.fixedAssets,
      input.netAssets + input.longTermLiabilities,
    ),
    imbalance,
  };
}

/** 空のB/S入力データを生成 */
export function createEmptyBSPeriod(periodLabel: string): BSPeriodInput {
  return {
    periodLabel,
    cash: 0,
    currentAssetsExCash: 0,
    fixedAssets: 0,
    currentLiabilities: 0,
    longTermLiabilities: 0,
    netAssets: 0,
  };
}

/**
 * サンプルB/S（5期分。左=最新、右=最古）。
 * 自己資本比率が徐々に改善していく仮想ケース。全期で資産=資本のバランスが取れている。
 */
export function createSampleBSPeriods(): BSPeriodInput[] {
  const sample: BSPeriodInput[] = [
    {
      periodLabel: "2026/3/31",
      cash: 42_000_000,
      currentAssetsExCash: 16_000_000,
      fixedAssets: 31_000_000,
      currentLiabilities: 4_000_000,
      longTermLiabilities: 17_000_000,
      netAssets: 68_000_000,
    },
    {
      periodLabel: "2025/3/31",
      cash: 38_000_000,
      currentAssetsExCash: 15_000_000,
      fixedAssets: 32_000_000,
      currentLiabilities: 5_000_000,
      longTermLiabilities: 19_000_000,
      netAssets: 61_000_000,
    },
    {
      periodLabel: "2024/3/31",
      cash: 35_000_000,
      currentAssetsExCash: 14_000_000,
      fixedAssets: 33_000_000,
      currentLiabilities: 6_000_000,
      longTermLiabilities: 21_000_000,
      netAssets: 55_000_000,
    },
    {
      periodLabel: "2023/3/31",
      cash: 32_000_000,
      currentAssetsExCash: 13_000_000,
      fixedAssets: 34_000_000,
      currentLiabilities: 7_000_000,
      longTermLiabilities: 23_000_000,
      netAssets: 49_000_000,
    },
    {
      periodLabel: "2022/3/31",
      cash: 30_000_000,
      currentAssetsExCash: 12_000_000,
      fixedAssets: 35_000_000,
      currentLiabilities: 8_000_000,
      longTermLiabilities: 25_000_000,
      netAssets: 44_000_000,
    },
  ];
  return sample;
}
