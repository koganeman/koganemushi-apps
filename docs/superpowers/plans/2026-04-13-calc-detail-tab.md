# 計算明細タブ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 法人成りシミュレーションに「計算明細」タブを追加し、現状/Plan1/Plan2の所得税・住民税・法人税・手取り額の計算過程を税理士向けに一覧表示する

**Architecture:** 既存の `calcIndivTax()` と `calcCorpSide()` を拡張して中間計算値を返すようにし、`PlanResult` に新フィールドを追加。新コンポーネント `calc-detail-sheet.tsx` で3列比較テーブルとして表示。

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Tailwind CSS 4, Zustand

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/types/hojinnari.ts` | Modify | `TaxDetailBreakdown` / `CorpTaxDetailBreakdown` 型追加、`PlanResult` にフィールド追加 |
| `src/lib/hojinnari-calc.ts` | Modify | `calcIndivTax()` → 中間値を返す、`calcCorpSide()` → 中間値を返す、Plan1/Plan2で新フィールドを埋める |
| `src/lib/calc-engine.ts` | Modify | `calcIncomeTaxWithDetail()` 関数追加（税率・控除額の内訳を返す） |
| `src/components/hojinnari/calc-detail-sheet.tsx` | Create | 計算明細タブのUIコンポーネント |
| `src/stores/hojinnari-store.ts` | Modify | `HojinnariTab` に `"keisan-meisai"` 追加 |
| `src/app/hojinnari/page.tsx` | Modify | タブ追加・コンポーネント読み込み |

---

### Task 1: 型定義の追加

**Files:**
- Modify: `src/types/hojinnari.ts`

- [ ] **Step 1: `TaxDetailBreakdown` と `CorpTaxDetailBreakdown` 型を追加**

`src/types/hojinnari.ts` の末尾（`HojinnariResult` の後）に以下を追加:

```typescript
/** 個人所得税・住民税の計算明細 */
export interface TaxDetailBreakdown {
  // 収入・所得金額
  salaryRevenue: number;              // 給与収入
  salaryAfterDeduction: number;       // 給与所得金額
  pensionRevenue: number;             // 年金収入
  pensionAfterDeduction: number;      // 年金雑所得
  businessIncome: number;             // 事業所得（青色控除後）
  otherIncome: number;                // 他の所得金額
  totalIncome: number;                // 所得金額（合計）
  // 所得控除
  socialInsuranceDeduction: number;   // 社会保険料控除額
  otherDeductions: number;            // その他所得控除
  basicDeduction: number;             // 基礎控除
  totalDeductions: number;            // 所得控除合計
  // 税金計算
  taxableIncome: number;              // 課税所得金額
  incomeTaxRate: number;              // 適用税率
  incomeTaxRateDeduction: number;     // 税率控除額
  incomeTaxBase: number;              // 所得税額（基本）
  incomeTaxRecovery: number;          // 復興特別所得税
  incomeTax: number;                  // 所得税（100円未満切り捨て）
  residentTax: number;                // 住民税
  // 個人事業税
  individualBusinessTax: number;      // 個人事業税
}

/** 法人税の計算明細 */
export interface CorpTaxDetailBreakdown {
  // 法人所得
  revenue: number;                    // 法人売上
  salaries: number;                   // 役員報酬＋配偶者給与
  employerSocialInsurance: number;    // 社保会社負担（役員＋従業員）
  corporateIncome: number;            // 法人所得（1,000円未満切り捨て後）
  // 法人税
  corporateTaxRate: string;           // 適用区分（"800万以下" or "800万超"）
  corporateTax: number;               // 法人税額
  // 法人事業税
  businessTax: number;                // 法人事業税
  // 内部留保
  corporateRetained: number;          // 法人内部留保
}

/** 手取り額の計算明細 */
export interface NetIncomeDetailBreakdown {
  // 収入合計
  businessIncome: number;             // 事業所得（事業収入そのもの、青色控除前）
  salaryRevenue: number;              // 給与収入
  pensionRevenue: number;             // 年金収入
  otherIncome: number;                // 他の所得
  totalRevenue: number;               // 収入合計
  // 控除項目
  incomeTax: number;                  // 所得税
  residentTax: number;                // 住民税
  individualBusinessTax: number;      // 個人事業税
  socialInsurance: number;            // 社会保険料
  totalDeductions: number;            // 控除合計
  // 手取り
  netIncome: number;                  // 手取り額
}
```

- [ ] **Step 2: `PlanResult` にdetailフィールドを追加**

`PlanResult` の末尾（`combinedNetIncome` の後）に以下を追加:

```typescript
  // 計算明細
  taxDetail: TaxDetailBreakdown;           // 個人税の計算明細
  corpTaxDetail: CorpTaxDetailBreakdown;   // 法人税の計算明細
  netIncomeDetail: NetIncomeDetailBreakdown; // 手取り額の計算明細
```

- [ ] **Step 3: `IndividualResult` にdetailフィールドを追加**

`IndividualResult` の末尾（`combinedNetIncome` の後）に以下を追加:

```typescript
  // 計算明細
  taxDetail: TaxDetailBreakdown;              // 個人税の計算明細
  netIncomeDetail: NetIncomeDetailBreakdown;  // 手取り額の計算明細
```

- [ ] **Step 4: ビルド確認**

Run: `cd /c/Users/manab/Documents/koganemushi_App/koganemushi-cloud && npx tsc --noEmit 2>&1 | head -30`
Expected: 型エラーあり（PlanResult/IndividualResultの新フィールドが未実装のため）。これはTask 2で解消する。

- [ ] **Step 5: Commit**

```bash
git add src/types/hojinnari.ts
git commit -m "feat(hojinnari): add TaxDetailBreakdown, CorpTaxDetailBreakdown, NetIncomeDetailBreakdown types"
```

---

### Task 2: calc-engine.ts に所得税の内訳関数を追加

**Files:**
- Modify: `src/lib/calc-engine.ts`

- [ ] **Step 1: `calcIncomeTaxWithDetail()` を追加**

`src/lib/calc-engine.ts` の `calcIncomeTax()` 関数の直後に以下を追加:

```typescript
/**
 * 所得税の計算（内訳付き）
 * 復興特別所得税（2.1%）込み。100円未満切り捨て。
 */
export function calcIncomeTaxWithDetail(taxableIncome: number): {
  rate: number;
  rateDeduction: number;
  base: number;
  recovery: number;
  total: number;
} {
  let rate = 0;
  let rateDeduction = 0;
  for (const [limit, r, d] of INCOME_TAX_TABLE) {
    if (taxableIncome <= limit) {
      rate = r;
      rateDeduction = d;
      break;
    }
  }
  const base = taxableIncome * rate - rateDeduction;
  const recovery = base * 0.021;
  const total = Math.floor((base + recovery) / 100) * 100;
  return { rate, rateDeduction, base, recovery, total };
}
```

- [ ] **Step 2: ビルド確認**

Run: `cd /c/Users/manab/Documents/koganemushi_App/koganemushi-cloud && npx tsc --noEmit 2>&1 | head -5`

- [ ] **Step 3: Commit**

```bash
git add src/lib/calc-engine.ts
git commit -m "feat(calc-engine): add calcIncomeTaxWithDetail for tax breakdown"
```

---

### Task 3: hojinnari-calc.ts を拡張して中間値を返す

**Files:**
- Modify: `src/lib/hojinnari-calc.ts`

- [ ] **Step 1: importを更新**

`src/lib/hojinnari-calc.ts` の先頭のimportを修正:

型のimport（1行目〜）に追加:

```typescript
import type {
  HojinnariInput,
  HojinnariRates,
  FamilyMember,
  FamilyMemberResult,
  IndividualResult,
  PlanResult,
  CorporateResult,
  HojinnariResult,
  TaxDetailBreakdown,
  CorpTaxDetailBreakdown,
  NetIncomeDetailBreakdown,
} from "@/types/hojinnari";
```

calc-engineのimportに `calcIncomeTaxWithDetail` を追加:

```typescript
import {
  calcIncomeTax,
  calcIncomeTaxWithDetail,
  calcBasicDeduction,
  calcSalaryIncome,
} from "./calc-engine";
```

- [ ] **Step 2: `calcIndivTax()` を拡張して `TaxDetailBreakdown` を返す**

`calcIndivTax()` 関数（444行目付近）のインターフェースと本体を以下に差し替え:

```typescript
interface IndivTaxInput {
  totalIncome: number;
  socialInsurance: number;
  otherDeductions: number;
  // 明細用の追加情報
  salaryRevenue: number;
  salaryAfterDeduction: number;
  pensionRevenue: number;
  pensionAfterDeduction: number;
  businessIncome: number;
  otherIncome: number;
}

interface IndivTaxResult {
  incomeTax: number;
  residentTax: number;
  taxTotal: number;
  detail: TaxDetailBreakdown;
}

function calcIndivTax(p: IndivTaxInput, individualBusinessTax: number = 0): IndivTaxResult {
  const basic = calcBasicDeduction(p.totalIncome);
  const totalDeductions = basic + p.socialInsurance + p.otherDeductions;
  // 課税所得は1,000円未満切り捨て
  const taxable = Math.floor(Math.max(0, p.totalIncome - totalDeductions) / 1000) * 1000;
  const taxDetail = calcIncomeTaxWithDetail(taxable);
  const incomeTax = taxDetail.total;
  const residentTax = Math.floor(taxable * 0.1);

  const detail: TaxDetailBreakdown = {
    salaryRevenue: p.salaryRevenue,
    salaryAfterDeduction: p.salaryAfterDeduction,
    pensionRevenue: p.pensionRevenue,
    pensionAfterDeduction: p.pensionAfterDeduction,
    businessIncome: p.businessIncome,
    otherIncome: p.otherIncome,
    totalIncome: p.totalIncome,
    socialInsuranceDeduction: p.socialInsurance,
    otherDeductions: p.otherDeductions,
    basicDeduction: basic,
    totalDeductions,
    taxableIncome: taxable,
    incomeTaxRate: taxDetail.rate,
    incomeTaxRateDeduction: taxDetail.rateDeduction,
    incomeTaxBase: taxDetail.base,
    incomeTaxRecovery: taxDetail.recovery,
    incomeTax,
    residentTax,
    individualBusinessTax,
  };

  return { incomeTax, residentTax, taxTotal: incomeTax + residentTax, detail };
}
```

- [ ] **Step 3: `calcCorpSide()` を拡張して `CorpTaxDetailBreakdown` を返す**

`CorpSideResult` インターフェースと `calcCorpSide()` を更新。`CorpSideResult` に `corpTaxDetail` を追加:

```typescript
interface CorpSideResult {
  corporateIncome: number;
  corporateTax: number;
  corporateBusinessTax: number;
  corporateRetained: number;
  employeeEmployerSI: number;
  medicalSocialInsuranceIncome: number;
  corpTaxDetail: CorpTaxDetailBreakdown;
}
```

`calcCorpSide()` の `return` 文の直前に以下を追加:

```typescript
  const corpTaxDetail: CorpTaxDetailBreakdown = {
    revenue,
    salaries,
    employerSocialInsurance: totalEmployerSI,
    corporateIncome,
    corporateTaxRate: corporateIncome <= 8000000 ? "800万以下" : "800万超",
    corporateTax,
    businessTax: corporateBusinessTax,
    corporateRetained,
  };
```

return文を更新:
```typescript
  return { corporateIncome, corporateTax, corporateBusinessTax, corporateRetained, employeeEmployerSI, medicalSocialInsuranceIncome, corpTaxDetail };
```

- [ ] **Step 4: `calcIndividual()` を更新**

`calcIndividual()` 関数内（349行目付近）で `calcIncomeTax` を `calcIncomeTaxWithDetail` に変更し、中間値を使う。

所得税の計算部分を変更:
```typescript
  // 所得税（復興特別税込み・100円未満切り捨て）
  const incomeTaxDetail = calcIncomeTaxWithDetail(taxableIncome);
  const incomeTax = incomeTaxDetail.total;
```

return文に `taxDetail` と `netIncomeDetail` を追加:
```typescript
    taxDetail: {
      salaryRevenue: ownerSalaryIncome,
      salaryAfterDeduction,
      pensionRevenue: ownerPensionIncome,
      pensionAfterDeduction,
      businessIncome: adjustedIncome,
      otherIncome: ownerOtherIncome,
      totalIncome: totalIncome,
      socialInsuranceDeduction: ownerNationalInsurance,
      otherDeductions: ownerOtherDeductions,
      basicDeduction,
      totalDeductions: basicDeduction + ownerNationalInsurance + ownerOtherDeductions,
      taxableIncome,
      incomeTaxRate: incomeTaxDetail.rate,
      incomeTaxRateDeduction: incomeTaxDetail.rateDeduction,
      incomeTaxBase: incomeTaxDetail.base,
      incomeTaxRecovery: incomeTaxDetail.recovery,
      incomeTax,
      residentTax,
      individualBusinessTax,
    },
    netIncomeDetail: {
      businessIncome: input.businessIncome,
      salaryRevenue: ownerSalaryIncome,
      pensionRevenue: ownerPensionIncome,
      otherIncome: ownerOtherIncome,
      totalRevenue: input.businessIncome + ownerSalaryIncome + ownerPensionIncome + ownerOtherIncome,
      incomeTax,
      residentTax,
      individualBusinessTax,
      socialInsurance: ownerNationalInsurance,
      totalDeductions: incomeTax + residentTax + individualBusinessTax + ownerNationalInsurance,
      netIncome: netIncome,
    },
```

- [ ] **Step 5: `calcPlan1()` を更新**

`calcPlan1()` 内で `calcIndivTax()` 呼び出しに追加引数を渡す。まず `individualBusinessTax` を計算してから `calcIndivTax` を呼ぶよう順序調整:

```typescript
  const individualBusinessTax = calcIndividualBusinessTax(adjustedIndividual);

  const tax = calcIndivTax({
    totalIncome: individualTotalIncome,
    socialInsurance: ownerSocialInsurance,
    otherDeductions: ownerOtherDeductions,
    salaryRevenue: plan1MicroSalary + ownerSalaryIncome,
    salaryAfterDeduction,
    pensionRevenue: ownerPensionIncome,
    pensionAfterDeduction,
    businessIncome: adjustedIndividual,
    otherIncome: ownerOtherIncome,
  }, individualBusinessTax);
```

return文に `taxDetail`, `corpTaxDetail`, `netIncomeDetail` を追加:
```typescript
    taxDetail: tax.detail,
    corpTaxDetail: corp.corpTaxDetail,
    netIncomeDetail: {
      businessIncome: remainingBusiness,
      salaryRevenue: plan1MicroSalary + ownerSalaryIncome,
      pensionRevenue: ownerPensionIncome,
      otherIncome: ownerOtherIncome,
      totalRevenue: remainingBusiness + plan1MicroSalary + ownerSalaryIncome + ownerPensionIncome + ownerOtherIncome,
      incomeTax: tax.incomeTax,
      residentTax: tax.residentTax,
      individualBusinessTax,
      socialInsurance: ownerSocialInsurance,
      totalDeductions: tax.incomeTax + tax.residentTax + individualBusinessTax + ownerSocialInsurance,
      netIncome: ownerNetIncome,
    },
```

- [ ] **Step 6: `calcPlan2()` を更新**

`calcPlan2()` 内で同様に `calcIndivTax()` 呼び出しを更新:

```typescript
  const tax = calcIndivTax({
    totalIncome: individualTotalIncome,
    socialInsurance: ownerSocialInsurance,
    otherDeductions: ownerOtherDeductions,
    salaryRevenue: plan2Salary + ownerSalaryIncome,
    salaryAfterDeduction,
    pensionRevenue: ownerPensionIncome,
    pensionAfterDeduction,
    businessIncome: 0,
    otherIncome: ownerOtherIncome,
  }, 0);
```

return文に `taxDetail`, `corpTaxDetail`, `netIncomeDetail` を追加:
```typescript
    taxDetail: tax.detail,
    corpTaxDetail: corp.corpTaxDetail,
    netIncomeDetail: {
      businessIncome: 0,
      salaryRevenue: plan2Salary + ownerSalaryIncome,
      pensionRevenue: ownerPensionIncome,
      otherIncome: ownerOtherIncome,
      totalRevenue: plan2Salary + ownerSalaryIncome + ownerPensionIncome + ownerOtherIncome,
      incomeTax: tax.incomeTax,
      residentTax: tax.residentTax,
      individualBusinessTax: 0,
      socialInsurance: ownerSocialInsurance,
      totalDeductions: tax.incomeTax + tax.residentTax + ownerSocialInsurance,
      netIncome: ownerNetIncome,
    },
```

- [ ] **Step 7: `calcFamilyMemberTax()` の所得税計算を `calcIncomeTaxWithDetail` に更新**

319行目付近の `calcFamilyMemberTax()` 内:

```typescript
  const incomeTax = Math.floor(calcIncomeTax(taxableIncome) / 100) * 100;
```
を:
```typescript
  const incomeTax = calcIncomeTaxWithDetail(taxableIncome).total;
```
に変更。

- [ ] **Step 8: ビルド確認**

Run: `cd /c/Users/manab/Documents/koganemushi_App/koganemushi-cloud && npx tsc --noEmit 2>&1 | head -20`
Expected: エラーなし

- [ ] **Step 9: テスト実行**

Run: `cd /c/Users/manab/Documents/koganemushi_App/koganemushi-cloud && npx vitest run 2>&1 | tail -20`
Expected: 既存テストがPASS（100円未満切り捨ての変更でテスト値が変わる場合は修正）

- [ ] **Step 10: Commit**

```bash
git add src/lib/hojinnari-calc.ts src/lib/calc-engine.ts
git commit -m "feat(hojinnari): extend calcIndivTax and calcCorpSide to return detailed breakdowns"
```

---

### Task 4: Store にタブを追加

**Files:**
- Modify: `src/stores/hojinnari-store.ts`

- [ ] **Step 1: `HojinnariTab` に `"keisan-meisai"` を追加**

```typescript
export type HojinnariTab = "simulation" | "houjinnari" | "houkokusho" | "saitekika" | "keisan-meisai";
```

- [ ] **Step 2: Commit**

```bash
git add src/stores/hojinnari-store.ts
git commit -m "feat(hojinnari): add keisan-meisai tab type"
```

---

### Task 5: 計算明細コンポーネントを作成

**Files:**
- Create: `src/components/hojinnari/calc-detail-sheet.tsx`

- [ ] **Step 1: `calc-detail-sheet.tsx` を作成**

```tsx
"use client";

import { useHojinnariStore } from "@/stores/hojinnari-store";
import { useShallow } from "zustand/react/shallow";
import { calcIndividual, calcPlan1, calcPlan2 } from "@/lib/hojinnari-calc";
import { formatYen } from "@/lib/format";
import type {
  TaxDetailBreakdown,
  CorpTaxDetailBreakdown,
  NetIncomeDetailBreakdown,
} from "@/types/hojinnari";

function fmtOrEmpty(value: number): string {
  if (value === 0) return "";
  return formatYen(value);
}

function fmtPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

// ============================================================
// 個人所得税・住民税の計算明細テーブル
// ============================================================

function PersonalTaxDetailTable({
  current,
  plan1,
  plan2,
}: {
  current: TaxDetailBreakdown;
  plan1: TaxDetailBreakdown;
  plan2: TaxDetailBreakdown;
}) {
  const thCls =
    "py-1.5 px-2 text-right text-[11px] font-bold text-white bg-[#1f3f7a] border border-gray-400";
  const thLabelCls = `${thCls} text-left`;
  const tdLabel =
    "py-1 px-2 text-[11px] text-gray-700 border border-gray-300 whitespace-nowrap";
  const tdVal =
    "py-1 px-2 text-right text-[11px] font-mono border border-gray-300";
  const tdBoldLabel =
    "py-1 px-2 text-[11px] font-bold text-gray-900 border border-gray-300 whitespace-nowrap";
  const tdBoldVal =
    "py-1 px-2 text-right text-[11px] font-mono font-bold border border-gray-300";
  const sectionCls =
    "py-1 px-2 text-[11px] font-bold text-white bg-[#4472C4] border border-gray-400";

  type Row = {
    label: string;
    field: keyof TaxDetailBreakdown;
    bold?: boolean;
    format?: "yen" | "percent";
  };

  const sections: { title: string; rows: Row[] }[] = [
    {
      title: "▼ 収入・所得金額",
      rows: [
        { label: "事業所得（青色控除後）", field: "businessIncome" },
        { label: "給与収入", field: "salaryRevenue" },
        { label: "給与所得金額", field: "salaryAfterDeduction" },
        { label: "年金収入", field: "pensionRevenue" },
        { label: "年金雑所得", field: "pensionAfterDeduction" },
        { label: "他の所得金額", field: "otherIncome" },
        { label: "所得金額（合計）", field: "totalIncome", bold: true },
      ],
    },
    {
      title: "▼ 所得控除",
      rows: [
        { label: "社会保険料控除額", field: "socialInsuranceDeduction" },
        { label: "その他所得控除", field: "otherDeductions" },
        { label: "基礎控除", field: "basicDeduction" },
        { label: "所得控除合計", field: "totalDeductions", bold: true },
      ],
    },
    {
      title: "▼ 税金計算",
      rows: [
        { label: "課税所得金額", field: "taxableIncome", bold: true },
        { label: "適用税率", field: "incomeTaxRate", format: "percent" },
        { label: "税率控除額", field: "incomeTaxRateDeduction" },
        { label: "所得税額（基本）", field: "incomeTaxBase" },
        { label: "復興特別所得税（2.1%）", field: "incomeTaxRecovery" },
        { label: "所得税（100円未満切捨）", field: "incomeTax", bold: true },
        { label: "住民税（10%）", field: "residentTax", bold: true },
      ],
    },
    {
      title: "▼ 個人事業税",
      rows: [
        { label: "個人事業税", field: "individualBusinessTax" },
      ],
    },
  ];

  return (
    <div>
      <h3 className="text-sm font-bold mb-2">個人所得税・住民税の計算明細</h3>
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr>
            <th className={thLabelCls} style={{ width: "200px" }}></th>
            <th className={thCls}>現状</th>
            <th className={thCls}>Plan1（マイクロ法人）</th>
            <th className={thCls}>Plan2（完全法人成り）</th>
          </tr>
        </thead>
        <tbody>
          {sections.map((section) => (
            <>
              <tr key={section.title}>
                <td colSpan={4} className={sectionCls}>
                  {section.title}
                </td>
              </tr>
              {section.rows.map((row) => {
                const labelCls = row.bold ? tdBoldLabel : tdLabel;
                const valCls = row.bold ? tdBoldVal : tdVal;
                const fmt = (v: number) =>
                  row.format === "percent" ? fmtPercent(v) : fmtOrEmpty(v);
                return (
                  <tr key={row.label}>
                    <td className={labelCls}>{row.label}</td>
                    <td className={valCls}>{fmt(current[row.field] as number)}</td>
                    <td className={valCls}>{fmt(plan1[row.field] as number)}</td>
                    <td className={valCls}>{fmt(plan2[row.field] as number)}</td>
                  </tr>
                );
              })}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// 法人税の計算明細テーブル
// ============================================================

function CorpTaxDetailTable({
  plan1,
  plan2,
}: {
  plan1: CorpTaxDetailBreakdown;
  plan2: CorpTaxDetailBreakdown;
}) {
  const thCls =
    "py-1.5 px-2 text-right text-[11px] font-bold text-white bg-[#1f3f7a] border border-gray-400";
  const thLabelCls = `${thCls} text-left`;
  const tdLabel =
    "py-1 px-2 text-[11px] text-gray-700 border border-gray-300 whitespace-nowrap";
  const tdVal =
    "py-1 px-2 text-right text-[11px] font-mono border border-gray-300";
  const tdBoldLabel =
    "py-1 px-2 text-[11px] font-bold text-gray-900 border border-gray-300 whitespace-nowrap";
  const tdBoldVal =
    "py-1 px-2 text-right text-[11px] font-mono font-bold border border-gray-300";
  const sectionCls =
    "py-1 px-2 text-[11px] font-bold text-white bg-[#4472C4] border border-gray-400";
  const tdStr =
    "py-1 px-2 text-right text-[11px] border border-gray-300";

  return (
    <div>
      <h3 className="text-sm font-bold mb-2">法人税の計算明細</h3>
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr>
            <th className={thLabelCls} style={{ width: "200px" }}></th>
            <th className={thCls}>Plan1（マイクロ法人）</th>
            <th className={thCls}>Plan2（完全法人成り）</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={3} className={sectionCls}>▼ 法人所得</td>
          </tr>
          <tr>
            <td className={tdLabel}>法人売上</td>
            <td className={tdVal}>{fmtOrEmpty(plan1.revenue)}</td>
            <td className={tdVal}>{fmtOrEmpty(plan2.revenue)}</td>
          </tr>
          <tr>
            <td className={tdLabel}>役員報酬＋配偶者給与</td>
            <td className={tdVal}>{fmtOrEmpty(plan1.salaries)}</td>
            <td className={tdVal}>{fmtOrEmpty(plan2.salaries)}</td>
          </tr>
          <tr>
            <td className={tdLabel}>社保会社負担</td>
            <td className={tdVal}>{fmtOrEmpty(plan1.employerSocialInsurance)}</td>
            <td className={tdVal}>{fmtOrEmpty(plan2.employerSocialInsurance)}</td>
          </tr>
          <tr>
            <td className={tdBoldLabel}>法人所得</td>
            <td className={tdBoldVal}>{fmtOrEmpty(plan1.corporateIncome)}</td>
            <td className={tdBoldVal}>{fmtOrEmpty(plan2.corporateIncome)}</td>
          </tr>

          <tr>
            <td colSpan={3} className={sectionCls}>▼ 法人税計算</td>
          </tr>
          <tr>
            <td className={tdLabel}>適用区分</td>
            <td className={tdStr}>{plan1.corporateIncome > 0 ? plan1.corporateTaxRate : ""}</td>
            <td className={tdStr}>{plan2.corporateIncome > 0 ? plan2.corporateTaxRate : ""}</td>
          </tr>
          <tr>
            <td className={tdBoldLabel}>法人税額</td>
            <td className={tdBoldVal}>{fmtOrEmpty(plan1.corporateTax)}</td>
            <td className={tdBoldVal}>{fmtOrEmpty(plan2.corporateTax)}</td>
          </tr>
          <tr>
            <td className={tdBoldLabel}>法人事業税</td>
            <td className={tdBoldVal}>{fmtOrEmpty(plan1.businessTax)}</td>
            <td className={tdBoldVal}>{fmtOrEmpty(plan2.businessTax)}</td>
          </tr>

          <tr>
            <td colSpan={3} className={sectionCls}>▼ 内部留保</td>
          </tr>
          <tr>
            <td className={tdBoldLabel}>法人内部留保</td>
            <td className={tdBoldVal}>{fmtOrEmpty(plan1.corporateRetained)}</td>
            <td className={tdBoldVal}>{fmtOrEmpty(plan2.corporateRetained)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// 手取り額の計算明細テーブル
// ============================================================

function NetIncomeDetailTable({
  current,
  plan1,
  plan2,
}: {
  current: NetIncomeDetailBreakdown;
  plan1: NetIncomeDetailBreakdown;
  plan2: NetIncomeDetailBreakdown;
}) {
  const thCls =
    "py-1.5 px-2 text-right text-[11px] font-bold text-white bg-[#1f3f7a] border border-gray-400";
  const thLabelCls = `${thCls} text-left`;
  const tdLabel =
    "py-1 px-2 text-[11px] text-gray-700 border border-gray-300 whitespace-nowrap";
  const tdVal =
    "py-1 px-2 text-right text-[11px] font-mono border border-gray-300";
  const tdBoldLabel =
    "py-1 px-2 text-[11px] font-bold text-gray-900 border border-gray-300 whitespace-nowrap";
  const tdBoldVal =
    "py-1 px-2 text-right text-[11px] font-mono font-bold border border-gray-300";
  const sectionCls =
    "py-1 px-2 text-[11px] font-bold text-white bg-[#4472C4] border border-gray-400";

  type Row = {
    label: string;
    field: keyof NetIncomeDetailBreakdown;
    bold?: boolean;
  };

  const sections: { title: string; rows: Row[] }[] = [
    {
      title: "▼ 収入合計",
      rows: [
        { label: "事業収入", field: "businessIncome" },
        { label: "給与収入", field: "salaryRevenue" },
        { label: "年金収入", field: "pensionRevenue" },
        { label: "他の所得", field: "otherIncome" },
        { label: "収入合計", field: "totalRevenue", bold: true },
      ],
    },
    {
      title: "▼ 控除項目",
      rows: [
        { label: "所得税", field: "incomeTax" },
        { label: "住民税", field: "residentTax" },
        { label: "個人事業税", field: "individualBusinessTax" },
        { label: "社会保険料", field: "socialInsurance" },
        { label: "控除合計", field: "totalDeductions", bold: true },
      ],
    },
    {
      title: "▼ 手取り額",
      rows: [
        { label: "手取り額", field: "netIncome", bold: true },
      ],
    },
  ];

  return (
    <div>
      <h3 className="text-sm font-bold mb-2">個人手取り額の計算明細</h3>
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr>
            <th className={thLabelCls} style={{ width: "200px" }}></th>
            <th className={thCls}>現状</th>
            <th className={thCls}>Plan1（マイクロ法人）</th>
            <th className={thCls}>Plan2（完全法人成り）</th>
          </tr>
        </thead>
        <tbody>
          {sections.map((section) => (
            <>
              <tr key={section.title}>
                <td colSpan={4} className={sectionCls}>
                  {section.title}
                </td>
              </tr>
              {section.rows.map((row) => {
                const labelCls = row.bold ? tdBoldLabel : tdLabel;
                const valCls = row.bold ? tdBoldVal : tdVal;
                return (
                  <tr key={row.label}>
                    <td className={labelCls}>{row.label}</td>
                    <td className={valCls}>{fmtOrEmpty(current[row.field] as number)}</td>
                    <td className={valCls}>{fmtOrEmpty(plan1[row.field] as number)}</td>
                    <td className={valCls}>{fmtOrEmpty(plan2[row.field] as number)}</td>
                  </tr>
                );
              })}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// メインコンポーネント
// ============================================================

export function CalcDetailSheet() {
  const { input, rates } = useHojinnariStore(
    useShallow((s) => ({ input: s.input, rates: s.rates }))
  );

  const individual = calcIndividual(input);
  const plan1 = calcPlan1(input, rates);
  const plan2 = calcPlan2(input, rates);

  return (
    <div className="p-4 space-y-6">
      <PersonalTaxDetailTable
        current={individual.taxDetail}
        plan1={plan1.taxDetail}
        plan2={plan2.taxDetail}
      />
      <CorpTaxDetailTable
        plan1={plan1.corpTaxDetail}
        plan2={plan2.corpTaxDetail}
      />
      <NetIncomeDetailTable
        current={individual.netIncomeDetail}
        plan1={plan1.netIncomeDetail}
        plan2={plan2.netIncomeDetail}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/hojinnari/calc-detail-sheet.tsx
git commit -m "feat(hojinnari): add CalcDetailSheet component for tax calculation breakdown"
```

---

### Task 6: ページにタブを追加

**Files:**
- Modify: `src/app/hojinnari/page.tsx`

- [ ] **Step 1: import追加**

`src/app/hojinnari/page.tsx` の先頭importに追加:

```typescript
import { CalcDetailSheet } from "@/components/hojinnari/calc-detail-sheet";
```

- [ ] **Step 2: TAB_LABELS に追加**

```typescript
const TAB_LABELS: { id: HojinnariTab; label: string }[] = [
  { id: "simulation", label: "シミュレーション" },
  { id: "houjinnari", label: "法人成り" },
  { id: "houkokusho", label: "報告書" },
  { id: "saitekika", label: "最適化" },
  { id: "keisan-meisai", label: "計算明細" },
];
```

- [ ] **Step 3: タブコンテンツ追加**

`<main>` 内の `{activeTab === "saitekika" && <OptimizationSheet />}` の後に追加:

```tsx
        {activeTab === "keisan-meisai" && <CalcDetailSheet />}
```

- [ ] **Step 4: ビルド確認**

Run: `cd /c/Users/manab/Documents/koganemushi_App/koganemushi-cloud && npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 5: テスト実行**

Run: `cd /c/Users/manab/Documents/koganemushi_App/koganemushi-cloud && npx vitest run 2>&1 | tail -20`
Expected: 全テストPASS

- [ ] **Step 6: ブラウザ動作確認**

http://localhost:3000/hojinnari で「計算明細」タブをクリックし、3列の計算明細テーブルが表示されることを確認。

- [ ] **Step 7: Commit**

```bash
git add src/app/hojinnari/page.tsx
git commit -m "feat(hojinnari): add keisan-meisai tab to hojinnari page"
```
