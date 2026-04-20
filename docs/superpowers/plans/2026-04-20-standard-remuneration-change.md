# 標準報酬変更タイミング対応 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 役員報酬シミュレーションに「変更前月額」「変更後月額」「改定月」の3フィールドを追加し、期中での標準報酬改定を反映した社会保険料計算を行う。併せて、グローバル `政管健保` フラグを廃止し、役員ごとの `健保任意入力` フラグに統合する。

**Architecture:** `calc-engine.ts` に期間分割ヘルパー（`calcMonthlyInsuranceWithSplit`）を導入し、既存の健康保険・厚生年金・子育て支援金の計算をすべて分割式で統一する。`isGovernmentHealthInsurance` 引数は `CalcExecutiveContext` から削除。UI側は `ExecutiveTable` の行追加とヘッダーに「社会保険」ラベルを配置、ページから政管健保チェックボックスを除去。localStorage の旧データは Zustand の `migrate` で新フィールドを補完。

**Tech Stack:** TypeScript, React 19, Next.js 16, Zustand, vitest, shadcn/ui

---

## File Structure

**修正ファイル**:
- `koganemushi-cloud/src/types/simulation.ts` — 型定義に3フィールド追加、`governmentHealthInsurance` 削除
- `koganemushi-cloud/src/lib/defaults.ts` — `createEmptyExecutive` に新フィールド、`createDefaultSimulationData` から flag 削除
- `koganemushi-cloud/src/lib/calc-engine.ts` — 分割計算ヘルパー導入、ロジック改修
- `koganemushi-cloud/src/stores/simulation-store.ts` — state / action / persist 変更、migrate 追加
- `koganemushi-cloud/src/hooks/use-computed-results.ts` — `isGovernmentHealthInsurance` 参照削除
- `koganemushi-cloud/src/lib/optimize.ts` — `isGovernmentHealthInsurance` context引数削除
- `koganemushi-cloud/src/components/optimization-sheet.tsx` — context構築の参照削除
- `koganemushi-cloud/src/components/executive-table.tsx` — 3行追加、ヘッダー「社会保険」ラベル追加
- `koganemushi-cloud/src/app/yakuin-hoshu/page.tsx` — 政管健保チェックボックス削除

**修正テスト**:
- `koganemushi-cloud/src/lib/__tests__/calc-engine.test.ts` — context 引数修正、新ケース追加
- `koganemushi-cloud/src/lib/__tests__/excel-scenarios.test.ts` — context 引数修正
- `koganemushi-cloud/src/lib/__tests__/optimize.test.ts` — context 引数修正

**修正ドキュメント**:
- `docs/yakuin-hoshu/計算ロジック仕様書.md` — 新ロジック追記（ファイル末尾に追記）

---

## Task 1: 型定義の更新

**Files:**
- Modify: `koganemushi-cloud/src/types/simulation.ts`

- [ ] **Step 1: `ExecutiveInput` に3フィールド追加・`SimulationData` から `governmentHealthInsurance` 削除**

`src/types/simulation.ts` の `ExecutiveInput` インターフェースに以下を追加（`manualHealthInsuranceAmount` の次）:

```typescript
  /** 健康保険料（任意入力時の値） */
  manualHealthInsuranceAmount: number;
  /** 変更前月額報酬（円） */
  preChangeMonthlyRemuneration: number;
  /** 変更後月額報酬（円） */
  postChangeMonthlyRemuneration: number;
  /** 標準報酬改定月（1〜13、1=期首から改定後月額を使用） */
  standardRemunerationChangeMonth: number;
}
```

`SimulationData` インターフェースから `governmentHealthInsurance: boolean;` 行を削除（L142）:

```typescript
export interface SimulationData {
  /** 料率設定 */
  rates: RateSettings;
  /** 法人税パラメータ */
  corporateTaxParams: CorporateTaxParams;
  /** 法人税実効税率 */
  effectiveTaxRates: EffectiveTaxRates;
  /** 現状の役員データ */
  currentExecutives: ExecutiveInput[];
  /** 比較用の役員データ */
  comparisonExecutives: ExecutiveInput[];
  /** 他の給与社保合算フラグ（1人目のみ） */
  combineOtherSalaryForInsurance: boolean;
}
```

- [ ] **Step 2: コミット**

```bash
cd koganemushi-cloud
git add src/types/simulation.ts
git commit -m "types: 標準報酬変更タイミング用フィールドを追加・政管健保フラグを削除"
```

---

## Task 2: デフォルト値の更新

**Files:**
- Modify: `koganemushi-cloud/src/lib/defaults.ts`

- [ ] **Step 1: `createEmptyExecutive` に新フィールド、`createDefaultSimulationData` から政管健保削除**

`src/lib/defaults.ts` を以下で置き換える:

```typescript
import type {
  RateSettings,
  CorporateTaxParams,
  ExecutiveInput,
  SimulationData,
} from "@/types/simulation";
import { DEFAULT_EFFECTIVE_TAX_RATES } from "./tax-tables";

export const defaultRates: RateSettings = {
  healthInsuranceRate: 0.0991,
  nursingCareRate: 0.0159,
  pensionRate: 0.183,
  childcareSupportRate: 0.0023,
  childcareContributionRate: 0.0036,
  healthBonusAnnualCap: 5730000,
  pensionBonusPerPaymentCap: 1500000,
};

export const defaultCorporateTaxParams: CorporateTaxParams = {
  preTaxCorporateIncome: 0,
  perCapitaLevy: 70000,
  carryForwardLoss: 0,
};

export function createEmptyExecutive(): ExecutiveInput {
  return {
    name: "",
    age: 0,
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
    preChangeMonthlyRemuneration: 0,
    postChangeMonthlyRemuneration: 0,
    standardRemunerationChangeMonth: 1,
  };
}

export function createDefaultSimulationData(): SimulationData {
  const executives = Array.from({ length: 10 }, () => createEmptyExecutive());

  return {
    rates: { ...defaultRates },
    corporateTaxParams: { ...defaultCorporateTaxParams },
    effectiveTaxRates: { ...DEFAULT_EFFECTIVE_TAX_RATES },
    currentExecutives: executives,
    comparisonExecutives: executives.map((e) => ({ ...e })),
    combineOtherSalaryForInsurance: false,
  };
}
```

- [ ] **Step 2: 型チェック実行**

```bash
cd koganemushi-cloud
npx tsc --noEmit
```

想定: 複数ファイルでエラー（後続タスクで修正）— この時点では `stores`, `calc-engine`, `tests` 等に未修正エラーが残る。進行可。

- [ ] **Step 3: コミット**

```bash
git add src/lib/defaults.ts
git commit -m "defaults: ExecutiveInputに変更前後月額・改定月を追加"
```

---

## Task 3: calc-engineの分割計算ヘルパーと改修（TDD）

**Files:**
- Modify: `koganemushi-cloud/src/lib/calc-engine.ts`
- Test: `koganemushi-cloud/src/lib/__tests__/calc-engine.test.ts`

- [ ] **Step 1: 既存テストファイルの context 引数から `isGovernmentHealthInsurance` を削除**

`src/lib/__tests__/calc-engine.test.ts` の既存テストで `isGovernmentHealthInsurance: true` を含む行（L457, L504, L536）をすべて削除する。例:

修正前:
```typescript
    const result = calcExecutive(exec, defaultRates, {
      isGovernmentHealthInsurance: true,
      combineOtherSalary: false,
      executiveIndex: 0,
    });
```

修正後:
```typescript
    const result = calcExecutive(exec, defaultRates, {
      combineOtherSalary: false,
      executiveIndex: 0,
    });
```

3箇所すべて修正。また、既存のExecutiveInputを生成しているテストデータにも新フィールドを追加する必要がある。L437-454 のテストデータに以下を追加:

```typescript
      manualHealthInsurance: false,
      manualHealthInsuranceAmount: 0,
      preChangeMonthlyRemuneration: 0,
      postChangeMonthlyRemuneration: 10000000 / 12, // 月額833,333
      standardRemunerationChangeMonth: 1,
    };
```

L484-500 の `未加入花子` には:

```typescript
      preChangeMonthlyRemuneration: 0,
      postChangeMonthlyRemuneration: 5000000 / 12,
      standardRemunerationChangeMonth: 1,
```

L516以降 `医師国保太郎` には (健保任意入力ON の例):
```typescript
      preChangeMonthlyRemuneration: 0,
      postChangeMonthlyRemuneration: 8000000 / 12,
      standardRemunerationChangeMonth: 1,
```

- [ ] **Step 2: calc-engineの新ヘルパーと新context型の先行定義（失敗テスト用）**

`src/lib/calc-engine.ts` の `CalcExecutiveContext` インターフェース（L388 前後）から `isGovernmentHealthInsurance` を削除:

```typescript
export interface CalcExecutiveContext {
  combineOtherSalary: boolean;
  executiveIndex: number;
  taxYear?: TaxYear;
}
```

- [ ] **Step 3: 新しい失敗テストを追加（分割計算・健保任意入力）**

`src/lib/__tests__/calc-engine.test.ts` の末尾に以下を追加:

```typescript
// ============================================================
// 標準報酬変更タイミング分割計算
// ============================================================
describe("calcExecutive - 標準報酬変更タイミング", () => {
  const base: ExecutiveInput = {
    name: "分割太郎",
    age: 42,
    regularSalary: 12000000,
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
    childcareHousehold: false,
    manualHealthInsurance: false,
    manualHealthInsuranceAmount: 0,
    preChangeMonthlyRemuneration: 500000,
    postChangeMonthlyRemuneration: 1000000,
    standardRemunerationChangeMonth: 1,
  };

  it("改定月=1: post月額のみで12ヶ月分（従来挙動）", () => {
    const result = calcExecutive(base, defaultRates, {
      combineOtherSalary: false,
      executiveIndex: 0,
    });
    const expectedHealth =
      calcHealthInsuranceMonthly(1000000, 42, defaultRates) * 12;
    expect(result.healthInsurance).toBeCloseTo(expectedHealth, 0);
  });

  it("改定月=7: pre×6 + post×6", () => {
    const exec: ExecutiveInput = { ...base, standardRemunerationChangeMonth: 7 };
    const result = calcExecutive(exec, defaultRates, {
      combineOtherSalary: false,
      executiveIndex: 0,
    });
    const expectedHealth =
      calcHealthInsuranceMonthly(500000, 42, defaultRates) * 6 +
      calcHealthInsuranceMonthly(1000000, 42, defaultRates) * 6;
    expect(result.healthInsurance).toBeCloseTo(expectedHealth, 0);
  });

  it("改定月=13: pre月額のみで12ヶ月分", () => {
    const exec: ExecutiveInput = { ...base, standardRemunerationChangeMonth: 13 };
    const result = calcExecutive(exec, defaultRates, {
      combineOtherSalary: false,
      executiveIndex: 0,
    });
    const expectedHealth =
      calcHealthInsuranceMonthly(500000, 42, defaultRates) * 12;
    expect(result.healthInsurance).toBeCloseTo(expectedHealth, 0);
  });

  it("pre=0, 改定月=7: 変更前期間の社保ゼロ、post×6のみ", () => {
    const exec: ExecutiveInput = {
      ...base,
      preChangeMonthlyRemuneration: 0,
      standardRemunerationChangeMonth: 7,
    };
    const result = calcExecutive(exec, defaultRates, {
      combineOtherSalary: false,
      executiveIndex: 0,
    });
    const expectedHealth =
      calcHealthInsuranceMonthly(1000000, 42, defaultRates) * 6;
    expect(result.healthInsurance).toBeCloseTo(expectedHealth, 0);
  });

  it("post=0, 改定月=7: 変更後期間の社保ゼロ、pre×6のみ", () => {
    const exec: ExecutiveInput = {
      ...base,
      postChangeMonthlyRemuneration: 0,
      standardRemunerationChangeMonth: 7,
    };
    const result = calcExecutive(exec, defaultRates, {
      combineOtherSalary: false,
      executiveIndex: 0,
    });
    const expectedHealth =
      calcHealthInsuranceMonthly(500000, 42, defaultRates) * 6;
    expect(result.healthInsurance).toBeCloseTo(expectedHealth, 0);
  });

  it("健保任意入力ON: 健保は入力額、厚生年金は分割計算", () => {
    const exec: ExecutiveInput = {
      ...base,
      manualHealthInsurance: true,
      manualHealthInsuranceAmount: 600000,
      standardRemunerationChangeMonth: 7,
    };
    const result = calcExecutive(exec, defaultRates, {
      combineOtherSalary: false,
      executiveIndex: 0,
    });
    expect(result.healthInsurance).toBe(600000);
    const expectedPension =
      calcPensionInsuranceMonthly(500000, 42, defaultRates) * 6 +
      calcPensionInsuranceMonthly(1000000, 42, defaultRates) * 6;
    expect(result.pensionInsurance).toBeCloseTo(expectedPension, 0);
  });

  it("健保任意入力ON: 会社負担健保・子育て支援金はゼロ、会社負担厚生年金は計算", () => {
    const exec: ExecutiveInput = {
      ...base,
      manualHealthInsurance: true,
      manualHealthInsuranceAmount: 600000,
      standardRemunerationChangeMonth: 1,
    };
    const result = calcExecutive(exec, defaultRates, {
      combineOtherSalary: false,
      executiveIndex: 0,
    });
    const expectedEmployerPension =
      calcPensionInsuranceMonthly(1000000, 42, defaultRates) * 12;
    // employerSocialInsurance には 会社負担厚生年金 + 拠出金 が含まれる
    expect(result.employerSocialInsurance).toBeGreaterThanOrEqual(expectedEmployerPension);
  });
});
```

- [ ] **Step 4: テストを実行して失敗を確認**

```bash
cd koganemushi-cloud
npx vitest run src/lib/__tests__/calc-engine.test.ts
```

想定: 新しい7ケースが型エラーまたは値エラーで失敗。既存テストは `isGovernmentHealthInsurance` 削除後なのでcalc-engine側の型変更が必要な状態で失敗する可能性あり。

- [ ] **Step 5: calc-engineに分割計算ヘルパー導入**

`src/lib/calc-engine.ts` の `lookupStandardMonthlyRemuneration` と `calcHealthInsuranceMonthly` の間に以下を追加:

```typescript
// ============================================================
// 期間分割（変更前月額 / 変更後月額）
// ============================================================

/**
 * 変更前月額ベースの月額保険料 × (改定月-1) +
 * 変更後月額ベースの月額保険料 × (13-改定月)
 * monthlyFn は (monthly) => 月額保険料 を返す関数
 */
function splitAnnualInsurance(
  pre: number,
  post: number,
  changeMonth: number,
  monthlyFn: (monthly: number) => number
): number {
  const preMonths = Math.max(0, Math.min(12, changeMonth - 1));
  const postMonths = Math.max(0, 12 - preMonths);
  const preMonthly = pre > 0 ? monthlyFn(pre) : 0;
  const postMonthly = post > 0 ? monthlyFn(post) : 0;
  return preMonthly * preMonths + postMonthly * postMonths;
}
```

- [ ] **Step 6: 健康保険料の個人負担計算を分割式に書き換え**

`calcPersonalHealthInsurance` 関数（L423前後）を以下で置き換え:

```typescript
/** 健康保険料の計算（個人負担） */
function calcPersonalHealthInsurance(
  exec: ExecutiveInput,
  rates: RateSettings
): number {
  if (!exec.socialInsuranceEnrolled) {
    return 0;
  }
  if (exec.manualHealthInsurance) {
    return exec.manualHealthInsuranceAmount;
  }
  const monthlySalaryHealth = splitAnnualInsurance(
    exec.preChangeMonthlyRemuneration,
    exec.postChangeMonthlyRemuneration,
    exec.standardRemunerationChangeMonth,
    (m) => calcHealthInsuranceMonthly(m, exec.age, rates)
  );
  const bonusHealth = calcBonusHealthInsurance(
    exec.predeterminedBonus1 + exec.predeterminedBonus2 + exec.predeterminedBonus3,
    exec.age, rates
  );
  return monthlySalaryHealth + bonusHealth;
}
```

- [ ] **Step 7: 厚生年金の個人負担計算を分割式に書き換え**

`calcPersonalPension` 関数を以下で置き換え:

```typescript
/** 厚生年金保険料の計算（個人負担） */
function calcPersonalPension(
  exec: ExecutiveInput,
  rates: RateSettings
): number {
  if (!exec.socialInsuranceEnrolled) {
    return 0;
  }
  const monthlyPension = splitAnnualInsurance(
    exec.preChangeMonthlyRemuneration,
    exec.postChangeMonthlyRemuneration,
    exec.standardRemunerationChangeMonth,
    (m) => calcPensionInsuranceMonthly(m, exec.age, rates)
  );
  const bonusPension =
    calcBonusPensionInsurance(exec.predeterminedBonus1, exec.age, rates) +
    calcBonusPensionInsurance(exec.predeterminedBonus2, exec.age, rates) +
    calcBonusPensionInsurance(exec.predeterminedBonus3, exec.age, rates);
  return monthlyPension + bonusPension;
}
```

- [ ] **Step 8: 子育て支援金の個人負担計算を分割式に書き換え**

`calcPersonalChildcareSupport` 関数を以下で置き換え:

```typescript
/** 子ども・子育て支援金の計算（個人負担） */
function calcPersonalChildcareSupport(
  exec: ExecutiveInput,
  rates: RateSettings
): number {
  if (!exec.socialInsuranceEnrolled || exec.manualHealthInsurance) {
    return 0;
  }
  const monthlySupportFee = splitAnnualInsurance(
    exec.preChangeMonthlyRemuneration,
    exec.postChangeMonthlyRemuneration,
    exec.standardRemunerationChangeMonth,
    (m) => calcChildcareSupportMonthly(m, rates)
  );
  const bonusSupportFee = calcBonusChildcareSupport(
    exec.predeterminedBonus1 + exec.predeterminedBonus2 + exec.predeterminedBonus3,
    rates
  );
  return monthlySupportFee + bonusSupportFee;
}
```

- [ ] **Step 9: 会社負担計算を分割式に書き換え**

`calcEmployerInsurance` 関数を以下で置き換え:

```typescript
/** 会社負担社会保険料の計算 */
function calcEmployerInsurance(
  exec: ExecutiveInput,
  rates: RateSettings
): number {
  if (!exec.socialInsuranceEnrolled) {
    return 0;
  }

  // 厚生年金（常に計算）
  const employerPensionMonthly = splitAnnualInsurance(
    exec.preChangeMonthlyRemuneration,
    exec.postChangeMonthlyRemuneration,
    exec.standardRemunerationChangeMonth,
    (m) => calcPensionInsuranceMonthly(m, exec.age, rates)
  );
  const employerBonusPension =
    calcBonusPensionInsurance(exec.predeterminedBonus1, exec.age, rates) +
    calcBonusPensionInsurance(exec.predeterminedBonus2, exec.age, rates) +
    calcBonusPensionInsurance(exec.predeterminedBonus3, exec.age, rates);

  // 子ども・子育て拠出金（現行どおり regularSalary ベース）
  const childcare = calcChildcareContribution({
    regularSalary: exec.regularSalary,
    bonus1: exec.predeterminedBonus1,
    bonus2: exec.predeterminedBonus2,
    bonus3: exec.predeterminedBonus3,
  }, rates);

  // 健保任意入力ONなら会社負担健保・子育て支援金はゼロ
  if (exec.manualHealthInsurance) {
    return employerPensionMonthly + employerBonusPension + childcare;
  }

  // 健康保険（分割計算）
  const employerHealthMonthly = splitAnnualInsurance(
    exec.preChangeMonthlyRemuneration,
    exec.postChangeMonthlyRemuneration,
    exec.standardRemunerationChangeMonth,
    (m) => calcHealthInsuranceMonthly(m, exec.age, rates)
  );
  const employerBonusHealth = calcBonusHealthInsurance(
    exec.predeterminedBonus1 + exec.predeterminedBonus2 + exec.predeterminedBonus3,
    exec.age, rates
  );

  // 子ども・子育て支援金（会社負担分 = 個人負担分と同額）
  const employerChildcareSupport = splitAnnualInsurance(
    exec.preChangeMonthlyRemuneration,
    exec.postChangeMonthlyRemuneration,
    exec.standardRemunerationChangeMonth,
    (m) => calcChildcareSupportMonthly(m, rates)
  ) + calcBonusChildcareSupport(
    exec.predeterminedBonus1 + exec.predeterminedBonus2 + exec.predeterminedBonus3,
    rates
  );

  return employerHealthMonthly + employerPensionMonthly +
    childcare + employerBonusPension + employerBonusHealth + employerChildcareSupport;
}
```

- [ ] **Step 10: `calcExecutive` 関数から `isGovernmentHealthInsurance` 参照を削除**

`calcExecutive` 関数（L597前後）の中で、各ヘルパー呼び出しから `monthlyInsuranceBase` と `ctx.isGovernmentHealthInsurance` を削除:

修正前:
```typescript
export function calcExecutive(
  exec: ExecutiveInput,
  rates: RateSettings,
  ctx: CalcExecutiveContext
): ExecutiveResult {
  const base = calcIncomeBase(exec, ctx);
  const monthlyInsuranceBase = base.insuranceSalaryBase / 12;

  const taxYear = ctx.taxYear ?? "R7";
  const healthInsurance = calcPersonalHealthInsurance(
    exec, rates, monthlyInsuranceBase, ctx.isGovernmentHealthInsurance
  );
  const pensionInsurance = calcPersonalPension(exec, rates, monthlyInsuranceBase);
  const childcareSupport = calcPersonalChildcareSupport(
    exec, rates, monthlyInsuranceBase, ctx.isGovernmentHealthInsurance
  );
  ...
  const employerSocialInsurance = calcEmployerInsurance(
    exec, rates, monthlyInsuranceBase, ctx.isGovernmentHealthInsurance
  );
```

修正後:
```typescript
export function calcExecutive(
  exec: ExecutiveInput,
  rates: RateSettings,
  ctx: CalcExecutiveContext
): ExecutiveResult {
  const base = calcIncomeBase(exec, ctx);

  const taxYear = ctx.taxYear ?? "R7";
  const healthInsurance = calcPersonalHealthInsurance(exec, rates);
  const pensionInsurance = calcPersonalPension(exec, rates);
  const childcareSupport = calcPersonalChildcareSupport(exec, rates);
  ...
  const employerSocialInsurance = calcEmployerInsurance(exec, rates);
```

`calcIncomeBase` 内で使用されていた `insuranceSalaryBase` は税金計算には不要となるが、戻り値の一部だったか確認。戻り値から不要なら削除、他で参照されていれば保持。現状は `calcIncomeBase` の戻り値 `{ totalSalaryIncome, salaryIncomeAfterDeduction, totalIncome, insuranceSalaryBase }` のうち `insuranceSalaryBase` は保険料計算専用だったので、削除して問題ない。

`calcIncomeBase` を以下で置き換え:

```typescript
/** 給与収入・所得の計算 */
function calcIncomeBase(exec: ExecutiveInput, ctx: CalcExecutiveContext) {
  const taxYear = ctx.taxYear ?? "R7";
  const totalSalaryIncome =
    exec.regularSalary + exec.predeterminedBonus1 +
    exec.predeterminedBonus2 + exec.predeterminedBonus3 +
    exec.otherSalaryIncome - exec.definedBenefitPension;
  const salaryIncomeAfterDeduction = calcSalaryIncome(
    totalSalaryIncome, exec.childcareHousehold, taxYear
  );
  const totalIncome = salaryIncomeAfterDeduction + exec.dividendIncome + exec.otherIncome;
  return { totalSalaryIncome, salaryIncomeAfterDeduction, totalIncome };
}
```

`ctx` パラメータは `combineOtherSalary` と `executiveIndex` を使用しないので、以降使用する箇所を整理。実際は `combineOtherSalary` が保険料合算用だったが、今回の改修では `preChange`/`postChange` を明示入力するため、合算機能は保険料計算に影響しなくなる。ただし既存動作保持のため、`calcIncomeBase` から `ctx` 引数を除去してもよい。安全のため `ctx` 引数はシグネチャに残し、内部で参照しないように変更:

```typescript
function calcIncomeBase(exec: ExecutiveInput, ctx: CalcExecutiveContext) {
  const taxYear = ctx.taxYear ?? "R7";
  ...
}
```

- [ ] **Step 11: テスト実行**

```bash
cd koganemushi-cloud
npx vitest run src/lib/__tests__/calc-engine.test.ts
```

想定: 新旧すべてのテストがPASS。

- [ ] **Step 12: コミット**

```bash
git add src/lib/calc-engine.ts src/lib/__tests__/calc-engine.test.ts
git commit -m "calc-engine: 標準報酬変更タイミング分割計算を実装・政管健保引数を廃止"
```

---

## Task 4: optimize / excel-scenarios テストの更新

**Files:**
- Modify: `koganemushi-cloud/src/lib/optimize.ts`
- Modify: `koganemushi-cloud/src/lib/__tests__/optimize.test.ts`
- Modify: `koganemushi-cloud/src/lib/__tests__/excel-scenarios.test.ts`

- [ ] **Step 1: `optimize.ts` から `isGovernmentHealthInsurance` 削除**

`src/lib/optimize.ts` の `OptimizeContext` インターフェースから `isGovernmentHealthInsurance: boolean;` 行を削除し、`calcExecutive` 呼び出しの `isGovernmentHealthInsurance: ctx.isGovernmentHealthInsurance` も削除（2箇所）:

修正後の例:
```typescript
interface OptimizeContext {
  comparisonExecutives: ExecutiveInput[];
  rates: RateSettings;
  combineOtherSalaryForInsurance: boolean;
  corporateTaxParams: CorporateTaxParams;
  effectiveTaxRates: EffectiveTaxRates;
  taxYear?: TaxYear;
}
```

calcExecutive 呼び出し箇所:
```typescript
return calcExecutive(exec, ctx.rates, {
  combineOtherSalary: ctx.combineOtherSalaryForInsurance,
  executiveIndex: 0,
  taxYear: ctx.taxYear,
});
```

- [ ] **Step 2: `optimize.test.ts` から `isGovernmentHealthInsurance` 削除**

`src/lib/__tests__/optimize.test.ts` 内の `isGovernmentHealthInsurance: true` 行を削除し、ExecutiveInputの初期化に新フィールド（`preChangeMonthlyRemuneration: 0`, `postChangeMonthlyRemuneration: <salary/12>`, `standardRemunerationChangeMonth: 1`）を追加。

テストファイル内の各ExecutiveInput生成箇所を grep で確認:

```bash
cd koganemushi-cloud
grep -n "regularSalary:" src/lib/__tests__/optimize.test.ts
```

各役員データの `manualHealthInsuranceAmount: 0,` の次に:
```typescript
      manualHealthInsuranceAmount: 0,
      preChangeMonthlyRemuneration: 0,
      postChangeMonthlyRemuneration: <その役員のregularSalaryを12で割った値、または0>,
      standardRemunerationChangeMonth: 1,
```

を追加。`regularSalary: 0` なら `postChangeMonthlyRemuneration: 0`、それ以外は `regularSalary/12` 相当で問題なし（改定月=1なら post だけ使用）。

- [ ] **Step 3: `excel-scenarios.test.ts` も同様に更新**

```bash
cd koganemushi-cloud
grep -n "isGovernmentHealthInsurance\|regularSalary:" src/lib/__tests__/excel-scenarios.test.ts
```

で該当箇所を特定し、`isGovernmentHealthInsurance` を削除、各ExecutiveInput に新フィールド3つを追加（同上のルール）。

- [ ] **Step 4: テスト実行**

```bash
cd koganemushi-cloud
npx vitest run
```

想定: 全テストPASS。

- [ ] **Step 5: コミット**

```bash
git add src/lib/optimize.ts src/lib/__tests__/optimize.test.ts src/lib/__tests__/excel-scenarios.test.ts
git commit -m "tests: 新フィールド対応・政管健保引数を除去"
```

---

## Task 5: Zustandストアとマイグレーション

**Files:**
- Modify: `koganemushi-cloud/src/stores/simulation-store.ts`
- Modify: `koganemushi-cloud/src/hooks/use-computed-results.ts`

- [ ] **Step 1: store から `governmentHealthInsurance` を削除・migrate を追加**

`src/stores/simulation-store.ts` を以下のように変更（全体）:

```typescript
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  RateSettings,
  CorporateTaxParams,
  EffectiveTaxRates,
  ExecutiveInput,
} from "@/types/simulation";
import type { TaxYear } from "@/lib/tax-tables";
import { createDefaultSimulationData, createEmptyExecutive } from "@/lib/defaults";

export type Tab = "simulation" | "hojinzei" | "houkokusho" | "saitekika";

interface SimulationState {
  // Data
  rates: RateSettings;
  corporateTaxParams: CorporateTaxParams;
  effectiveTaxRates: EffectiveTaxRates;
  currentExecutives: ExecutiveInput[];
  comparisonExecutives: ExecutiveInput[];
  plan2Executives: ExecutiveInput[];
  combineOtherSalaryForInsurance: boolean;
  activeTab: Tab;
  taxYear: TaxYear;
  plan1Label: string;
  plan2Label: string;

  // Actions
  setRates: (rates: RateSettings) => void;
  setCorporateTaxParams: (params: CorporateTaxParams) => void;
  updateCurrentExecutive: (index: number, exec: ExecutiveInput) => void;
  updateComparisonExecutive: (index: number, exec: ExecutiveInput) => void;
  transferCurrentToComparison: () => void;
  copyToPlan2: () => void;
  applyDividend: (dividend: number, salary: number) => void;
  applyBonus: (bonus: number) => void;
  setCombineOtherSalaryForInsurance: (checked: boolean) => void;
  setActiveTab: (tab: Tab) => void;
  setTaxYear: (taxYear: TaxYear) => void;
  setPlan1Label: (label: string) => void;
  setPlan2Label: (label: string) => void;
}

const defaults = createDefaultSimulationData();

/** 既存データに新フィールドを補完するマイグレーション */
function migrateExecutive(exec: Partial<ExecutiveInput>): ExecutiveInput {
  const regular = exec.regularSalary ?? 0;
  return {
    ...createEmptyExecutive(),
    ...exec,
    preChangeMonthlyRemuneration: exec.preChangeMonthlyRemuneration ?? 0,
    postChangeMonthlyRemuneration:
      exec.postChangeMonthlyRemuneration ?? (regular > 0 ? Math.floor(regular / 12) : 0),
    standardRemunerationChangeMonth: exec.standardRemunerationChangeMonth ?? 1,
  };
}

export const useSimulationStore = create<SimulationState>()(
  persist(
    (set) => ({
      rates: defaults.rates,
      corporateTaxParams: defaults.corporateTaxParams,
      effectiveTaxRates: defaults.effectiveTaxRates,
      currentExecutives: defaults.currentExecutives,
      comparisonExecutives: defaults.comparisonExecutives,
      plan2Executives: Array.from({ length: 10 }, () => createEmptyExecutive()),
      combineOtherSalaryForInsurance: defaults.combineOtherSalaryForInsurance,
      activeTab: "simulation",
      taxYear: "R8" as TaxYear,
      plan1Label: "",
      plan2Label: "",

      setRates: (rates) => set({ rates }),
      setCorporateTaxParams: (corporateTaxParams) => set({ corporateTaxParams }),

      updateCurrentExecutive: (index, exec) =>
        set((state) => {
          const updated = [...state.currentExecutives];
          updated[index] = exec;
          return { currentExecutives: updated };
        }),

      updateComparisonExecutive: (index, exec) =>
        set((state) => {
          const updated = [...state.comparisonExecutives];
          updated[index] = exec;
          return { comparisonExecutives: updated };
        }),

      transferCurrentToComparison: () =>
        set((state) => ({
          comparisonExecutives: state.currentExecutives.map((e) => ({ ...e })),
        })),

      copyToPlan2: () =>
        set((state) => ({
          plan2Executives: state.comparisonExecutives.map((e) => ({ ...e })),
        })),

      applyDividend: (dividend, salary) =>
        set((state) => {
          const updated = [...state.comparisonExecutives];
          updated[0] = { ...updated[0], dividendIncome: dividend, regularSalary: salary };
          return { comparisonExecutives: updated };
        }),

      applyBonus: (bonus) =>
        set((state) => {
          const updated = [...state.comparisonExecutives];
          updated[0] = { ...updated[0], predeterminedBonus1: bonus };
          return { comparisonExecutives: updated };
        }),

      setCombineOtherSalaryForInsurance: (combineOtherSalaryForInsurance) =>
        set({ combineOtherSalaryForInsurance }),

      setActiveTab: (activeTab) => set({ activeTab }),
      setTaxYear: (taxYear) => set({ taxYear }),
      setPlan1Label: (plan1Label) => set({ plan1Label }),
      setPlan2Label: (plan2Label) => set({ plan2Label }),
    }),
    {
      name: "koganemushi-simulation",
      version: 2,
      migrate: (persistedState: unknown, version: number) => {
        const s = persistedState as Record<string, unknown>;
        if (version < 2 && s && typeof s === "object") {
          delete s.governmentHealthInsurance;
          if (Array.isArray(s.currentExecutives)) {
            s.currentExecutives = (s.currentExecutives as Partial<ExecutiveInput>[]).map(migrateExecutive);
          }
          if (Array.isArray(s.comparisonExecutives)) {
            s.comparisonExecutives = (s.comparisonExecutives as Partial<ExecutiveInput>[]).map(migrateExecutive);
          }
          if (Array.isArray(s.plan2Executives)) {
            s.plan2Executives = (s.plan2Executives as Partial<ExecutiveInput>[]).map(migrateExecutive);
          }
        }
        return s;
      },
      partialize: (state) => ({
        rates: state.rates,
        corporateTaxParams: state.corporateTaxParams,
        effectiveTaxRates: state.effectiveTaxRates,
        currentExecutives: state.currentExecutives,
        comparisonExecutives: state.comparisonExecutives,
        plan2Executives: state.plan2Executives,
        combineOtherSalaryForInsurance: state.combineOtherSalaryForInsurance,
        taxYear: state.taxYear,
        plan1Label: state.plan1Label,
        plan2Label: state.plan2Label,
      }),
    }
  )
);
```

- [ ] **Step 2: `use-computed-results.ts` から `governmentHealthInsurance` 参照を削除**

`src/hooks/use-computed-results.ts` を以下で置き換え:

```typescript
import { useMemo } from "react";
import { useSimulationStore } from "@/stores/simulation-store";
import { useShallow } from "zustand/react/shallow";
import { calcExecutive, sumResults, calcCorporateTaxTotal } from "@/lib/calc-engine";
import type { ExecutiveInput, ExecutiveResult } from "@/types/simulation";

function calcExecPay(executives: ExecutiveInput[]): number {
  return executives.reduce(
    (s, e) =>
      s +
      e.regularSalary +
      e.predeterminedBonus1 +
      e.predeterminedBonus2 +
      e.predeterminedBonus3,
    0
  );
}

interface PlanResults {
  results: ExecutiveResult[];
  totals: ExecutiveResult;
  execPay: number;
  corporateIncome: number;
  corporateTax: number;
}

function usePlanResults(executives: ExecutiveInput[]): PlanResults {
  const { rates, combineOtherSalaryForInsurance, corporateTaxParams, effectiveTaxRates, taxYear } =
    useSimulationStore(
      useShallow((s) => ({
        rates: s.rates,
        combineOtherSalaryForInsurance: s.combineOtherSalaryForInsurance,
        corporateTaxParams: s.corporateTaxParams,
        effectiveTaxRates: s.effectiveTaxRates,
        taxYear: s.taxYear,
      }))
    );

  const results = useMemo(
    () =>
      executives.map((exec, i) =>
        calcExecutive(exec, rates, {
          combineOtherSalary: combineOtherSalaryForInsurance,
          executiveIndex: i,
          taxYear,
        })
      ),
    [executives, rates, combineOtherSalaryForInsurance, taxYear]
  );

  const totals = useMemo(() => sumResults(results), [results]);
  const execPay = useMemo(() => calcExecPay(executives), [executives]);

  const corporateIncome = useMemo(
    () => corporateTaxParams.preTaxCorporateIncome - execPay - totals.employerSocialInsurance,
    [corporateTaxParams.preTaxCorporateIncome, execPay, totals.employerSocialInsurance]
  );

  const corporateTax = useMemo(
    () =>
      calcCorporateTaxTotal(corporateTaxParams, execPay, totals.employerSocialInsurance, effectiveTaxRates),
    [corporateTaxParams, execPay, totals.employerSocialInsurance, effectiveTaxRates]
  );

  return { results, totals, execPay, corporateIncome, corporateTax };
}

export function useCurrentResults(): PlanResults {
  const currentExecutives = useSimulationStore((s) => s.currentExecutives);
  return usePlanResults(currentExecutives);
}

export function useComparisonResults(): PlanResults {
  const comparisonExecutives = useSimulationStore((s) => s.comparisonExecutives);
  return usePlanResults(comparisonExecutives);
}

export function usePlan2Results(): PlanResults {
  const plan2Executives = useSimulationStore((s) => s.plan2Executives);
  return usePlanResults(plan2Executives);
}
```

- [ ] **Step 3: 型チェック・テスト実行**

```bash
cd koganemushi-cloud
npx tsc --noEmit
npx vitest run
```

想定: エラーなし、全テストPASS。

- [ ] **Step 4: コミット**

```bash
git add src/stores/simulation-store.ts src/hooks/use-computed-results.ts
git commit -m "store: 政管健保フラグを削除・旧データマイグレーションを追加"
```

---

## Task 6: optimization-sheet から政管健保参照を削除

**Files:**
- Modify: `koganemushi-cloud/src/components/optimization-sheet.tsx`

- [ ] **Step 1: `isGovernmentHealthInsurance` を削除**

`src/components/optimization-sheet.tsx` の `useSimulationStore` selector 部分（L16-31付近）で:

修正前:
```typescript
      comparisonExecutives: s.comparisonExecutives,
      rates: s.rates,
      isGovernmentHealthInsurance: s.governmentHealthInsurance,
      combineOtherSalaryForInsurance: s.combineOtherSalaryForInsurance,
```

修正後:
```typescript
      comparisonExecutives: s.comparisonExecutives,
      rates: s.rates,
      combineOtherSalaryForInsurance: s.combineOtherSalaryForInsurance,
```

そして `useMemo` など後続で `isGovernmentHealthInsurance` を参照している箇所（L47-51付近の OptimizeContext 作成部分）からも削除。

- [ ] **Step 2: 型チェック**

```bash
cd koganemushi-cloud
npx tsc --noEmit
```

- [ ] **Step 3: コミット**

```bash
git add src/components/optimization-sheet.tsx
git commit -m "optimization-sheet: 政管健保参照を削除"
```

---

## Task 7: ExecutiveTable に新フィールド行・「社会保険」ラベル追加

**Files:**
- Modify: `koganemushi-cloud/src/components/executive-table.tsx`

- [ ] **Step 1: `rows` 配列に3行追加**

`src/components/executive-table.tsx` の `rows` 配列（L20-49）を修正。`定期同額` の直下（L24）に3行挿入:

```typescript
const rows: RowDef[] = [
  { label: "役員名", key: "input", field: "name" },
  { label: "年齢", key: "input", field: "age" },
  { label: "定期同額", key: "input", field: "regularSalary", inputBg: "bg-yellow-50" },
  { label: "変更前月額", key: "input", field: "preChangeMonthlyRemuneration", inputBg: "bg-yellow-50" },
  { label: "変更後月額", key: "input", field: "postChangeMonthlyRemuneration", inputBg: "bg-yellow-50" },
  { label: "改定月", key: "input", field: "standardRemunerationChangeMonth", inputBg: "bg-yellow-50" },
  { label: "事前確定給与1回目", key: "input", field: "predeterminedBonus1", inputBg: "bg-yellow-50" },
  // ... 以降同じ
```

- [ ] **Step 2: `CellInput` に月数入力バリエーション追加**

L119-164 の `CellInput` コンポーネントを以下で置き換え:

```typescript
function CellInput({
  value,
  onChange,
  isName,
  isAge,
  isMonth,
  bg,
}: {
  value: string | number;
  onChange: (v: string | number) => void;
  isName?: boolean;
  isAge?: boolean;
  isMonth?: boolean;
  bg?: string;
}) {
  if (isName) {
    return (
      <input
        type="text"
        className={`w-full px-1 py-0.5 text-sm border-0 focus:outline-none focus:ring-1 focus:ring-blue-400 ${bg ?? ""}`}
        value={value as string}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (isAge || isMonth) {
    const min = isMonth ? 1 : 0;
    const max = isMonth ? 13 : undefined;
    return (
      <input
        type="number"
        min={min}
        max={max}
        className={`w-full px-1 py-0.5 text-sm text-right border-0 focus:outline-none focus:ring-1 focus:ring-blue-400 ${bg ?? ""}`}
        value={value === 0 ? "" : value}
        onChange={(e) => {
          const n = parseInt(e.target.value) || 0;
          if (isMonth) {
            onChange(Math.min(13, Math.max(1, n || 1)));
          } else {
            onChange(n);
          }
        }}
      />
    );
  }

  // 金額入力
  return (
    <input
      type="text"
      className={`w-full px-1 py-0.5 text-sm text-right border-0 focus:outline-none focus:ring-1 focus:ring-blue-400 ${bg ?? ""}`}
      defaultValue={value === 0 ? "" : formatYen(value as number)}
      onBlur={(e) => onChange(parseYen(e.target.value))}
      key={String(value)}
    />
  );
}
```

- [ ] **Step 3: `renderInputCell` で `isMonth` フラグを渡す**

L79-92 の `renderInputCell` を以下で置き換え:

```typescript
function renderInputCell(row: RowDef, ctx: CellContext): React.ReactNode {
  const field = row.field!;
  return (
    <td key={ctx.index} className={`border px-0 py-0 ${row.inputBg ?? ""}`}>
      <CellInput
        value={ctx.exec[field] as string | number}
        onChange={(v) => ctx.updateField(ctx.index, field, v)}
        isName={field === "name"}
        isAge={field === "age"}
        isMonth={field === "standardRemunerationChangeMonth"}
        bg={row.inputBg}
      />
    </td>
  );
}
```

- [ ] **Step 4: ヘッダー左上に「社会保険」ラベル追加**

L196-198 付近の「加入」チェックボックス行の左端 `<th>` を修正:

修正前:
```tsx
          <tr className="border-b">
            <th className="sticky left-0 bg-white z-10 border px-2 py-1 text-left w-36 min-w-36">
              {/* empty */}
            </th>
```

修正後:
```tsx
          <tr className="border-b">
            <th className="sticky left-0 bg-white z-10 border px-2 py-1 text-left w-36 min-w-36">
              <span className="text-xs font-bold">社会保険</span>
            </th>
```

- [ ] **Step 5: 型チェック**

```bash
cd koganemushi-cloud
npx tsc --noEmit
```

- [ ] **Step 6: コミット**

```bash
git add src/components/executive-table.tsx
git commit -m "executive-table: 変更前後月額・改定月行を追加・社会保険ラベル追加"
```

---

## Task 8: yakuin-hoshu ページから政管健保チェックボックス削除

**Files:**
- Modify: `koganemushi-cloud/src/app/yakuin-hoshu/page.tsx`

- [ ] **Step 1: selector と UI から削除**

`src/app/yakuin-hoshu/page.tsx` の `useSimulationStore` 呼び出し（L26-48）から `governmentHealthInsurance` と `setGovernmentHealthInsurance` を削除:

修正後:
```typescript
  const {
    activeTab,
    setActiveTab,
    combineOtherSalaryForInsurance,
    setCombineOtherSalaryForInsurance,
    transferCurrentToComparison,
    taxYear,
    setTaxYear,
  } = useSimulationStore(
    useShallow((s) => ({
      activeTab: s.activeTab,
      setActiveTab: s.setActiveTab,
      combineOtherSalaryForInsurance: s.combineOtherSalaryForInsurance,
      setCombineOtherSalaryForInsurance: s.setCombineOtherSalaryForInsurance,
      transferCurrentToComparison: s.transferCurrentToComparison,
      taxYear: s.taxYear,
      setTaxYear: s.setTaxYear,
    }))
  );
```

そして、UI（L82-88）の政管健保チェックボックスのlabel全体を削除:

修正前:
```tsx
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={governmentHealthInsurance}
                  onCheckedChange={(c) => setGovernmentHealthInsurance(!!c)}
                />
                政管健保（協会けんぽ）
              </label>
```

この `<label>` 要素をまるごと削除する。

- [ ] **Step 2: 型チェック**

```bash
cd koganemushi-cloud
npx tsc --noEmit
```

- [ ] **Step 3: コミット**

```bash
git add src/app/yakuin-hoshu/page.tsx
git commit -m "yakuin-hoshu: 政管健保チェックボックスを削除"
```

---

## Task 9: ビルド・テスト確認

- [ ] **Step 1: 全テスト実行**

```bash
cd koganemushi-cloud
npx vitest run
```

想定: 全テストPASS。

- [ ] **Step 2: 本番ビルド**

```bash
cd koganemushi-cloud
npm run build
```

想定: エラーなく完了。

- [ ] **Step 3: dev server で動作確認**

既存の dev server が localhost:3000 で稼働中のため、ブラウザで http://localhost:3000/yakuin-hoshu を開き、以下を確認:
- テーブル左上に「社会保険」ラベル表示
- 定期同額の直下に「変更前月額」「変更後月額」「改定月」の3行
- 政管健保チェックボックスが消えている
- localStorage に保存済みの旧データでもクラッシュしない

問題あれば修正して該当タスクを再実行。

---

## Task 10: 仕様書への追記

**Files:**
- Modify: `docs/yakuin-hoshu/計算ロジック仕様書.md`

- [ ] **Step 1: 仕様書末尾に新ロジックを追記**

`docs/yakuin-hoshu/計算ロジック仕様書.md` の末尾に以下セクションを追加:

```markdown

## 標準報酬変更タイミング（期中改定）

### 概要

標準報酬月額は、役員報酬の変更後、初めて変更後の報酬を受けた月から起算して
4ヶ月目に改定される。これをシミュレーションに反映するため、役員ごとに
以下3フィールドを設けて計算する。

### 入力フィールド

- `preChangeMonthlyRemuneration`: 変更前月額報酬（円）
- `postChangeMonthlyRemuneration`: 変更後月額報酬（円）
- `standardRemunerationChangeMonth`: 改定月 `m`（1〜13、デフォルト1）

### 計算式（定期同額ベース）

変更前期間の月数 = `m − 1`、変更後期間の月数 = `13 − m`

月額保険料 `f(monthly)` に対して、年間保険料は:

```
annual = f(pre) × (m − 1) + f(post) × (13 − m)
```

これを以下に適用:
- 健康保険料（個人・会社）
- 厚生年金保険料（個人・会社）
- 子ども・子育て支援金（個人・会社）

子ども・子育て拠出金は従来どおり `regularSalary`（年間）ベース。
賞与分（事前確定給与）は改定月の影響を受けず従来どおりの加算。

### 健保任意入力フラグ

役員単位の `manualHealthInsurance = true` のとき:
- 健康保険料（個人）= `manualHealthInsuranceAmount`（年額、分割なし）
- 会社負担健康保険料 = 0
- 子ども・子育て支援金（個人・会社）= 0
- 厚生年金は分割計算（フラグの影響なし）
- 賞与健康保険料（個人・会社）= 0

### 後方互換

- `m = 1`: `post` のみで12ヶ月計算（従来挙動と一致）
- `pre = 0`: 変更前期間の社保ゼロ
- `post = 0`: 変更後期間の社保ゼロ

### 政管健保フラグ廃止の経緯

従来の `SimulationData.governmentHealthInsurance`（グローバル）は役員ごとの
`manualHealthInsurance` と機能が重複していたため廃止。健保組合など協会けんぽ
以外の場合は、各役員の「健保任意入力」チェックを有効にして健康保険料を
直接入力することで同等の扱いとする。
```

- [ ] **Step 2: コミット**

```bash
cd ..
git add docs/yakuin-hoshu/計算ロジック仕様書.md
git commit -m "docs: 計算ロジック仕様書に標準報酬変更タイミング節を追記"
```

---

## 完了条件

- [x] 設計書承認済み（`docs/superpowers/specs/2026-04-20-standard-remuneration-change-design.md`）
- [ ] すべてのタスク（Task 1〜10）完了
- [ ] `npx vitest run` 全件pass
- [ ] `npm run build` エラーなし
- [ ] ブラウザ動作確認（3行追加・ラベル追加・政管健保削除・既存データマイグレーション）
- [ ] 仕様書追記済み
