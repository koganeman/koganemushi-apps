# 標準報酬変更タイミング対応 設計書

**作成日**: 2026-04-20
**対象アプリ**: 役員報酬シミュレーション（`/yakuin-hoshu`）
**対象画面**: シミュレーションシート

## 背景

標準報酬月額は、役員報酬の変更後、初めて変更後の報酬を受けた月から起算して4ヶ月目に改定される。現行のシミュレーションシートは定期同額（年間）を12で割った月額を用いて全12ヶ月分の社会保険料を計算しているため、期中で報酬改定があるケースを正確にシミュレーションできない。

加えて、現状の「政管健保（グローバル）」チェックボックスは、役員ごとの「健保任意入力」チェックボックスと機能が大きく重複しており、UIが冗長になっている。

## 目的

1. 役員ごとに「変更前月額」「変更後月額」「改定月」を入力し、期首から改定月の前月までは変更前月額、改定月以降は変更後月額をベースに標準報酬を求めて社会保険料を計算する
2. グローバルの「政管健保」チェックボックスを廃止し、役員ごとの「健保任意入力」チェックボックスに統合する
3. 左上ラベルを追加し、社会保険関連のヘッダー行であることを明示する

## 要件

### 機能要件

**入力**
- 役員ごとに以下3フィールドを追加:
  - 変更前月額報酬（円、整数）
  - 変更後月額報酬（円、整数）
  - 改定月（1〜13の整数、デフォルト `1`）
- グローバル「政管健保」チェックボックスは削除
- 既存の「健保任意入力」チェックボックスはそのまま残す
- 役員テーブルの左上（`加入` 行の左端）に `社会保険` ラベルを追加

**計算**
- 改定月を `m`（1〜13）、変更前月額を `pre`、変更後月額を `post` とする
- 健保任意入力 **OFF** の役員:
  - 健康保険料（個人・会社）= 月額保険料(pre, 年齢) × (m−1) + 月額保険料(post, 年齢) × (13−m) + 賞与分
  - 厚生年金保険料（個人・会社）= 月額保険料(pre, 年齢) × (m−1) + 月額保険料(post, 年齢) × (13−m) + 賞与分
  - 子ども・子育て支援金（個人・会社）= 月額支援金(pre) × (m−1) + 月額支援金(post) × (13−m) + 賞与分
  - 賞与部分は従来どおりの計算（改定月の影響なし）
- 健保任意入力 **ON** の役員:
  - 健康保険料（個人）= `manualHealthInsuranceAmount`（年額、分割ロジック適用なし）
  - 会社負担健康保険料 = 0
  - 厚生年金保険料（個人・会社）= 月額保険料(pre) × (m−1) + 月額保険料(post) × (13−m) + 賞与分（OFF時と同じ）
  - 子ども・子育て支援金（個人・会社）= 0
  - 賞与健康保険料（個人・会社）= 0
- 子ども・子育て拠出金（会社負担のみ）: 従来どおり `regularSalary` ベースで計算

**空値処理**
- `pre = 0` のとき、変更前期間（m−1 ヶ月分）の社保は0として扱う
- `post = 0` のとき、変更後期間（13−m ヶ月分）の社保は0として扱う

**税金計算**
- 所得税・住民税・給与所得控除は従来どおり `regularSalary`（年間額）ベース。変更なし。

**加入フラグ（`socialInsuranceEnrolled`）**
- 従来どおり役員単位。非常勤役員等でOFFにすると全社保ゼロ（現行挙動維持）

### 非機能要件

- **後方互換性**: `改定月 = 1` のとき、`post` のみで12ヶ月計算（従来挙動と一致）
- **マイグレーション**: localStorage上の既存データに対して:
  - `governmentHealthInsurance` フィールドは無視（読み込み時に破棄）
  - 役員データに新フィールドが無ければ、以下を自動補完:
    - `preChangeMonthlyRemuneration = 0`
    - `postChangeMonthlyRemuneration = regularSalary / 12`
    - `standardRemunerationChangeMonth = 1`

## 設計詳細

### 型定義変更（`src/types/simulation.ts`）

```typescript
export interface ExecutiveInput {
  // ... 既存フィールド ...
  /** 変更前月額報酬（円） */
  preChangeMonthlyRemuneration: number;
  /** 変更後月額報酬（円） */
  postChangeMonthlyRemuneration: number;
  /** 標準報酬改定月（1〜13、1=期首から改定後月額を使用） */
  standardRemunerationChangeMonth: number;
}

export interface SimulationData {
  // governmentHealthInsurance を削除
  // ... 他のフィールドは維持 ...
}
```

### ストア変更（`src/stores/simulation-store.ts`）

- `governmentHealthInsurance` stateとactionを削除
- `persist` の `partialize` から `governmentHealthInsurance` を除外
- localStorage migration: `onRehydrateStorage` または `migrate` オプションで既存データを変換

### 計算エンジン変更（`src/lib/calc-engine.ts`）

`CalcExecutiveContext` から `isGovernmentHealthInsurance` を削除し、各計算ヘルパー関数を修正:

```typescript
function calcHealthInsuranceWithSplit(
  pre: number, post: number, changeMonth: number,
  age: number, rates: RateSettings
): number {
  const preMonths = changeMonth - 1;
  const postMonths = 13 - changeMonth;
  const preMonthly = pre > 0 ? calcHealthInsuranceMonthly(pre, age, rates) : 0;
  const postMonthly = post > 0 ? calcHealthInsuranceMonthly(post, age, rates) : 0;
  return preMonthly * preMonths + postMonthly * postMonths;
}
// 厚生年金、子育て支援金も同様
```

- `calcPersonalHealthInsurance`: 健保任意入力ON→直接入力、OFF→分割計算
- `calcPersonalPension`: 常に分割計算（健保任意入力の影響なし）
- `calcPersonalChildcareSupport`: 健保任意入力ON→0、OFF→分割計算
- `calcEmployerInsurance`: 上記と同じロジックで会社負担分を計算

### UI変更

**`src/components/executive-table.tsx`**
- `rows` 配列に3行追加（`定期同額` の直下に配置）:
  ```typescript
  { label: "変更前月額", key: "input", field: "preChangeMonthlyRemuneration", inputBg: "bg-yellow-50" },
  { label: "変更後月額", key: "input", field: "postChangeMonthlyRemuneration", inputBg: "bg-yellow-50" },
  { label: "改定月", key: "input", field: "standardRemunerationChangeMonth", inputBg: "bg-yellow-50" },
  ```
- ヘッダーの左上（`加入` 行の左端 `<th>`）に `社会保険` ラベル追加
- `CellInput` に「1〜13の整数」用のバリエーション追加（`isMonth` フラグ等）

**`src/app/yakuin-hoshu/page.tsx`**
- 「政管健保（協会けんぽ）」チェックボックスのUIとstate参照を削除
- `useSimulationStore` の selector から `governmentHealthInsurance` と `setGovernmentHealthInsurance` を除去

### デフォルト値（`src/lib/defaults.ts`）

`createEmptyExecutive()` の戻り値に以下を追加:
- `preChangeMonthlyRemuneration: 0`
- `postChangeMonthlyRemuneration: 0`
- `standardRemunerationChangeMonth: 1`

`createDefaultSimulationData()` から `governmentHealthInsurance` を削除。

### テスト（`src/lib/__tests__/calc-engine.test.ts`）

追加ケース:
- 改定月 = 1: 従来挙動と一致（`post` のみ、12ヶ月分）
- 改定月 = 7: `pre` 6ヶ月 + `post` 6ヶ月で合算
- 改定月 = 13: `pre` のみ12ヶ月（変更後期間0）
- `pre = 0` かつ 改定月 = 7: 変更前期間社保ゼロ、`post` 6ヶ月のみ
- 健保任意入力 ON: 健保と子育て支援金0、厚生年金は分割計算
- 賞与分は改定月によらず同じ計算結果

### 仕様書更新（`docs/yakuin-hoshu/計算ロジック仕様書.md`）

以下のセクションを追記:
- 標準報酬変更タイミングのロジック（数式含む）
- 健保任意入力ON時の挙動
- 政管健保フラグ廃止の経緯

## 完了条件

- [ ] 新フィールド3つが `ExecutiveInput` に追加され、UI上で入力できる
- [ ] 改定月 = 1 のとき従来挙動と一致する（既存テストがすべてpass）
- [ ] 改定月 = 7 のテストケースが期待値と一致する
- [ ] 「政管健保」チェックボックスが画面から消えている
- [ ] 「社会保険」ラベルが役員テーブル左上に表示される
- [ ] localStorageに保存された旧データをロードしても画面がクラッシュしない
- [ ] 仕様書が更新されている
- [ ] `npx vitest run` が全件pass
- [ ] `npm run build` がerrorなし

## 影響範囲

変更ファイル:
- `src/types/simulation.ts`
- `src/stores/simulation-store.ts`
- `src/lib/calc-engine.ts`
- `src/lib/defaults.ts`
- `src/components/executive-table.tsx`
- `src/app/yakuin-hoshu/page.tsx`
- `src/hooks/use-computed-results.ts`（`governmentHealthInsurance` 参照箇所があれば）
- `src/lib/__tests__/calc-engine.test.ts`
- `src/lib/__tests__/excel-scenarios.test.ts`（`governmentHealthInsurance` の扱い確認）
- `src/lib/__tests__/optimize.test.ts`（同上）
- `docs/yakuin-hoshu/計算ロジック仕様書.md`

法人なりアプリ（`/hojinnari`）は本変更の対象外。
