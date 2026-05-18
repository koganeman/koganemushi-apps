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
import {
  checkRateLimit,
  clientError,
  mapAnthropicError,
  readJsonBody,
} from "@/lib/api-guard";

/** items 配列の最大長（コスト増幅DoS防止） */
const MAX_ITEMS = 300;

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

/** モデル出力からJSON配列を寛容に抽出（サイズ上限・parse失敗を内包） */
function extractJsonArray(text: string): unknown {
  // モデル出力は攻撃者制御CSVの影響を受けうるため長さを制限
  const capped = text.length > 200_000 ? text.slice(0, 200_000) : text;
  const start = capped.indexOf("[");
  const end = capped.lastIndexOf("]");
  if (start < 0 || end <= start) {
    throw new Error("AI応答からJSON配列を抽出できませんでした");
  }
  try {
    return JSON.parse(capped.slice(start, end + 1));
  } catch {
    throw new Error("AI応答のJSON解析に失敗しました");
  }
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
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return clientError("items配列が必要です。", 400);
  }
  if (body.items.length > MAX_ITEMS) {
    return clientError(`items が多すぎます（最大${MAX_ITEMS}件）。`, 400);
  }

  try {
    return NextResponse.json(await generateMapping(apiKey, body.items));
  } catch (err) {
    return mapAnthropicError(err, "AIマッピングに失敗しました。時間をおいて再試行してください。");
  }
}
