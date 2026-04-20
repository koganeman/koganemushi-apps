import type {
  ExecutiveInput,
  RateSettings,
  CorporateTaxParams,
  EffectiveTaxRates,
} from "@/types/simulation";
import type { TaxYear } from "./tax-tables";
import { calcExecutive, calcCorporateTaxTotal } from "./calc-engine";

export interface OptimizeContext {
  executives: ExecutiveInput[];
  comparisonExecutives: ExecutiveInput[];
  rates: RateSettings;
  combineOtherSalaryForInsurance: boolean;
  corporateTaxParams: CorporateTaxParams;
  effectiveTaxRates: EffectiveTaxRates;
  taxYear?: TaxYear;
}

/**
 * minVal から maxVal まで count 等分のステップを生成（10,000円単位切り下げ）
 */
export function generateSteps(
  minVal: number,
  maxVal: number,
  count: number
): number[] {
  if (maxVal <= minVal) {
    return [Math.max(minVal, 0)];
  }
  const steps: number[] = [];
  for (let i = 0; i < count; i++) {
    const raw = minVal + ((maxVal - minVal) * i) / (count - 1);
    steps.push(Math.floor(raw / 10000) * 10000);
  }
  return steps;
}

function calcNetIncome(
  ctx: OptimizeContext,
  mutated: ExecutiveInput
): number {
  const exec = { ...ctx.comparisonExecutives[0], ...mutated, hasMidYearChange: false };
  return calcExecutive(exec, ctx.rates, {
    combineOtherSalary: ctx.combineOtherSalaryForInsurance,
    executiveIndex: 0,
    taxYear: ctx.taxYear,
  }).netIncome;
}

function calcCombinedCFValue(ctx: OptimizeContext, mutated: ExecutiveInput): number {
  const exec = { ...ctx.comparisonExecutives[0], ...mutated, hasMidYearChange: false };
  const result = calcExecutive(exec, ctx.rates, {
    combineOtherSalary: ctx.combineOtherSalaryForInsurance,
    executiveIndex: 0,
    taxYear: ctx.taxYear,
  });
  const execPay = exec.regularSalary +
    exec.predeterminedBonus1 + exec.predeterminedBonus2 + exec.predeterminedBonus3;
  const corporateTax = calcCorporateTaxTotal(
    ctx.corporateTaxParams, execPay, result.employerSocialInsurance, ctx.effectiveTaxRates
  );
  const dividendTotal = exec.dividendIncome;
  const retainedEarnings =
    ctx.corporateTaxParams.preTaxCorporateIncome -
    execPay - dividendTotal - result.employerSocialInsurance - corporateTax;
  return result.netIncome + retainedEarnings;
}

/**
 * 役員報酬最適化: 現状の定期同額給与を中心に±500,000円刻みで41行
 * 上20行が増額、中央(21行目)が現状、下20行が減額（降順表示）
 */
export function sweepRegularSalary(
  ctx: OptimizeContext
): { salary: number; netIncome: number; combinedCF: number; isBaseline: boolean }[] {
  const currentSalary = ctx.executives[0].regularSalary;
  const baseline = calcCombinedCFValue(ctx, { ...ctx.comparisonExecutives[0], regularSalary: currentSalary });
  // i=20: 現状(中央), i=19〜0: +500k〜+10M, i=21〜40: -500k〜-10M → 降順で配列
  const rows = [];
  for (let i = 20; i >= -20; i--) {
    const salary = Math.max(0, currentSalary + i * 500000);
    const mutated = { ...ctx.comparisonExecutives[0], regularSalary: salary };
    rows.push({
      salary,
      netIncome: calcNetIncome(ctx, mutated),
      combinedCF: calcCombinedCFValue(ctx, mutated) - baseline,
      isBaseline: i === 0,
    });
  }
  return rows;
}

/**
 * 配当金最適化: dividendIncome を 0〜preTaxCorporateIncome で 40ステップ
 * regularSalary = preTaxCorporateIncome - dividend
 */
export function sweepDividend(ctx: OptimizeContext): {
  rows: { dividend: number; salary: number; netIncome: number; combinedCF: number }[];
  optimalDividend: number;
  optimalSalary: number;
} {
  const currentExec = ctx.executives[0];
  const currentSalary = currentExec.regularSalary;
  const baseline = calcCombinedCFValue(ctx, currentExec);
  const steps = generateSteps(0, currentSalary, 40);
  const rows = steps.map((dividend) => {
    const salary = Math.max(0, currentSalary - dividend);
    const mutated = { ...currentExec, dividendIncome: dividend, regularSalary: salary };
    return {
      dividend,
      salary,
      netIncome: calcNetIncome(ctx, mutated),
      combinedCF: calcCombinedCFValue(ctx, mutated) - baseline,
    };
  });

  const best = rows.reduce((a, b) => (b.netIncome > a.netIncome ? b : a));
  return {
    rows,
    optimalDividend: best.dividend,
    optimalSalary: best.salary,
  };
}