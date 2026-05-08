/**
 * 貸借対照表（B/S）アドバイス生成のためのプロンプト構築。
 * APIコールはここでは行わない（テスト容易性のため）。
 */

import type { BalanceSheetResult } from "@/types/balance-sheet";

export const BS_ADVICE_SYSTEM_PROMPT = `あなたは中小企業向けの財務コンサルタントです。
貸借対照表（B/S）の数値を読み解き、経営者向けに財務体質の解説と改善アクションを生成してください。

# 出力フォーマット（Markdown）

## 概観
（1〜2段落で5期分の財務体質の全体トレンドを総括。総資産規模、資金構成、自己資本の厚みなど）

## 注目すべき指標の変化
- （3〜4点。具体的な数値変化を引用：「自己資本比率が55%→68%に改善」「現預金が30,000千円→42,000千円に積み上がる一方、固定負債を25,000千円→17,000千円に圧縮」など）
- （流動比率、自己資本比率、固定比率、固定長期適合率、現預金水準などから読み取れる傾向）

## 改善アクションの提案
- （3〜4点。**優先順位順**。具体的な目標水準とアプローチを示す。例：「自己資本比率70%超に向け、配当を抑制し内部留保を年5百万円積み増し」「固定比率100%以下を目指し、固定資産購入を抑制 or 増資検討」）
- （実行可能性の高いものを上位に）

# 制約
- 全体で1000〜1500文字程度
- 専門用語は最小限に。使う場合は簡潔な補足を添える（例：「自己資本比率＝純資産÷総資産」）
- 数値の根拠を必ず提示（推測のみの提言はしない）
- データから読み取れる範囲で。不明な情報の憶測は避ける
- 経営者目線で読みやすく、行動につながる内容にする
- 貸借差額（借方と貸方の不一致）が出ている期があれば最初に指摘する`;

function pct(rate: number): string {
  if (!isFinite(rate)) { return "-"; }
  return (rate * 100).toFixed(1) + "%";
}

function yen(value: number): string {
  return Math.round(value).toLocaleString("ja-JP") + "円";
}

function ratio(value: number): string {
  if (!isFinite(value)) { return "-"; }
  return value.toFixed(2);
}

function formatPeriodBlock(r: BalanceSheetResult, index: number): string {
  const imbalanceLine =
    Math.abs(r.imbalance) >= 1
      ? `\n- ⚠ 貸借差額: ${yen(r.imbalance)}（資産合計と資本合計が一致していません）`
      : "";

  return `【第${index + 1}期 (${r.periodLabel || "期末日未入力"})】
- 総資産: ${yen(r.totalAssets)} = 現預金 ${yen(r.cash)} / 流動資産（現預金除く） ${yen(r.currentAssetsExCash)} / 固定資産 ${yen(r.fixedAssets)}
- 総資本: ${yen(r.totalCapital)} = 流動負債 ${yen(r.currentLiabilities)} / 固定負債 ${yen(r.longTermLiabilities)} / 純資産 ${yen(r.netAssets)}
- 流動比率（当座資産÷流動負債）: ${pct(r.currentRatio)} / 自己資本比率: ${pct(r.equityRatio)}
- 固定比率（固定資産÷純資産）: ${ratio(r.fixedRatio)} / 固定長期適合率: ${pct(r.fixedLongTermRatio)}${imbalanceLine}`;
}

/**
 * 5期分の B/S 派生指標から Claude に渡すユーザーコンテンツを構築する。
 * 総資産が0の期は分析対象から除外（未入力期と判定）。
 */
export function buildBSAdvicePrompt(results: BalanceSheetResult[]): string {
  const valid = results.filter((r) => r.totalAssets > 0);

  if (valid.length === 0) {
    return "B/Sデータが入力されていません。データを入力してから再実行してください。";
  }

  const periodsText = valid.map((r, i) => formatPeriodBlock(r, i)).join("\n\n");

  const noteLines: string[] = [];
  if (valid.length < results.length) {
    noteLines.push(
      `※ 入力欄${results.length}期のうち、データが入力されている${valid.length}期分を分析対象としています。`,
    );
  }
  noteLines.push("※ 期は左ほど最新です。");

  return `以下は中小企業の${valid.length}期分の貸借対照表（B/S）数値とそこから算出した財務指標です。

${periodsText}

${noteLines.join("\n")}

これらの数値からトレンドを読み取り、財務体質の改善アクションを提案してください。`;
}
