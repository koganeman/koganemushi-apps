import type { NextConfig } from "next";

/**
 * セキュリティレスポンスヘッダー（多層防御）。
 * 注: Next.js App Router はハイドレーション用インラインスクリプト/スタイルを
 * 出力するため CSP に 'unsafe-inline' を許容している。nonce 方式は middleware
 * 連携が必要で侵襲が大きいため、まずクリックジャッキング/MIME/参照元/HSTS と
 * 基本 CSP を導入する。'wasm-unsafe-eval' と worker blob: は PDF/OCR
 * (pdfjs-dist / tesseract.js) の動作に必要。
 *
 * 開発モード（next dev）の React Fast Refresh / Turbopack は eval() を使うため、
 * 開発時のみ 'unsafe-eval' を許可する。本番ビルドでは付与しない（CSP は厳格なまま）。
 */
const isDev = process.env.NODE_ENV !== "production";

const scriptSrc = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'"
  : "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'";

const csp = [
  "default-src 'self'",
  scriptSrc,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
