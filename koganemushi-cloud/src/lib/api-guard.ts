/**
 * APIルート共通の入力ガード・レート制限・エラー整形。
 *
 * 目的:
 * - 有料LLMエンドポイントへのコスト増幅DoS / ペイロード肥大化の防止
 * - 上流(SDK)エラーメッセージのクライアント漏洩防止
 *
 * 注意（レート制限の限界）:
 * インメモリのため、サーバーレス/複数インスタンス環境では完全な
 * グローバル制限にはならない（インスタンス単位の防御）。恒久対策は
 * Upstash/Redis 等の外部ストアが必要。本実装は最低限の多層防御。
 */
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** リクエストボディの最大バイト数（LLM入力としては十分・肥大化は拒否） */
export const MAX_BODY_BYTES = 512 * 1024;

interface RateRule {
  /** ウィンドウ長（ms） */
  windowMs: number;
  /** ウィンドウ内の最大リクエスト数 */
  max: number;
}

const PER_IP: RateRule = { windowMs: 60_000, max: 20 };
const GLOBAL: RateRule = { windowMs: 60_000, max: 120 };

interface Bucket {
  count: number;
  resetAt: number;
}

const ipBuckets = new Map<string, Bucket>();
let globalBucket: Bucket = { count: 0, resetAt: 0 };

function hit(bucket: Bucket | undefined, rule: RateRule, now: number): Bucket {
  if (!bucket || now >= bucket.resetAt) {
    return { count: 1, resetAt: now + rule.windowMs };
  }
  return { count: bucket.count + 1, resetAt: bucket.resetAt };
}

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    return fwd.split(",")[0]?.trim() || "unknown";
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/** たまったIPバケットの掃除（メモリ肥大化防止） */
function sweep(now: number): void {
  if (ipBuckets.size < 1000) {
    return;
  }
  for (const [ip, b] of ipBuckets) {
    if (now >= b.resetAt) {
      ipBuckets.delete(ip);
    }
  }
}

/** レート制限超過なら 429 を返す。OKなら null。 */
export function checkRateLimit(
  req: NextRequest,
): NextResponse<{ error: string }> | null {
  const now = Date.now();
  sweep(now);

  const ip = clientIp(req);
  const ipNext = hit(ipBuckets.get(ip), PER_IP, now);
  ipBuckets.set(ip, ipNext);

  const globalNext = hit(globalBucket, GLOBAL, now);
  globalBucket = globalNext;

  if (ipNext.count > PER_IP.max || globalNext.count > GLOBAL.max) {
    const retryAfter = Math.ceil(
      (Math.max(ipNext.resetAt, globalNext.resetAt) - now) / 1000,
    );
    return NextResponse.json(
      { error: "リクエストが多すぎます。しばらく待ってから再試行してください。" },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }
  return null;
}

/**
 * ボディをサイズ上限付きで読み JSON.parse する。
 * 失敗時は 400/413 のレスポンスを返す（呼び出し側でそのまま return）。
 */
export async function readJsonBody(
  req: NextRequest,
): Promise<{ data: unknown } | { error: NextResponse<{ error: string }> }> {
  const lenHeader = req.headers.get("content-length");
  if (lenHeader && Number(lenHeader) > MAX_BODY_BYTES) {
    return {
      error: NextResponse.json(
        { error: "リクエストが大きすぎます。" },
        { status: 413 },
      ),
    };
  }
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return {
      error: NextResponse.json(
        { error: "リクエストが大きすぎます。" },
        { status: 413 },
      ),
    };
  }
  try {
    return { data: JSON.parse(raw) as unknown };
  } catch {
    return {
      error: NextResponse.json(
        { error: "リクエストJSONの形式が不正です。" },
        { status: 400 },
      ),
    };
  }
}

/** 文字列を最大長で切り詰め（プロンプト肥大化・インジェクション緩和） */
export function clampString(v: unknown, max: number): string {
  if (typeof v !== "string") {
    return "";
  }
  return v.length > max ? v.slice(0, max) : v;
}

/** 配列を最大長で切り詰め */
export function clampArray<T>(v: T[], max: number): T[] {
  return v.length > max ? v.slice(0, max) : v;
}

/** クライアント向けエラー（メッセージ固定）。 */
export function clientError(
  message: string,
  status: number,
): NextResponse<{ error: string }> {
  return NextResponse.json({ error: message }, { status });
}

/**
 * 上流/未知エラーをサーバー側に記録し、クライアントには一般化メッセージ
 * ＋追跡用の不透明IDのみ返す（内部情報・env名を漏らさない）。
 */
export function serverError(
  err: unknown,
  userMessage: string,
): NextResponse<{ error: string }> {
  const ref = Math.random().toString(36).slice(2, 10);
  console.error(`[api-error ${ref}]`, err);
  return NextResponse.json({ error: userMessage, ref }, { status: 502 });
}

/**
 * Anthropic SDK エラーを分類し、クライアントには一般化メッセージのみ返す。
 * 生の err.message / status / env名は漏らさない（詳細はサーバーログへ）。
 */
export function mapAnthropicError(
  err: unknown,
  fallbackMessage: string,
): NextResponse<{ error: string }> {
  if (err instanceof Anthropic.RateLimitError) {
    return NextResponse.json(
      { error: "AIが混雑しています。しばらく待ってから再試行してください。" },
      { status: 429 },
    );
  }
  if (err instanceof Anthropic.AuthenticationError) {
    console.error("[api-error] Anthropic 認証失敗（APIキー設定を確認）");
    return NextResponse.json(
      { error: "AIサービスの認証に失敗しました。管理者にお問い合わせください。" },
      { status: 502 },
    );
  }
  return serverError(err, fallbackMessage);
}
