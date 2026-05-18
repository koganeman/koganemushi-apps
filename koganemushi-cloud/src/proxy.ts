import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|.*\\.svg$).*)"],
};

/** 長さ・内容を一定時間で比較（タイミング攻撃緩和）。Edge互換（Web標準APIのみ）。 */
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  // 長さの違いも一定時間に均す: 比較対象を max 長で走査
  const len = Math.max(ab.length, bb.length);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < len; i++) {
    diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return diff === 0;
}

function unauthorized(): NextResponse {
  return new NextResponse("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Secure Area"' },
  });
}

/** Authorization ヘッダーから Basic 認証情報を取り出す。失敗時 null。 */
function parseBasicAuth(
  header: string | null,
): { user: string; pass: string } | null {
  if (!header) {
    return null;
  }
  const [scheme, encoded] = header.split(" ");
  if (scheme !== "Basic" || !encoded) {
    return null;
  }
  let decoded: string;
  try {
    decoded = atob(encoded);
  } catch {
    return null;
  }
  // パスワードに ":" が含まれても壊れないよう最初の ":" でのみ分割
  const sep = decoded.indexOf(":");
  return sep >= 0
    ? { user: decoded.slice(0, sep), pass: decoded.slice(sep + 1) }
    : { user: decoded, pass: "" };
}

export default function proxy(request: NextRequest) {
  const expectedUser = process.env.ADMIN_USER;
  const expectedPass = process.env.ADMIN_PASS;
  // 認証情報が未設定なら一律拒否（デフォルト無防備を防ぐ）
  if (!expectedUser || !expectedPass) {
    return unauthorized();
  }

  const cred = parseBasicAuth(request.headers.get("authorization"));
  if (!cred) {
    return unauthorized();
  }
  // 短絡評価を避け両方を常に評価（タイミング差の低減）
  const okUser = timingSafeEqual(cred.user, expectedUser);
  const okPass = timingSafeEqual(cred.pass, expectedPass);
  return okUser && okPass ? NextResponse.next() : unauthorized();
}
