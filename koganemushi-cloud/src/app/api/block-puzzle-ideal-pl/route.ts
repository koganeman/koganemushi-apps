import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import type {
  BlockPuzzleResult,
  IdealPLParams,
  PLPeriodInput,
} from "@/types/block-puzzle";
import {
  IDEAL_PL_SYSTEM_PROMPT,
  IDEAL_PL_TOOL_NAME,
  IDEAL_PL_TOOL_SCHEMA,
  buildIdealPLPrompt,
  parseIdealPLToolUse,
  type ToolUseBlock,
} from "@/lib/block-puzzle-ideal-pl";
import {
  checkRateLimit,
  clampString,
  clientError,
  mapAnthropicError,
  readJsonBody,
} from "@/lib/api-guard";

/** results 配列の最大長 */
const MAX_RESULTS = 24;
/** 自由記述フィールドの最大長（プロンプト肥大化・インジェクション緩和） */
const MAX_FOCUS_LEN = 1_000;
const MAX_ADVICE_LEN = 20_000;

interface RequestBody {
  results: BlockPuzzleResult[];
  params: IdealPLParams;
  existingAdviceText: string | null;
}

interface ErrorResponse {
  error: string;
}

interface SuccessResponse {
  period: PLPeriodInput;
  reasoning: string;
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadInputTokens: number;
    cacheCreationInputTokens: number;
  };
}

function validateParams(params: unknown): IdealPLParams | null {
  if (typeof params !== "object" || params === null) { return null; }
  const p = params as Record<string, unknown>;
  if (p.horizonYears !== 1) { return null; }
  const num = (v: unknown): number | null => {
    if (v === null) { return null; }
    if (typeof v === "number" && isFinite(v)) { return v; }
    return null;
  };
  return {
    horizonYears: 1,
    salesTarget: num(p.salesTarget),
    targetGrossMarginPct: num(p.targetGrossMarginPct),
    targetLaborDistributionPct: num(p.targetLaborDistributionPct),
    targetCashIncrease: num(p.targetCashIncrease),
    focus: clampString(p.focus, MAX_FOCUS_LEN),
  };
}

async function generateIdealPL(
  apiKey: string,
  results: BlockPuzzleResult[],
  params: IdealPLParams,
  existingAdviceText: string | null,
): Promise<SuccessResponse> {
  const anthropic = new Anthropic({ apiKey });
  // 注: thinking と forced tool_choice は併用不可（API制約）。
  // 構造化出力の信頼性を優先して thinking を外し、tool_choice で submit_ideal_pl を強制する。
  const stream = anthropic.messages.stream({
    model: "claude-opus-4-7",
    max_tokens: 8192,
    system: [
      { type: "text", text: IDEAL_PL_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
    ],
    tools: [IDEAL_PL_TOOL_SCHEMA],
    tool_choice: { type: "tool", name: IDEAL_PL_TOOL_NAME },
    messages: [
      {
        role: "user",
        content: buildIdealPLPrompt(results, params, existingAdviceText),
      },
    ],
  });
  const final = await stream.finalMessage();
  const toolBlocks = final.content.filter(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
  ) as ToolUseBlock[];

  const parsed = parseIdealPLToolUse(toolBlocks);

  return {
    period: parsed.period,
    reasoning: parsed.reasoning,
    model: final.model,
    usage: {
      inputTokens: final.usage.input_tokens,
      outputTokens: final.usage.output_tokens,
      cacheReadInputTokens: final.usage.cache_read_input_tokens ?? 0,
      cacheCreationInputTokens: final.usage.cache_creation_input_tokens ?? 0,
    },
  };
}

export async function POST(
  req: NextRequest,
): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  const limited = checkRateLimit(req);
  if (limited) {
    return limited;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[api-error] ANTHROPIC_API_KEY 未設定");
    return clientError("AIサービスが利用できません。管理者にお問い合わせください。", 503);
  }

  const parsed = await readJsonBody(req);
  if ("error" in parsed) {
    return parsed.error;
  }
  const body = parsed.data as RequestBody;
  if (!Array.isArray(body.results) || body.results.length === 0) {
    return clientError("results配列が必要です。", 400);
  }
  if (body.results.length > MAX_RESULTS) {
    return clientError(`results が多すぎます（最大${MAX_RESULTS}件）。`, 400);
  }
  const params = validateParams(body.params);
  if (!params) {
    return clientError("params が不正です（horizonYears は 1/3/5 のいずれか）。", 400);
  }
  const adviceText =
    typeof body.existingAdviceText === "string"
      ? body.existingAdviceText.slice(0, MAX_ADVICE_LEN)
      : null;

  try {
    return NextResponse.json(
      await generateIdealPL(apiKey, body.results, params, adviceText),
    );
  } catch (err) {
    return mapAnthropicError(err, "理想P/L生成に失敗しました。時間をおいて再試行してください。");
  }
}
