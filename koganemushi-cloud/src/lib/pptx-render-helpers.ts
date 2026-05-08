/**
 * PPTX生成のための共通ヘルパー。html2canvas は SSR 不可なので動的importで使う。
 */

export interface CapturedImage {
  data: string;
  /** 元DOMのアスペクト比（width / height）。PPTX側でのレターボックス計算に使う。 */
  aspectRatio: number;
}

/**
 * ブラウザ側でDOM要素をPNG dataURLに変換する。
 * Tailwind v4 が oklch() カラーを使うため、それをサポートする html2canvas-pro を利用。
 */
export async function captureElementToPng(el: HTMLElement): Promise<CapturedImage> {
  const html2canvas = (await import("html2canvas-pro")).default;
  const rect = el.getBoundingClientRect();
  const naturalW = rect.width || el.offsetWidth || 1;
  const naturalH = rect.height || el.offsetHeight || 1;
  const canvas = await html2canvas(el, {
    backgroundColor: "#ffffff",
    scale: 2,
    logging: false,
    useCORS: true,
  });
  return {
    data: canvas.toDataURL("image/png"),
    aspectRatio: naturalW / naturalH,
  };
}

export const FONT_FACE = "Yu Gothic, メイリオ, Meiryo, MS PGothic, sans-serif";

export const COLORS = {
  text: "1F2937",        // gray-800
  subtext: "6B7280",     // gray-500
  primary: "1D4ED8",     // blue-700
  accent: "9333EA",      // purple-600
  highlight: "10B981",   // emerald-500
  warning: "DC2626",     // red-600
  bgLight: "F3F4F6",     // gray-100
};

export interface PeriodTuple {
  newest: string;
  oldest: string;
}

/** 期間ラベル文字列の組から「最古〜最新」を抽出 */
export function deriveSpanLabels(periodLabels: string[]): PeriodTuple {
  const filtered = periodLabels.filter((p) => p && p.trim() !== "");
  if (filtered.length === 0) {
    return { newest: "（未入力）", oldest: "（未入力）" };
  }
  return {
    newest: filtered[0],
    oldest: filtered[filtered.length - 1],
  };
}

/** YYYYMMDD_HHmmss でファイル名タイムスタンプ */
export function fileTimestamp(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

// 「- xxx」「・ xxx」「1. xxx」「1) xxx」「1） xxx」をすべて捕捉
const BULLET_RE = /^(?:[-*・]\s+|\d+[.)）]\s+)(.+)$/;

function tryExtractBulletText(line: string): string | null {
  const m = line.match(BULLET_RE);
  if (!m) { return null; }
  const cleaned = m[1].replace(/\*\*([^*]+)\*\*/g, "$1").trim();
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Markdown advice text から「## 改善アクションの提案」セクションの箇条書きを抽出。
 * 「-」「*」「・」または「1.」「1)」「1）」などの番号付きリスト両方に対応。
 */
export function extractActionBullets(markdown: string, max: number = 4): string[] {
  if (!markdown) { return []; }
  const bullets: string[] = [];
  let inSection = false;
  for (const raw of markdown.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("## ")) {
      inSection = /改善アクション|提案|アクション/.test(line);
      continue;
    }
    if (!inSection) { continue; }
    const bullet = tryExtractBulletText(line);
    if (bullet === null) { continue; }
    bullets.push(bullet);
    if (bullets.length >= max) { break; }
  }
  return bullets;
}

/** 通貨表示（円→千円、整数化、桁区切り） */
export function fmtThousand(yen: number): string {
  if (yen === 0 || !isFinite(yen)) { return "0"; }
  return Math.round(yen / 1000).toLocaleString("ja-JP");
}

/** 比率（小数）→「XX.X%」 */
export function fmtRate(rate: number): string {
  if (!isFinite(rate)) { return "-"; }
  return (rate * 100).toFixed(1) + "%";
}
