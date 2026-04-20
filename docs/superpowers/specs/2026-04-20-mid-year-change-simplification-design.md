# 期中標準報酬改定 UI 簡素化 設計書（追補）

**作成日**: 2026-04-20
**対象ブランチ**: `feat/standard-remuneration-change`
**先行設計**: `2026-04-20-standard-remuneration-change-design.md`

## 背景

先行設計で追加した「変更前月額」「変更後月額」「改定月」3フィールドを常時表示したところ、以下の問題が発覚:

1. シミュレーションシートが縦に長くなり、通常ケース（期中改定なし）で不要な行が3行増えた
2. 最適化機能が壊れた。最適化は `regularSalary` のみを動かすが、社保計算は `pre/post` を直接参照するため、`regularSalary` が変わっても社保が追従しない
3. 元Excelツールが期中改定を扱っていなかったため、大多数のユーザーには不要な機能として目立ってしまう

## 目的

- 通常ケースを元の1フィールド入力（`定期同額`）に戻す
- 期中改定が必要なときだけ詳細ダイアログで3フィールドを編集できる
- 最適化機能を復旧させる
- 標準報酬月額テーブルをポップアップで参照できる

## 要件

### 機能要件

**データモデル**
- `ExecutiveInput` に `hasMidYearChange: boolean` を追加、デフォルト `false`

**計算ロジック**
- `hasMidYearChange = false`:
  - 社保計算の pre / post は `(regularSalary − definedBenefitPension) / 12` を両方に使用（＝分割なしと同等）
  - `combineOtherSalary && executiveIndex === 0` のときのみ `otherSalaryIncome / 12` を加算（先行設計と同じ）
  - 結果として従来挙動（先行設計より前）と完全に一致
- `hasMidYearChange = true`:
  - 先行設計の通り、pre / post / m を使用して分割計算
  - `combineOtherSalary` も先行設計通り pre / post 両方に加算

**UI**
- シミュレーションシート（メインテーブル）から「変更前月額」「変更後月額」「改定月」3行を**非表示**（rows 配列から除外）
- 各役員列に **⚙（詳細）ボタン** を追加
  - 配置: ヘッダー部の「社会保険」ラベル行、各役員セルの下端
  - クリックで **詳細ダイアログ** を開く
- 詳細ダイアログ:
  - 役員名をヘッダーに表示
  - チェックボックス「期中に標準報酬改定あり」（= `hasMidYearChange`）
  - チェックONのとき展開:
    - 変更前月額（円、整数入力）
    - 変更後月額（円、整数入力）
    - 改定月（1〜13の整数）
    - ボタン「標準報酬月額テーブルを表示」
  - チェックOFFのとき、pre/post/m はそのまま保持（再度ONにしたとき復元）
  - 「閉じる」ボタン
- 標準報酬月額テーブルポップアップ:
  - `HEALTH_INSURANCE_TABLE`（健康保険、50等級）と `PENSION_TABLE`（厚生年金、32等級）を表形式で表示
  - 各行: 等級、月額範囲（○○以上 〜 ○○未満）、標準報酬月額
  - スクロール可能、閉じるボタン

**最適化**
- `optimize.ts` は従来通り `regularSalary` のみを動かす
- `hasMidYearChange = false` を強制するか、オリジナルの値を保持する
  - 案A: 最適化ループ内で `hasMidYearChange = false` にセット（安全）
  - 案B: 変更せず、ユーザーがONで残っていれば現状値で計算（fallback pre/post は動かない）
  - 採用: **案A**（最適化が動く保証を優先）

**マイグレーション**
- 既存localStorageデータ（v2 → v3）: `hasMidYearChange` 未定義 → `false`
- `pre/post/m` が過去に入力されていても `hasMidYearChange = false` なら無視される（＝元挙動に戻る）

### 非機能要件

- 既存テスト（158件）はすべて pass を維持
- 新規テスト:
  - `hasMidYearChange = false` で先行設計前の挙動と一致
  - `hasMidYearChange = true` で先行設計の分割挙動と一致
  - 最適化が期待通りに動作することの確認

## 設計詳細

### 型定義変更
`src/types/simulation.ts` の `ExecutiveInput` に追加:

```typescript
/** 期中に標準報酬改定がある（詳細入力フラグ） */
hasMidYearChange: boolean;
```

### デフォルト値
`createEmptyExecutive` に `hasMidYearChange: false` を追加。

### 計算エンジン（`calc-engine.ts`）
`getInsuranceMonthlyBases` を以下のように修正:

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

`splitAnnualInsurance` は変更なし。`hasMidYearChange = false` のとき `pre === post` になるので、`changeMonth` の値に関係なく `f(base) × 12` になる。

### 最適化（`optimize.ts`）
既存の `calcExecutive` 呼び出しで `exec` を渡す前に `{ ...exec, hasMidYearChange: false }` とする。1箇所、変数名は `makeCandidateExec` 等で明示的に。

### UIコンポーネント

**新規**: `src/components/executive-detail-dialog.tsx`
- shadcn/ui の Dialog を使用
- props: `plan: "current" | "comparison"`, `index: number`, `open: boolean`, `onOpenChange: (open: boolean) => void`
- 内部で `useSimulationStore` から対象 `ExecutiveInput` を取得し、各フィールドを編集
- 下部に「標準報酬月額テーブルを表示」ボタン → `StandardRemunerationTableDialog` を開く

**新規**: `src/components/standard-remuneration-table-dialog.tsx`
- shadcn/ui の Dialog を使用
- props: `open: boolean`, `onOpenChange: (open: boolean) => void`
- 内部で `HEALTH_INSURANCE_TABLE` と `PENSION_TABLE` を表形式で表示
- タブまたは縦に2表並べる

**修正**: `src/components/executive-table.tsx`
- `rows` 配列から「変更前月額」「変更後月額」「改定月」を削除
- ヘッダー部（社会保険ラベル行、子育て等行、健保任意入力行）の下に、もう1行追加:
  - 各役員セルに ⚙ ボタンを配置
  - ボタンクリックで `ExecutiveDetailDialog` を開く
  - ダイアログのopen状態はコンポーネントでlocal state管理

### ストア・マイグレーション（`simulation-store.ts`）
- `version: 3` に上げる
- `migrate` 関数内、v2 → v3 で各executive配列に対して `hasMidYearChange` 未定義なら `false` を追加
- v1 → v2 は既存ロジックを保持（現在 `if (version < 2)` は `if (version < 2 && !== 3)` にはしない；v1 を読む場合は v2 ロジック通過後 v3 ロジックを通す）

簡素化: `migrate` 関数内で、version が 1 以下なら v2 migration を先に実行、そのあと version < 3 なら `hasMidYearChange` を追加。

### テスト追加
`calc-engine.test.ts` に:
- `hasMidYearChange = false, pre/post/m が偶然設定されていても無視される`
- `hasMidYearChange = false` で先行設計前と同じ結果（regularSalary - definedBenefitPension / 12 ベース）
- `hasMidYearChange = true` で先行設計通り

`optimize.test.ts` に:
- 最適化が `hasMidYearChange` の初期値に関わらず `regularSalary` の変動に応答する

## 完了条件

- [ ] `hasMidYearChange` フィールド追加、デフォルト false
- [ ] シミュレーションテーブルから3行が消える、元のコンパクトな表示に戻る
- [ ] 各役員列に詳細ボタンが表示される
- [ ] 詳細ダイアログで pre/post/m を編集でき、チェックボックスで有効化できる
- [ ] 標準報酬月額テーブルポップアップが開き、健保・年金両方が表示される
- [ ] 最適化が動作する（`hasMidYearChange = false` 下で `regularSalary` の変動に社保が応答）
- [ ] 既存 158 テスト + 新規テストすべて pass
- [ ] `npm run build` 成功
- [ ] 既存 localStorage データが壊れずに読み込める
