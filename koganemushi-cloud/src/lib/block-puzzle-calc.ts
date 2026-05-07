import type { PLPeriodInput, BlockPuzzleResult } from "@/types/block-puzzle";

/**
 * 安全な除算（0除算時は0を返す）
 */
function safeDiv(a: number, b: number): number {
  if (b === 0) { return 0; }
  return a / b;
}

/**
 * 1期分のP/Lデータからブロックパズル計算結果を算出する純粋関数。
 * 全ての金額は円（整数）で扱う。
 */
export function calcBlockPuzzle(input: PLPeriodInput): BlockPuzzleResult {
  const sales = input.sales;
  // 「変動費に含まれる人件費等」を変動費から減算し、人件費に加算
  const personnelAdjustment = input.personnelInVariableCost;
  const variableCost = input.costOfSales - personnelAdjustment;
  const grossProfit = sales - variableCost;
  const grossProfitRate = safeDiv(grossProfit, sales);

  const personnelCost =
    input.executiveCompensation +
    input.executiveBonus +
    input.salaryAllowance +
    input.miscellaneousSalary +
    input.bonus +
    input.retirementBenefits +
    input.legalWelfare +
    personnelAdjustment;

  const otherFixedCost = input.sellingAdminOther;
  const fixedCost = personnelCost + otherFixedCost;

  const laborDistributionRate = safeDiv(personnelCost, grossProfit);

  const preTaxProfit = grossProfit - fixedCost;
  const corporateTaxEtc = input.corporateTaxEtc;
  const afterTaxProfit = preTaxProfit - corporateTaxEtc;

  const depreciation = input.depreciation;
  const loanRepayment = input.loanRepayment;
  const cashIncrease = afterTaxProfit + depreciation - loanRepayment;

  return {
    periodLabel: input.periodLabel,
    sales,
    variableCost,
    grossProfit,
    grossProfitRate,
    personnelCost,
    laborDistributionRate,
    otherFixedCost,
    fixedCost,
    preTaxProfit,
    corporateTaxEtc,
    afterTaxProfit,
    loanRepayment,
    depreciation,
    cashIncrease,
  };
}

/**
 * 空のP/L入力データを生成
 */
export function createEmptyPLPeriod(periodLabel: string): PLPeriodInput {
  return {
    periodLabel,
    sales: 0,
    costOfSales: 0,
    personnelInVariableCost: 0,
    executiveCompensation: 0,
    executiveBonus: 0,
    salaryAllowance: 0,
    miscellaneousSalary: 0,
    bonus: 0,
    retirementBenefits: 0,
    legalWelfare: 0,
    sellingAdminOther: 0,
    preTaxIncomeRef: 0,
    depreciation: 0,
    corporateTaxEtc: 0,
    loanRepayment: 0,
  };
}

/**
 * 企画書PL抽出データのサンプル値（5期分）
 */
export function createSamplePLPeriods(): PLPeriodInput[] {
  const labels = [
    "2024/1/31",
    "2025/1/31",
    "2026/1/31",
    "2027/1/31",
    "2028/1/31",
  ];
  const sales = [95_000_000, 100_000_000, 110_000_000, 95_000_000, 100_000_000];
  const costOfSales = [
    45_200_000, 51_950_000, 53_220_000, 45_200_000, 51_950_000,
  ];
  const executiveCompensation = [
    9_500_000, 10_000_000, 11_000_000, 9_500_000, 10_000_000,
  ];
  const salaryAllowance = [
    15_000_000, 16_000_000, 17_000_000, 15_000_000, 16_000_000,
  ];
  const legalWelfare = [
    3_500_000, 4_000_000, 4_100_000, 3_500_000, 4_000_000,
  ];
  const sellingAdminOther = [
    19_000_000, 19_500_000, 21_000_000, 19_000_000, 19_500_000,
  ];
  const preTaxIncomeRef = [
    2_800_000, -1_450_000, 3_680_000, 2_800_000, -1_450_000,
  ];

  return labels
    .map((label, i) => ({
      periodLabel: label,
      sales: sales[i],
      costOfSales: costOfSales[i],
      personnelInVariableCost: 0,
      executiveCompensation: executiveCompensation[i],
      executiveBonus: 0,
      salaryAllowance: salaryAllowance[i],
      miscellaneousSalary: 0,
      bonus: 0,
      retirementBenefits: 0,
      legalWelfare: legalWelfare[i],
      sellingAdminOther: sellingAdminOther[i],
      preTaxIncomeRef: preTaxIncomeRef[i],
      depreciation: 0,
      corporateTaxEtc: 0,
      loanRepayment: 0,
    }))
    .reverse();
}
