import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import type { BlockPuzzleResult } from "@/types/block-puzzle";
import { ADVICE_SYSTEM_PROMPT, buildAdvicePrompt } from "@/lib/block-puzzle-advice";

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
  return NextResponse.json({ error: `アドバイス生成に失敗しました: ${message}` }, { status: 500 });
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

  try {
    return NextResponse.json(await generateAdvice(apiKey, body.results));
  } catch (err) {
    return mapAnthropicError(err);
  }
}
