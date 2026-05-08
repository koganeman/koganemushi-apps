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

function mapAnthropicError(err: unknown): NextResponse<ErrorResponse> {
  if (err instanceof Anthropic.RateLimitError) {
    return NextResponse.json(
      { error: "Claude APIのレート制限に達しました。しばらく待ってから再試行してください。" },
      { status: 429 }
    );
  }
  if (err instanceof Anthropic.AuthenticationError) {
    return NextResponse.json(
      { error: "Claude APIキーが無効です。.env.local の ANTHROPIC_API_KEY を確認してください。" },
      { status: 401 }
    );
  }
  if (err instanceof Anthropic.APIError) {
    return NextResponse.json(
      { error: `Claude APIエラー (${err.status}): ${err.message}` },
      { status: 502 }
    );
  }
  const message = err instanceof Error ? err.message : "未知のエラー";
  return NextResponse.json(
    { error: `理想P/L生成に失敗しました: ${message}` },
    { status: 500 }
  );
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
    focus: typeof p.focus === "string" ? p.focus : "",
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
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY が設定されていません。.env.local に設定してください。" },
      { status: 500 }
    );
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "リクエストJSONの形式が不正です。" }, { status: 400 });
  }
  if (!Array.isArray(body.results) || body.results.length === 0) {
    return NextResponse.json({ error: "results配列が必要です。" }, { status: 400 });
  }
  const params = validateParams(body.params);
  if (!params) {
    return NextResponse.json(
      { error: "params が不正です（horizonYears は 1/3/5 のいずれか）。" },
      { status: 400 }
    );
  }
  const adviceText =
    typeof body.existingAdviceText === "string" ? body.existingAdviceText : null;

  try {
    return NextResponse.json(
      await generateIdealPL(apiKey, body.results, params, adviceText),
    );
  } catch (err) {
    return mapAnthropicError(err);
  }
}
