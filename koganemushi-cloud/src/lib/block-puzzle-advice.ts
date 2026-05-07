/**
 * ブロックパズルの数値からClaudeに送るプロンプトを構築する純関数群。
 * APIコールはここでは行わない（テスト容易性のため）。
 */

import type { BlockPuzzleResult } from "@/types/block-puzzle";

export const ADVICE_SYSTEM_PROMPT = `あなたは中小企業向けの財務コンサルタントです。
「お金のブロックパズル」（西順一郎先生のSTRAC図表をもとに和仁達也先生が改良した図解）の数値を読み解き、経営者向けに実用的なアドバイスを生成してください。

# 出力フォーマット（Markdown）

## 概観
（1〜2段落で5期分の全体トレンドを総括。読み手が真っ先に把握すべきポイントを示す）

## 注目すべきトレンド
- （3〜4点。具体的な数値変化を引用：「粗利益率が48.1%→52.4%に改善」「人件費が30,000千円→35,000千円に増加」など）
- （売上、粗利益率、労働分配率、固定費、税引前利益、増加キャッシュなどから読み取れる傾向）

## 改善アクションの提案
- （3〜4点。**優先順位順**。具体的な目標数値とアプローチを示す。例：「労働分配率を55%以下に下げるため、人件費を◯◯千円削減 or 粗利益を◯◯千円増加」）
- （実行可能性の高いものを上位に）

# 制約
- 全体で1000〜1500文字程度
- 専門用語は最小限に。使う場合は簡潔な補足を添える
- 数値の根拠を必ず提示（推測のみの提言はしない）
- データから読み取れる範囲で。不明な情報の憶測は避ける
- 経営者目線で読みやすく、行動につながる内容にする`;

function pct(rate: number): string {
  if (!isFinite(rate)) { return "-"; }
  return (rate * 100).toFixed(1) + "%";
}

function yen(value: number): string {
  return Math.round(value).toLocaleString("ja-JP") + "円";
}

/**
 * 1期分の数値を読みやすいテキストブロックに整形する。
 */
function formatPeriodBlock(r: BlockPuzzleResult, index: number): string {
  const profitLabel = r.preTaxProfit >= 0 ? "税引前当期利益" : "税引前当期損失";
  const afterTaxLabel = r.afterTaxProfit >= 0 ? "税引後利益" : "税引後損失";

  return `【第${index + 1}期 (${r.periodLabel || "期末日未入力"})】
- 売上高: ${yen(r.sales)} / 変動費: ${yen(r.variableCost)} / 粗利益: ${yen(r.grossProfit)}（粗利益率 ${pct(r.grossProfitRate)}）
- 人件費: ${yen(r.personnelCost)}（労働分配率 ${pct(r.laborDistributionRate)}） / その他固定費: ${yen(r.otherFixedCost)} / 固定費合計: ${yen(r.fixedCost)}
- ${profitLabel}: ${yen(r.preTaxProfit)} / 法人税等: ${yen(r.corporateTaxEtc)} / ${afterTaxLabel}: ${yen(r.afterTaxProfit)}
- 減価償却費: ${yen(r.depreciation)} / 借入金返済: ${yen(r.loanRepayment)} / 増加キャッシュ: ${yen(r.cashIncrease)}`;
}

/**
 * 5期分のBlockPuzzleResult配列をClaudeに渡すユーザーコンテンツに整形する。
 * 売上が0の期は分析対象から除外（未入力期と判定）。
 */
export function buildAdvicePrompt(results: BlockPuzzleResult[]): string {
  const valid = results.filter((r) => r.sales > 0);

  if (valid.length === 0) {
    return "P/Lデータが入力されていません。データを入力してから再実行してください。";
  }

  const periodsText = valid.map((r, i) => formatPeriodBlock(r, i)).join("\n\n");

  const noteLines: string[] = [];
  if (valid.length < results.length) {
    noteLines.push(`※ 入力欄${results.length}期のうち、データが入力されている${valid.length}期分を分析対象としています。`);
  }
  noteLines.push("※ 期は左ほど最新です。");

  return `以下は中小企業の${valid.length}期分の損益データを「お金のブロックパズル」の指標に整理したものです。

${periodsText}

${noteLines.join("\n")}

これらの数値からトレンドを読み取り、経営改善のためのアクションを提案してください。`;
}
