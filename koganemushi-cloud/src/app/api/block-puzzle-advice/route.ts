import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import type { BlockPuzzleResult } from "@/types/block-puzzle";
import { ADVICE_SYSTEM_PROMPT, buildAdvicePrompt } from "@/lib/block-puzzle-advice";
import {
  checkRateLimit,
  clientError,
  mapAnthropicError,
  readJsonBody,
} from "@/lib/api-guard";

/** results 配列の最大長（期間入力は通常少数） */
const MAX_RESULTS = 24;

interface RequestBody {
  results: BlockPuzzleResult[];
}

interface ErrorResponse {
  error: string;
}

interface SuccessResponse {
  text: string;
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadInputTokens: number;
    cacheCreationInputTokens: number;
  };
}

async function generateAdvice(apiKey: string, results: BlockPuzzleResult[]): Promise<SuccessResponse> {
  const anthropic = new Anthropic({ apiKey });
  const stream = anthropic.messages.stream({
    model: "claude-opus-4-7",
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    output_config: { effort: "high" },
    system: [
      { type: "text", text: ADVICE_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: buildAdvicePrompt(results) }],
  });
  const final = await stream.finalMessage();
  const text = final.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  return {
    text,
    model: final.model,
    usage: {
      inputTokens: final.usage.input_tokens,
      outputTokens: final.usage.output_tokens,
      cacheReadInputTokens: final.usage.cache_read_input_tokens ?? 0,
      cacheCreationInputTokens: final.usage.cache_creation_input_tokens ?? 0,
    },
  };
}

export async function POST(req: NextRequest): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
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

  try {
    return NextResponse.json(await generateAdvice(apiKey, body.results));
  } catch (err) {
    return mapAnthropicError(err, "アドバイス生成に失敗しました。時間をおいて再試行してください。");
  }
}
