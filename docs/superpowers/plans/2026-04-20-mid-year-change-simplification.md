# 期中改定 UI 簡素化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development

**Goal:** シミュレーションシートから3行（変更前月額/変更後月額/改定月）を非表示にし、役員ごとの詳細ダイアログからのみ編集可能にする。`hasMidYearChange` フラグ追加で最適化を復旧。標準報酬月額テーブルをポップアップで参照可能にする。

**Architecture:** `ExecutiveInput` に `hasMidYearChange: boolean` を追加、`false` のとき `calc-engine` は `regularSalary - definedBenefitPension` の1/12を pre/post 両方に使用（先行設計前と等価）。UIはshadcn Dialogで詳細モーダル＋標準報酬テーブルモーダル。

**Tech Stack:** TypeScript, React 19, Next.js 16, Zustand, shadcn/ui Dialog, vitest

---

## Task 1: 型定義とデフォルト値

**Files:**
- Modify: `koganemushi-cloud/src/types/simulation.ts`
- Modify: `koganemushi-cloud/src/lib/defaults.ts`

- [ ] **Step 1: 型追加**

`src/types/simulation.ts` の `ExecutiveInput` の `standardRemunerationChangeMonth` の次に追加:

```typescript
  /** 標準報酬改定月（1〜13、1=期首から改定後月額を使用） */
  standardRemunerationChangeMonth: number;
  /** 期中に標準報酬改定がある（詳細入力フラグ） */
  hasMidYearChange: boolean;
}
```

- [ ] **Step 2: defaults 更新**

`src/lib/defaults.ts` の `createEmptyExecutive` 戻り値に `hasMidYearChange: false` を追加（`standardRemunerationChangeMonth: 1` の次）。

- [ ] **Step 3: コミット**

```bash
cd C:\Users\manab\Documents\koganemushi_App
git add koganemushi-cloud/src/types/simulation.ts koganemushi-cloud/src/lib/defaults.ts
git commit -m "types: hasMidYearChange フラグを追加"
```

---

## Task 2: calc-engine の `getInsuranceMonthlyBases` を hasMidYearChange 分岐に

**File:** `koganemushi-cloud/src/lib/calc-engine.ts`

- [ ] **Step 1: `getInsuranceMonthlyBases` を修正**

既存の `getInsuranceMonthlyBases` 関数を以下で置き換え:

```typescript
function getInsuranceMonthlyBases(
  exec: ExecutiveInput,
  ctx: CalcExecutiveContext
): { pre: number; post: number } {
  const combine = ctx.combineOtherSalary && ctx.executiveIndex === 0;
  const otherMonthly = combine ? exec.otherSalaryIncome / 12 : 0;

  if (!exec.hasMidYearChange) {
    const regMonthly = (exec.regularSalary - exec.definedBenefitPension) / 12;
    const base = regMonthly + otherMonthly;
    return { pre: base, post: base };
  }

  return {
    pre: exec.preChangeMonthlyRemuneration + otherMonthly,
    post: exec.postChangeMonthlyRemuneration + otherMonthly,
  };
}
```

- [ ] **Step 2: 既存テストの ExecutiveInput フィクスチャに `hasMidYearChange` を追加**

`src/lib/__tests__/calc-engine.test.ts` で既存の `ExecutiveInput` リテラルに:
- 元の挙動（`regularSalary/12` ベース）を期待する既存テスト3件 → `hasMidYearChange: false`
- 新機能の期中改定テストの `base` オブジェクト → `hasMidYearChange: true`（pre/postを実際に使うため）

同様に:
- `src/lib/__tests__/excel-scenarios.test.ts` の `makeExec` ヘルパー → `hasMidYearChange: false` をデフォルトに
- `src/lib/__tests__/optimize.test.ts` の `makeExec` ヘルパー → `hasMidYearChange: false` をデフォルトに

- [ ] **Step 3: テスト追加**

`calc-engine.test.ts` の `describe("calcExecutive - 標準報酬変更タイミング", ...)` 内に追加:

```typescript
  it("hasMidYearChange=false: pre/post が設定されていても無視される", () => {
    const exec: ExecutiveInput = {
      ...base,
      hasMidYearChange: false,
      regularSalary: 12000000,
      preChangeMonthlyRemuneration: 500000,
      postChangeMonthlyRemuneration: 500000,
      standardRemunerationChangeMonth: 7,
    };
    const result = calcExecutive(exec, defaultRates, {
      combineOtherSalary: false,
      executiveIndex: 0,
    });
    // regularSalary/12 = 1,000,000 を12ヶ月分使う
    const expectedHealth =
      calcHealthInsuranceMonthly(1000000, 42, defaultRates) * 12;
    expect(result.healthInsurance).toBeCloseTo(expectedHealth, 0);
  });

  it("hasMidYearChange=false: definedBenefitPension が regularSalary から引かれる", () => {
    const exec: ExecutiveInput = {
      ...base,
      hasMidYearChange: false,
      regularSalary: 12000000,
      definedBenefitPension: 600000,  // monthly 50,000 差し引き
    };
    const result = calcExecutive(exec, defaultRates, {
      combineOtherSalary: false,
      executiveIndex: 0,
    });
    // (12,000,000 - 600,000) / 12 = 950,000
    const expectedHealth =
      calcHealthInsuranceMonthly(950000, 42, defaultRates) * 12;
    expect(result.healthInsurance).toBeCloseTo(expectedHealth, 0);
  });
```

- [ ] **Step 4: テスト実行**

```bash
cd koganemushi-cloud
npx vitest run
```

Expected: 全件pass。

- [ ] **Step 5: コミット**

```bash
cd C:\Users\manab\Documents\koganemushi_App
git add koganemushi-cloud/src/lib/calc-engine.ts koganemushi-cloud/src/lib/__tests__/
git commit -m "calc-engine: hasMidYearChange=false で regularSalary ベースにフォールバック"
```

---

## Task 3: Zustand マイグレーション v2 → v3

**File:** `koganemushi-cloud/src/stores/simulation-store.ts`

- [ ] **Step 1: migrate 関数と `migrateExecutive` を修正**

```typescript
function migrateExecutive(exec: Partial<ExecutiveInput>): ExecutiveInput {
  const regular = exec.regularSalary ?? 0;
  return {
    ...createEmptyExecutive(),
    ...exec,
    preChangeMonthlyRemuneration: exec.preChangeMonthlyRemuneration ?? 0,
    postChangeMonthlyRemuneration:
      exec.postChangeMonthlyRemuneration ?? (regular > 0 ? Math.floor(regular / 12) : 0),
    standardRemunerationChangeMonth: exec.standardRemunerationChangeMonth ?? 1,
    hasMidYearChange: exec.hasMidYearChange ?? false,
  };
}
```

persist config の `version: 2` を `version: 3` に変更し、migrate 関数を:

```typescript
      version: 3,
      migrate: (persistedState: unknown, version: number) => {
        const s = persistedState as Record<string, unknown>;
        if (!s || typeof s !== "object") return s;
        if (version < 2) {
          delete s.governmentHealthInsurance;
        }
        if (version < 3) {
          for (const key of ["currentExecutives", "comparisonExecutives", "plan2Executives"] as const) {
            if (Array.isArray(s[key])) {
              s[key] = (s[key] as Partial<ExecutiveInput>[]).map(migrateExecutive);
            }
          }
        }
        return s;
      },
```

- [ ] **Step 2: コミット**

```bash
cd C:\Users\manab\Documents\koganemushi_App
git add koganemushi-cloud/src/stores/simulation-store.ts
git commit -m "store: hasMidYearChange を含む v3 マイグレーションに更新"
```

---

## Task 4: optimize.ts で hasMidYearChange=false を強制

**File:** `koganemushi-cloud/src/lib/optimize.ts`

- [ ] **Step 1: calcExecutive 呼び出し 2箇所で hasMidYearChange=false**

`calcNetIncome` と `calcCombinedCFValue` 内の `calcExecutive(exec, ctx.rates, {...})` 呼び出し直前で、 `exec` を `{...exec, hasMidYearChange: false}` に差し替え:

修正前:
```typescript
  const exec = { ...ctx.comparisonExecutives[0], ...mutated };
  return calcExecutive(exec, ctx.rates, {
    combineOtherSalary: ctx.combineOtherSalaryForInsurance,
    executiveIndex: 0,
    taxYear: ctx.taxYear,
  });
```

修正後:
```typescript
  const exec = { ...ctx.comparisonExecutives[0], ...mutated, hasMidYearChange: false };
  return calcExecutive(exec, ctx.rates, {
    combineOtherSalary: ctx.combineOtherSalaryForInsurance,
    executiveIndex: 0,
    taxYear: ctx.taxYear,
  });
```

2箇所とも同様。

- [ ] **Step 2: テスト追加**

`src/lib/__tests__/optimize.test.ts` に追加:

```typescript
  it("hasMidYearChange=true のまま最適化すると false 扱いで計算される", () => {
    // 役員の hasMidYearChange=true でも、最適化は regularSalary ベースで動く
    const execs = [makeExec({
      regularSalary: 10000000,
      hasMidYearChange: true,
      preChangeMonthlyRemuneration: 500000,
      postChangeMonthlyRemuneration: 500000,
    })];
    const ctx = makeContext({ comparisonExecutives: execs });
    // 最適化がエラーなく完走すればOK（具体値は他のテストで検証済）
    const result = optimizeRegularSalary(5000000, 20000000, 1000000, ctx);
    expect(result.bestSalary).toBeGreaterThanOrEqual(5000000);
    expect(result.bestSalary).toBeLessThanOrEqual(20000000);
  });
```

※ `optimizeRegularSalary` の関数名は `optimize.ts` の公開関数に合わせること。実際のシグネチャを確認してから追加。

- [ ] **Step 3: テスト実行**

```bash
cd koganemushi-cloud && npx vitest run
```

- [ ] **Step 4: コミット**

```bash
cd C:\Users\manab\Documents\koganemushi_App
git add koganemushi-cloud/src/lib/optimize.ts koganemushi-cloud/src/lib/__tests__/optimize.test.ts
git commit -m "optimize: 最適化中は hasMidYearChange=false を強制し regularSalary ベースで計算"
```

---

## Task 5: 標準報酬月額テーブルポップアップ

**File (new):** `koganemushi-cloud/src/components/standard-remuneration-table-dialog.tsx`

- [ ] **Step 1: Dialog コンポーネントを新規作成**

```typescript
"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  HEALTH_INSURANCE_TABLE,
  HEALTH_INSURANCE_MAX_GRADE,
  PENSION_TABLE,
  PENSION_MAX_GRADE,
} from "@/lib/tax-tables";
import { formatYen } from "@/lib/format";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function renderRows(table: [number, number][], maxGrade: number) {
  const rows: { grade: number; from: number; to: number; standard: number }[] = [];
  let prev = 0;
  table.forEach(([limit, standard], i) => {
    rows.push({ grade: i + 1, from: prev, to: limit, standard });
    prev = limit;
  });
  rows.push({ grade: table.length + 1, from: prev, to: Infinity, standard: maxGrade });
  return rows;
}

export function StandardRemunerationTableDialog({ open, onOpenChange }: Props) {
  const healthRows = renderRows(HEALTH_INSURANCE_TABLE, HEALTH_INSURANCE_MAX_GRADE);
  const pensionRows = renderRows(PENSION_TABLE, PENSION_MAX_GRADE);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>標準報酬月額テーブル</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section>
            <h3 className="font-bold mb-2 text-sm">健康保険</h3>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border px-2 py-1">等級</th>
                  <th className="border px-2 py-1">月額範囲</th>
                  <th className="border px-2 py-1">標準報酬</th>
                </tr>
              </thead>
              <tbody>
                {healthRows.map((r) => (
                  <tr key={r.grade}>
                    <td className="border px-2 py-0.5 text-center">{r.grade}</td>
                    <td className="border px-2 py-0.5 text-right">
                      {r.from === 0 ? "～" : `${formatYen(r.from)}～`}
                      {r.to === Infinity ? "" : formatYen(r.to)}
                    </td>
                    <td className="border px-2 py-0.5 text-right">{formatYen(r.standard)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <section>
            <h3 className="font-bold mb-2 text-sm">厚生年金</h3>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border px-2 py-1">等級</th>
                  <th className="border px-2 py-1">月額範囲</th>
                  <th className="border px-2 py-1">標準報酬</th>
                </tr>
              </thead>
              <tbody>
                {pensionRows.map((r) => (
                  <tr key={r.grade}>
                    <td className="border px-2 py-0.5 text-center">{r.grade}</td>
                    <td className="border px-2 py-0.5 text-right">
                      {r.from === 0 ? "～" : `${formatYen(r.from)}～`}
                      {r.to === Infinity ? "" : formatYen(r.to)}
                    </td>
                    <td className="border px-2 py-0.5 text-right">{formatYen(r.standard)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**注意**: `src/lib/tax-tables.ts` の `HEALTH_INSURANCE_TABLE` と `PENSION_TABLE` が実際にどんな構造か確認すること。もし `[number, number][]`（[上限, 標準額]）でなければ、`renderRows` を適宜修正。

- [ ] **Step 2: import チェック・ビルド**

```bash
cd koganemushi-cloud && npx tsc --noEmit
```

- [ ] **Step 3: コミット**

```bash
cd C:\Users\manab\Documents\koganemushi_App
git add koganemushi-cloud/src/components/standard-remuneration-table-dialog.tsx
git commit -m "components: 標準報酬月額テーブルダイアログを追加"
```

---

## Task 6: 役員詳細ダイアログ

**File (new):** `koganemushi-cloud/src/components/executive-detail-dialog.tsx`

- [ ] **Step 1: Dialog コンポーネントを新規作成**

```typescript
"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { useSimulationStore } from "@/stores/simulation-store";
import { formatYen, parseYen } from "@/lib/format";
import { StandardRemunerationTableDialog } from "./standard-remuneration-table-dialog";
import type { ExecutiveInput } from "@/types/simulation";

interface Props {
  plan: "current" | "comparison";
  index: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExecutiveDetailDialog({ plan, index, open, onOpenChange }: Props) {
  const exec = useSimulationStore((s) =>
    plan === "current" ? s.currentExecutives[index] : s.comparisonExecutives[index]
  );
  const updateExec = useSimulationStore((s) =>
    plan === "current" ? s.updateCurrentExecutive : s.updateComparisonExecutive
  );
  const [tableOpen, setTableOpen] = useState(false);

  if (!exec) return null;

  const patch = (partial: Partial<ExecutiveInput>) => {
    updateExec(index, { ...exec, ...partial });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{exec.name || `役員${index + 1}`}: 社会保険 詳細設定</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={exec.hasMidYearChange}
                onCheckedChange={(c) => patch({ hasMidYearChange: !!c })}
              />
              期中に標準報酬改定あり
            </label>

            {exec.hasMidYearChange && (
              <div className="space-y-3 pl-6">
                <div className="grid grid-cols-[auto_1fr] gap-2 items-center text-sm">
                  <label>変更前月額:</label>
                  <input
                    type="text"
                    className="border px-2 py-1 text-right"
                    defaultValue={exec.preChangeMonthlyRemuneration === 0 ? "" : formatYen(exec.preChangeMonthlyRemuneration)}
                    onBlur={(e) => patch({ preChangeMonthlyRemuneration: parseYen(e.target.value) })}
                    key={`pre-${exec.preChangeMonthlyRemuneration}`}
                  />
                  <label>変更後月額:</label>
                  <input
                    type="text"
                    className="border px-2 py-1 text-right"
                    defaultValue={exec.postChangeMonthlyRemuneration === 0 ? "" : formatYen(exec.postChangeMonthlyRemuneration)}
                    onBlur={(e) => patch({ postChangeMonthlyRemuneration: parseYen(e.target.value) })}
                    key={`post-${exec.postChangeMonthlyRemuneration}`}
                  />
                  <label>改定月 (1〜13):</label>
                  <input
                    type="number"
                    min={1}
                    max={13}
                    className="border px-2 py-1 text-right"
                    value={exec.standardRemunerationChangeMonth}
                    onChange={(e) => {
                      const n = parseInt(e.target.value) || 1;
                      patch({ standardRemunerationChangeMonth: Math.min(13, Math.max(1, n)) });
                    }}
                  />
                </div>
                <Button variant="outline" size="sm" onClick={() => setTableOpen(true)}>
                  標準報酬月額テーブルを表示
                </Button>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>閉じる</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <StandardRemunerationTableDialog open={tableOpen} onOpenChange={setTableOpen} />
    </>
  );
}
```

- [ ] **Step 2: 型チェック**

```bash
cd koganemushi-cloud && npx tsc --noEmit
```

shadcn Dialog コンポーネントが `src/components/ui/dialog.tsx` に存在するか確認。無ければインストール:

```bash
cd koganemushi-cloud && npx shadcn@latest add dialog
```

- [ ] **Step 3: コミット**

```bash
cd C:\Users\manab\Documents\koganemushi_App
git add koganemushi-cloud/src/components/executive-detail-dialog.tsx koganemushi-cloud/src/components/ui/
git commit -m "components: 役員詳細ダイアログを追加"
```

---

## Task 7: ExecutiveTable から3行削除・詳細ボタン追加

**File:** `koganemushi-cloud/src/components/executive-table.tsx`

- [ ] **Step 1: `rows` 配列から3行削除**

```typescript
const rows: RowDef[] = [
  { label: "役員名", key: "input", field: "name" },
  { label: "年齢", key: "input", field: "age" },
  { label: "定期同額", key: "input", field: "regularSalary", inputBg: "bg-yellow-50" },
  // ↓ 以下の3行は削除
  // { label: "変更前月額", ... },
  // { label: "変更後月額", ... },
  // { label: "改定月", ... },
  { label: "事前確定給与1回目", key: "input", field: "predeterminedBonus1", inputBg: "bg-yellow-50" },
  // ...
```

- [ ] **Step 2: 詳細ボタン行を追加**

ヘッダー部分（`健保任意入力` 行の後）に新しい `<tr>` を追加:

```tsx
          {/* 詳細ボタン行 */}
          <tr className="border-b">
            <th className="sticky left-0 bg-white z-10 border px-2 py-1 text-left w-36 min-w-36">
              <span className="text-xs text-gray-600">詳細</span>
            </th>
            {visible.map((exec, i) => (
              <th key={i} className="border px-1 py-1 text-center">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-xs"
                  onClick={() => setOpenDialogIndex(i)}
                  disabled={!exec.socialInsuranceEnrolled}
                >
                  ⚙
                </Button>
              </th>
            ))}
            <th className="border px-2 py-1 bg-green-50" />
          </tr>
```

`openDialogIndex` state とダイアログレンダリングを `ExecutiveTable` コンポーネントに追加:

```typescript
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ExecutiveDetailDialog } from "./executive-detail-dialog";
// ...
export function ExecutiveTable({ plan, visibleCount = 10 }: ExecutiveTableProps) {
  const [openDialogIndex, setOpenDialogIndex] = useState<number | null>(null);
  // ... 既存のstore呼び出し・updateField ...

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-xs w-full">
        {/* 既存thead/tbody */}
      </table>
      {openDialogIndex !== null && (
        <ExecutiveDetailDialog
          plan={plan}
          index={openDialogIndex}
          open={openDialogIndex !== null}
          onOpenChange={(open) => !open && setOpenDialogIndex(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: 型チェック・ビルド**

```bash
cd koganemushi-cloud && npx tsc --noEmit && npm run build
```

- [ ] **Step 4: コミット**

```bash
cd C:\Users\manab\Documents\koganemushi_App
git add koganemushi-cloud/src/components/executive-table.tsx
git commit -m "executive-table: 3行を削除・詳細ボタンを追加"
```

---

## Task 8: 動作確認

- [ ] **Step 1: テスト全件実行**

```bash
cd koganemushi-cloud && npx vitest run
```

Expected: 全件pass。

- [ ] **Step 2: ビルド**

```bash
cd koganemushi-cloud && npm run build
```

- [ ] **Step 3: dev server で動作確認**

ブラウザで http://localhost:3000/yakuin-hoshu を開き:
- メインテーブルが元のコンパクトな表示に戻っている
- 詳細ボタン（⚙）が各役員列に表示される
- クリックで詳細ダイアログが開く
- チェックボックス「期中に標準報酬改定あり」の挙動確認
- 「標準報酬月額テーブルを表示」でテーブルダイアログが開く
- 最適化タブで最適化が動作する

---

## 完了条件

- [ ] テーブルから3行が消え元のコンパクト表示に戻る
- [ ] 詳細ボタンから pre/post/m を編集できる
- [ ] 標準報酬月額テーブルが参照できる
- [ ] 最適化機能が動作する
- [ ] 既存テスト + 新規テストすべてpass
- [ ] `npm run build` 成功
- [ ] 既存localStorageデータが壊れずに読み込める
