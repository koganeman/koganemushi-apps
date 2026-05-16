import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import {
  LEDGER_MAPPING_SYSTEM_PROMPT,
  buildMappingUserPrompt,
} from "@/lib/general-ledger-ai-mapping";
import { SUBJECT_BY_ID } from "@/lib/shikin-guri-subjects";
import type {
  AiMappingRequestItem,
  AiMappingResultItem,
} from "@/types/general-ledger";

interface RequestBody {
  items: AiMappingRequestItem[];
}

interface ErrorResponse {
  error: string;
}

interface SuccessResponse {
  results: AiMappingResultItem[];
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
      { status: 429 },
    );
  }
  if (err instanceof Anthropic.AuthenticationError) {
    return NextResponse.json(
      { error: "Claude APIキーが無効です。.env.local の ANTHROPIC_API_KEY を確認してください。" },
      { status: 401 },
    );
  }
  if (err instanceof Anthropic.APIError) {
    return NextResponse.json(
      { error: `Claude APIエラー (${err.status}): ${err.message}` },
      { status: 502 },
    );
  }
  const message = err instanceof Error ? err.message : "未知のエラー";
  return NextResponse.json(
    { error: `AIマッピングに失敗しました: ${message}` },
    { status: 500 },
  );
}

/** モデル出力からJSON配列を寛容に抽出 */
function extractJsonArray(text: string): unknown {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end <= start) {
    throw new Error("AI応答からJSON配列を抽出できませんでした");
  }
  return JSON.parse(text.slice(start, end + 1));
}

function pickSubjectId(v: unknown): string | null {
  return typeof v === "string" && SUBJECT_BY_ID[v] ? v : null;
}

function pickConfidence(v: unknown): number {
  return typeof v === "number" && v >= 0 && v <= 1 ? v : 0;
}

function pickString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

/** 相手勘定科目（＋摘要があれば）で一意化する照合キー */
function itemKey(cp: string, description?: string): string {
  return `${cp}${description ?? ""}`;
}

function buildResult(
  rec: Record<string, unknown>,
  cp: string,
  description: string | undefined,
): AiMappingResultItem {
  return {
    counterpartyAccount: cp,
    ...(description !== undefined ? { description } : {}),
    subjectId: pickSubjectId(rec.subjectId),
    confidence: pickConfidence(rec.confidence),
    reason: pickString(rec.reason) ?? "",
  };
}

function normalizeItem(
  item: unknown,
  requestedKeys: Set<string>,
): { key: string; result: AiMappingResultItem } | null {
  if (typeof item !== "object" || item === null) {
    return null;
  }
  const rec = item as Record<string, unknown>;
  const cp = pickString(rec.counterpartyAccount) ?? "";
  if (!cp) {
    return null;
  }
  const description = pickString(rec.description);
  const key = itemKey(cp, description);
  if (!requestedKeys.has(key)) {
    return null;
  }
  return { key, result: buildResult(rec, cp, description) };
}

function sanitizeResults(
  raw: unknown,
  requested: AiMappingRequestItem[],
): AiMappingResultItem[] {
  const requestedKeys = new Set(
    requested.map((r) => itemKey(r.counterpartyAccount, r.description)),
  );
  const arr = Array.isArray(raw) ? raw : [];
  const byKey = new Map<string, AiMappingResultItem>();
  for (const item of arr) {
    const norm = normalizeItem(item, requestedKeys);
    if (norm && !byKey.has(norm.key)) {
      byKey.set(norm.key, norm.result);
    }
  }
  // 要求順を維持し、応答に欠落した項目は null(unmapped) で補完
  return requested.map(
    (r) =>
      byKey.get(itemKey(r.counterpartyAccount, r.description)) ?? {
        counterpartyAccount: r.counterpartyAccount,
        ...(r.description !== undefined ? { description: r.description } : {}),
        subjectId: null,
        confidence: 0,
        reason: "AI応答に含まれず",
      },
  );
}

async function generateMapping(
  apiKey: string,
  items: AiMappingRequestItem[],
): Promise<SuccessResponse> {
  const anthropic = new Anthropic({ apiKey });
  const msg = await anthropic.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 2048,
    system: [
      {
        type: "text",
        text: LEDGER_MAPPING_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: buildMappingUserPrompt(items) }],
  });
  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  const results = sanitizeResults(extractJsonArray(text), items);
  return {
    results,
    model: msg.model,
    usage: {
      inputTokens: msg.usage.input_tokens,
      outputTokens: msg.usage.output_tokens,
      cacheReadInputTokens: msg.usage.cache_read_input_tokens ?? 0,
      cacheCreationInputTokens: msg.usage.cache_creation_input_tokens ?? 0,
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
      { status: 500 },
    );
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "リクエストJSONの形式が不正です。" }, { status: 400 });
  }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: "items配列が必要です。" }, { status: 400 });
  }

  try {
    return NextResponse.json(await generateMapping(apiKey, body.items));
  } catch (err) {
    return mapAnthropicError(err);
  }
}
