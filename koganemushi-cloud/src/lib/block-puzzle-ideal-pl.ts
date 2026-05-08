/**
 * AI理想P/L生成のためのプロンプト・ツールスキーマ・パーサー。
 * APIコールはここでは行わない（テスト容易性のため）。
 */

import type {
  BlockPuzzleResult,
  IdealPLParams,
  PLPeriodInput,
} from "@/types/block-puzzle";

export const IDEAL_PL_SYSTEM_PROMPT = `あなたは中小企業向けの財務コンサルタントです。
過去の実績P/Lとユーザーが提示する経営目標から、達成したい「理想のP/L」（西順一郎先生のSTRAC図表 / 和仁達也先生改良版「お金のブロックパズル」）の数値を提案してください。

# あなたの役割
- 過去5期分のトレンド（売上、粗利益率、人件費、固定費、増加キャッシュなど）を踏まえる
- ユーザーが指定した目標（売上、粗利率、労働分配率、増加キャッシュ、重視ポイント）を尊重する
- 指定がない項目は、過去実績の傾向と業界一般の指標から妥当な目安を提案する
- 不可能・非現実的な目標は補正せず、その達成に必要な数値構造を提示する
- 数値は全て整数（円単位）で提示する

# 出力ルール
- 必ず submit_ideal_pl ツールを呼び出して構造化された数値を提出する
- reasoning フィールドには日本語のMarkdownで「なぜこの数値にしたか」の経営者向け説明（800〜1200文字程度）を記載する
- reasoning には ## 全体方針 / ## 主要KPIの根拠 / ## 達成のためのアクション の3セクションを含める
- 数値項目は欠落させず、不要な項目（例：賞与なしの会社）は0で明示する

# 数値整合性
- 売上 = 変動費 + 粗利益（暗黙）
- 人件費合計 = 役員報酬 + 役員賞与 + 給料手当 + 雑給 + 賞与 + 退職金 + 法定福利費 (+ 変動費に含まれる人件費)
- 固定費 = 人件費 + 販売管理費計（人件費以外）
- 税引前利益 = 粗利益 − 固定費
- 増加キャッシュ = (税引前利益 − 法人税等) + 減価償却費 − 借入金返済`;

export const IDEAL_PL_TOOL_NAME = "submit_ideal_pl";

export const IDEAL_PL_TOOL_SCHEMA = {
  name: IDEAL_PL_TOOL_NAME,
  description:
    "過去実績とユーザー目標を踏まえた理想のP/L数値（円単位、整数）と、その根拠を提出する。",
  input_schema: {
    type: "object" as const,
    properties: {
      periodLabel: {
        type: "string",
        description:
          "理想P/Lのラベル。例: 'AI理想 (3年後)' のように年数を含めること。",
      },
      sales: { type: "number", description: "売上高（円、整数）" },
      costOfSales: { type: "number", description: "売上原価（変動費）" },
      personnelInVariableCost: {
        type: "number",
        description: "変動費に含まれる人件費等の調整額（多くの場合0）",
      },
      executiveCompensation: { type: "number", description: "役員報酬" },
      executiveBonus: { type: "number", description: "役員賞与" },
      salaryAllowance: { type: "number", description: "給料手当" },
      miscellaneousSalary: { type: "number", description: "雑給" },
      bonus: { type: "number", description: "賞与" },
      retirementBenefits: { type: "number", description: "退職金" },
      legalWelfare: { type: "number", description: "法定福利費" },
      sellingAdminOther: {
        type: "number",
        description: "販売管理費計（人件費を除く販管費の合計）",
      },
      depreciation: { type: "number", description: "減価償却費" },
      corporateTaxEtc: { type: "number", description: "法人税等" },
      loanRepayment: { type: "number", description: "借入金返済（年間）" },
      reasoning: {
        type: "string",
        description:
          "経営者向けの根拠説明（Markdown）。## 全体方針 / ## 主要KPIの根拠 / ## 達成のためのアクション を含める。",
      },
    },
    required: [
      "periodLabel",
      "sales",
      "costOfSales",
      "personnelInVariableCost",
      "executiveCompensation",
      "executiveBonus",
      "salaryAllowance",
      "miscellaneousSalary",
      "bonus",
      "retirementBenefits",
      "legalWelfare",
      "sellingAdminOther",
      "depreciation",
      "corporateTaxEtc",
      "loanRepayment",
      "reasoning",
    ],
  },
};

function pct(rate: number): string {
  if (!isFinite(rate)) { return "-"; }
  return (rate * 100).toFixed(1) + "%";
}

function yen(value: number): string {
  return Math.round(value).toLocaleString("ja-JP") + "円";
}

function formatPeriodBlock(r: BlockPuzzleResult, index: number): string {
  return `【第${index + 1}期 (${r.periodLabel || "期末日未入力"})】
- 売上高: ${yen(r.sales)} / 変動費: ${yen(r.variableCost)} / 粗利益: ${yen(r.grossProfit)}（粗利益率 ${pct(r.grossProfitRate)}）
- 人件費: ${yen(r.personnelCost)}（労働分配率 ${pct(r.laborDistributionRate)}） / その他固定費: ${yen(r.otherFixedCost)} / 固定費合計: ${yen(r.fixedCost)}
- 税引前利益: ${yen(r.preTaxProfit)} / 法人税等: ${yen(r.corporateTaxEtc)} / 税引後利益: ${yen(r.afterTaxProfit)}
- 減価償却費: ${yen(r.depreciation)} / 借入金返済: ${yen(r.loanRepayment)} / 増加キャッシュ: ${yen(r.cashIncrease)}`;
}

function formatTargets(params: IdealPLParams): string {
  const lines: string[] = [];
  lines.push(`- 対象期間: 現時点から${params.horizonYears}年後の理想P/L`);
  lines.push(
    params.salesTarget !== null
      ? `- 売上目標: ${yen(params.salesTarget)}`
      : "- 売上目標: 指定なし（実績傾向から妥当な値を提案）",
  );
  lines.push(
    params.targetGrossMarginPct !== null
      ? `- 目標粗利益率: ${params.targetGrossMarginPct.toFixed(1)}%`
      : "- 目標粗利益率: 指定なし",
  );
  lines.push(
    params.targetLaborDistributionPct !== null
      ? `- 目標労働分配率: ${params.targetLaborDistributionPct.toFixed(1)}%`
      : "- 目標労働分配率: 指定なし",
  );
  lines.push(
    params.targetCashIncrease !== null
      ? `- 目標増加キャッシュ: ${yen(params.targetCashIncrease)}`
      : "- 目標増加キャッシュ: 指定なし",
  );
  if (params.focus.trim()) {
    lines.push(`- 重視ポイント（自由記述）: ${params.focus.trim()}`);
  }
  return lines.join("\n");
}

/**
 * 5期分の results、ユーザー目標、（任意で）既存AIアドバイスから、
 * 理想P/L生成用のユーザープロンプトを構築する。
 */
export function buildIdealPLPrompt(
  results: BlockPuzzleResult[],
  params: IdealPLParams,
  existingAdviceText: string | null,
): string {
  const valid = results.filter((r) => r.sales > 0);

  if (valid.length === 0) {
    return "P/Lデータが入力されていません。データを入力してから再実行してください。";
  }

  const periodsText = valid.map((r, i) => formatPeriodBlock(r, i)).join("\n\n");
  const targetsText = formatTargets(params);

  const sections: string[] = [
    `以下は中小企業の${valid.length}期分の実績損益データです。期は左ほど最新です。`,
    periodsText,
    `# ユーザーが指定する経営目標\n${targetsText}`,
  ];

  if (existingAdviceText && existingAdviceText.trim()) {
    sections.push(
      `# 過去AI経営アドバイス（参考。理想P/Lの方針はこのアドバイスと整合させること）\n${existingAdviceText.trim()}`,
    );
  }

  sections.push(
    `これらを踏まえ、現時点から${params.horizonYears}年後に達成したい理想P/Lの数値を submit_ideal_pl ツールで提出してください。`,
  );

  return sections.join("\n\n");
}

/**
 * Anthropic API レスポンスから tool_use ブロックを取り出し、PLPeriodInput と reasoning に分離する。
 */
export interface ToolUseBlock {
  type: "tool_use";
  name: string;
  input: unknown;
}

export interface ParsedIdealPL {
  period: PLPeriodInput;
  reasoning: string;
}

/** AIが提出する数値項目（preTaxIncomeRef はAIに要求しないため含めない） */
type AINumericField = Exclude<keyof PLPeriodInput, "periodLabel" | "preTaxIncomeRef">;

const NUMBER_FIELDS: AINumericField[] = [
  "sales",
  "costOfSales",
  "personnelInVariableCost",
  "executiveCompensation",
  "executiveBonus",
  "salaryAllowance",
  "miscellaneousSalary",
  "bonus",
  "retirementBenefits",
  "legalWelfare",
  "sellingAdminOther",
  "depreciation",
  "corporateTaxEtc",
  "loanRepayment",
];

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

function buildPeriodFromInput(input: Record<string, unknown>): PLPeriodInput {
  const periodLabel =
    typeof input.periodLabel === "string" && input.periodLabel.length > 0
      ? input.periodLabel
      : "AI理想";

  const period: PLPeriodInput = {
    periodLabel,
    sales: 0,
    costOfSales: 0,
    personnelInVariableCost: 0,
    executiveCompensation: 0,
    executiveBonus: 0,
    salaryAllowance: 0,
    miscellaneousSalary: 0,
    bonus: 0,
    retirementBenefits: 0,
    legalWelfare: 0,
    sellingAdminOther: 0,
    preTaxIncomeRef: 0,
    depreciation: 0,
    corporateTaxEtc: 0,
    loanRepayment: 0,
  };

  for (const field of NUMBER_FIELDS) {
    const v = input[field];
    if (typeof v !== "number" || !isFinite(v)) {
      throw new Error(`ツール入力の "${field}" が数値ではありません。`);
    }
    period[field] = Math.round(v);
  }

  return period;
}

/**
 * tool_use ブロックを抽出し、型検証して PLPeriodInput + reasoning に変換する。
 * 失敗時は Error を投げる。
 */
export function parseIdealPLToolUse(blocks: ToolUseBlock[]): ParsedIdealPL {
  const block = blocks.find((b) => b.name === IDEAL_PL_TOOL_NAME);
  if (!block) {
    throw new Error(`AIが ${IDEAL_PL_TOOL_NAME} ツールを呼び出しませんでした。`);
  }
  const input = block.input;
  if (!isRecord(input)) {
    throw new Error("ツール入力の形式が不正です（オブジェクトではありません）。");
  }
  const reasoning = typeof input.reasoning === "string" ? input.reasoning : "";
  const period = buildPeriodFromInput(input);
  return { period, reasoning };
}
