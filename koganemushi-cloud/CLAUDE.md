# koganemushi-cloud

役員報酬シミュレーションWebアプリ。Excel/VBAツール `yen_yakuin1.89.xlsm` のWeb移植版。

## コマンド

```bash
npm run dev      # 開発サーバー起動
npm run build    # 本番ビルド (turbopack)
npm run lint     # ESLint
npx vitest run   # テスト実行
```

## 参考資料

- `../docs/企画書.md` — プロジェクト概要・企画書
- `../docs/企画書を作るに当たって.md` — 企画書作成の背景

## アーキテクチャ

```
src/
  app/page.tsx              # メインSPA（タブ切り替え）
  components/
    executive-table.tsx     # 役員入力テーブル
    rate-settings.tsx       # 料率設定パネル
    hojinzei-sheet.tsx      # 法人税シート
    houkokusho-sheet.tsx    # 報告書シート
    optimization-sheet.tsx  # 最適化シート
    ui/                     # shadcn/ui コンポーネント
  lib/
    calc-engine.ts          # 全計算ロジック（純粋関数）
    optimize.ts             # 最適化アルゴリズム（純粋関数）
    tax-tables.ts           # 保険料率・税率テーブル定数
    defaults.ts             # デフォルト値・初期データ生成
    format.ts               # 数値フォーマット（formatYen/parseYen）
  types/simulation.ts       # 全型定義
docs/
  yen_yakuin1.89.xlsm       # 元Excelファイル（ground truth）
  計算ロジック仕様書.md      # VBAロジック文書
  capture/                  # UIスクリーンショット
```

## 設計原則

- **calc-engine.ts / optimize.ts は純粋関数**: 副作用なし、UIに依存しない。型付き入力 → 型付き出力
- **UIコンポーネントは表示専用**: 計算ロジックをコンポーネントに書かない
- **金額は全て円（整数）**: floatではなくinteger。表示時のみ `formatYen()` でカンマ区切り
- **料率は小数**: 例 `0.0991`（9.91%）。表示時のみ `formatPercent()` で変換
- **コンポーネント内で `toLocaleString` を直接使わない**: `formatYen`/`parseYen` を使う

## 技術スタック

- Next.js 16 (App Router), React 19, TypeScript 5
- Tailwind CSS 4, shadcn/ui
- vitest 4（テスト）

## 日本語ドメイン用語 ↔ 変数名

| 日本語 | 変数名 / 型名 |
|--------|---------------|
| 定期同額給与 | `regularSalary` |
| 事前確定届出給与 | `predeterminedBonus1/2/3` |
| 給与所得控除 | `salaryIncomeDeduction()` |
| 給与所得金額 | `salaryIncomeAfterDeduction` |
| 課税所得金額 | `taxableIncome` |
| 基礎控除 | `basicDeduction` |
| 所得税 | `incomeTax` |
| 住民税 | `residentTax` |
| 配当所得 | `dividendIncome` |
| 配当控除 | `dividendCreditIncomeTax` / `dividendCreditResidentTax` |
| 健康保険料 | `healthInsurance` |
| 介護保険料率 | `nursingCareRate` |
| 厚生年金保険料 | `pensionInsurance` |
| 子ども・子育て拠出金 | `childcareContribution` |
| 社会保険料 | `socialInsurance` / `totalSocialInsurance` |
| 会社負担社会保険料 | `employerSocialInsurance` |
| 手取り額 | `netIncome` |
| 法人税 | `corporateTax` |
| 法人所得 | `corporateIncome` (= preTaxCorporateIncome - execPay - employerSI) |
| 均等割 | `perCapitaLevy` |
| 繰越欠損金 | `carryForwardLoss` |
| 実効税率 | `EffectiveTaxRates` |
| 確定給付年金掛金 | `definedBenefitPension` |
| 標準報酬月額 | `lookupStandardMonthlyRemuneration()` |
| 政管健保 | `governmentHealthInsurance` |
| 報告書 | houkokusho-sheet |
| 最適化 | optimization-sheet |

## 計算フロー概要

```
ExecutiveInput + RateSettings
  → calcExecutive()
    → 給与収入合計
    → 給与所得控除
    → 社会保険料（標準報酬月額ルックアップ）
    → 基礎控除
    → 課税所得
    → 所得税（復興特別税2.1%含む）
    → 住民税（10%）
    → 配当控除
    → 手取り額
  → ExecutiveResult

CorporateTaxParams + EffectiveTaxRates + 役員報酬合計 + 会社負担社保合計
  → calcCorporateTaxTotal()
  → 法人税額
```

## テスト

- テストファイルは `src/lib/__tests__/` に配置
- Excel `yen_yakuin1.89.xlsm` が計算結果の ground truth
- 日本語テスト名を使用: `it("年収300万未満は給与所得控除が収入×70%-8万")`
