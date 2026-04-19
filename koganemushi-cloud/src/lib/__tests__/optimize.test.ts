import { describe, it, expect } from "vitest";
import {
  generateSteps,
  sweepRegularSalary,
  sweepDividend,
  type OptimizeContext,
} from "../optimize";
import type { ExecutiveInput, RateSettings } from "@/types/simulation";
import { DEFAULT_EFFECTIVE_TAX_RATES } from "../tax-tables";

const rates: RateSettings = {
  healthInsuranceRate: 0.0991,
  nursingCareRate: 0.0159,
  pensionRate: 0.183,
  childcareSupportRate: 0.0023,
  childcareContributionRate: 0.0036,
  healthBonusAnnualCap: 5730000,
  pensionBonusPerPaymentCap: 1500000,
};

function makeExec(overrides: Partial<ExecutiveInput> = {}): ExecutiveInput {
  return {
    name: "",
    age: 45,
    regularSalary: 0,
    predeterminedBonus1: 0,
    predeterminedBonus2: 0,
    predeterminedBonus3: 0,
    otherSalaryIncome: 0,
    definedBenefitPension: 0,
    dividendIncome: 0,
    otherIncome: 0,
    otherDeductions: 0,
    taxCredit: 0,
    socialInsuranceEnrolled: true,
    childcareHousehold: true,
    manualHealthInsurance: false,
    manualHealthInsuranceAmount: 0,
    ...overrides,
  };
}

function makeContext(overrides: Partial<OptimizeContext> = {}): OptimizeContext {
  const exec = makeExec({ regularSalary: 10000000 });
  return {
    executives: [exec],
    comparisonExecutives: [exec],
    rates,
    isGovernmentHealthInsurance: true,
    combineOtherSalaryForInsurance: false,
    corporateTaxParams: {
      preTaxCorporateIncome: 30000000,
      perCapitaLevy: 70000,
      carryForwardLoss: 0,
    },
    effectiveTaxRates: DEFAULT_EFFECTIVE_TAX_RATES,
    ...overrides,
  };
}

// ============================================================
// generateSteps
// ============================================================
describe("generateSteps", () => {
  it("40ステップ生成、10,000円単位切り下げ", () => {
    const steps = generateSteps(0, 30000000, 40);
    expect(steps).toHaveLength(40);
    expect(steps[0]).toBe(0);
    // 最後のステップは30,000,000以下
    expect(steps[steps.length - 1]).toBeLessThanOrEqual(30000000);
    // 全て10,000円単位
    for (const s of steps) {
      expect(s % 10000).toBe(0);
    }
  });

  it("昇順に並ぶ", () => {
    const steps = generateSteps(0, 20000000, 40);
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i]).toBeGreaterThanOrEqual(steps[i - 1]);
    }
  });

  it("maxVal <= minVal の場合は1要素", () => {
    const steps = generateSteps(5000000, 5000000, 40);
    expect(steps).toHaveLength(1);
    expect(steps[0]).toBe(5000000);
  });

  it("minVal < maxVal < 0 の場合、負の値を含むステップを生成", () => {
    const steps = generateSteps(-1000000, -500000, 10);
    expect(steps).toHaveLength(10);
    // 全て10,000円単位（-0 === 0 のため Math.abs で比較）
    for (const s of steps) {
      expect(Math.abs(s) % 10000).toBe(0);
    }
    expect(steps[0]).toBe(-1000000);
  });
});

// ============================================================
// sweepRegularSalary
// ============================================================
describe("sweepRegularSalary", () => {
  const ctx = makeContext();
  const rows = sweepRegularSalary(ctx);

  it("41行返す", () => {
    expect(rows).toHaveLength(41);
  });

  it("ベースライン行が1つだけ存在する", () => {
    const baselines = rows.filter((r) => r.isBaseline);
    expect(baselines).toHaveLength(1);
  });

  it("ベースラインのsalaryが元の定期同額給与と一致", () => {
    const baseline = rows.find((r) => r.isBaseline)!;
    expect(baseline.salary).toBe(10000000);
  });

  it("ベースラインのcombinedCFは0（差分表示）", () => {
    const baseline = rows.find((r) => r.isBaseline)!;
    expect(baseline.combinedCF).toBe(0);
  });

  it("全行のsalaryは0以上", () => {
    for (const row of rows) {
      expect(row.salary).toBeGreaterThanOrEqual(0);
    }
  });

  it("全行のnetIncomeは数値", () => {
    for (const row of rows) {
      expect(typeof row.netIncome).toBe("number");
      expect(Number.isFinite(row.netIncome)).toBe(true);
    }
  });

  it("降順に並ぶ（最初が最高額、最後が最低額）", () => {
    expect(rows[0].salary).toBeGreaterThanOrEqual(rows[rows.length - 1].salary);
  });
});

// ============================================================
// sweepDividend
// ============================================================
describe("sweepDividend", () => {
  const ctx = makeContext();
  const result = sweepDividend(ctx);

  it("40行返す", () => {
    expect(result.rows).toHaveLength(40);
  });

  it("全行のdividendは0以上", () => {
    for (const row of result.rows) {
      expect(row.dividend).toBeGreaterThanOrEqual(0);
    }
  });

  it("全行のsalaryは0以上", () => {
    for (const row of result.rows) {
      expect(row.salary).toBeGreaterThanOrEqual(0);
    }
  });

  it("dividend + salary ≒ preTaxCorporateIncome", () => {
    for (const row of result.rows) {
      expect(row.dividend + row.salary).toBeLessThanOrEqual(
        ctx.corporateTaxParams.preTaxCorporateIncome + 10000
      );
    }
  });

  it("最適配当額が行内に存在する", () => {
    const found = result.rows.find((r) => r.dividend === result.optimalDividend);
    expect(found).toBeDefined();
  });

  it("最適配当額のnetIncomeが全行の中で最大", () => {
    const maxNetIncome = Math.max(...result.rows.map((r) => r.netIncome));
    const optimal = result.rows.find((r) => r.dividend === result.optimalDividend)!;
    expect(optimal.netIncome).toBe(maxNetIncome);
  });
});

// ============================================================
// エッジケース: 法人所得0
// ============================================================
describe("エッジケース: 法人所得0", () => {
  const ctx = makeContext({
    corporateTaxParams: {
      preTaxCorporateIncome: 0,
      perCapitaLevy: 70000,
      carryForwardLoss: 0,
    },
  });

  it("sweepDividend: 所得0でも1行以上返す", () => {
    const result = sweepDividend(ctx);
    expect(result.rows.length).toBeGreaterThanOrEqual(1);
  });

});
