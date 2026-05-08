/**
 * 経営レポートPPTX生成。クライアントサイドで pptxgenjs と html2canvas を動的importで使用。
 *
 * 7スライド構成:
 *  1. 表紙
 *  2. 経営の概観（KPIサマリー）
 *  3. 損益（P/L）の流れ
 *  4. 財務体質（B/S）の状態
 *  5. AI 経営アドバイス（P/L）
 *  6. AI 財務体質アドバイス（B/S）
 *  7. 改善アクション TOP3
 */

import type PptxGenJS from "pptxgenjs";
import type { BlockPuzzleResult } from "@/types/block-puzzle";
import type { BalanceSheetResult } from "@/types/balance-sheet";
import {
  COLORS,
  FONT_FACE,
  captureElementToPng,
  deriveSpanLabels,
  extractActionBullets,
  fileTimestamp,
  fmtRate,
  fmtThousand,
} from "./pptx-render-helpers";

type Pptx = PptxGenJS;
type Slide = ReturnType<PptxGenJS["addSlide"]>;

interface GenerateArgs {
  plResults: BlockPuzzleResult[];
  bsResults: BalanceSheetResult[];
  plAdviceText: string | null;
  bsAdviceText: string | null;
  /** key: "pl-0" / "bs-0" 形式の data-pptx-export-id */
  diagramElements: Map<string, HTMLElement>;
}

const SLIDE_W = 13.33;
const SLIDE_H = 7.5;

export async function generateReportPPTX(args: GenerateArgs): Promise<void> {
  const Pptxgen = (await import("pptxgenjs")).default;
  const pptx = new Pptxgen();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = "経営レポート";

  await addCoverSlide(pptx, args);
  addOverviewSlide(pptx, args);
  await addPLDiagramSlide(pptx, args);
  await addBSDiagramSlide(pptx, args);
  addAdviceSlide(pptx, {
    title: "AI 経営アドバイス（P/L）",
    bullets: extractActionBullets(args.plAdviceText ?? "", 4),
    fullText: args.plAdviceText,
    accent: COLORS.primary,
  });
  addAdviceSlide(pptx, {
    title: "AI 財務体質アドバイス（B/S）",
    bullets: extractActionBullets(args.bsAdviceText ?? "", 4),
    fullText: args.bsAdviceText,
    accent: COLORS.highlight,
  });
  addTopActionsSlide(pptx, args);

  await pptx.writeFile({ fileName: `経営レポート_${fileTimestamp()}.pptx` });
}

async function addCoverSlide(pptx: Pptx, args: GenerateArgs): Promise<void> {
  const slide = pptx.addSlide();
  slide.background = { color: "F8FAFC" };

  const span = deriveSpanLabels(args.plResults.map((r) => r.periodLabel));
  const today = new Date().toLocaleDateString("ja-JP");

  slide.addText("経営レポート", {
    x: 0.5,
    y: 1.5,
    w: SLIDE_W - 1,
    h: 1.2,
    fontSize: 54,
    bold: true,
    color: COLORS.text,
    fontFace: FONT_FACE,
    align: "center",
  });
  slide.addText("お金のブロックパズル + 貸借対照表ブロックパズル", {
    x: 0.5,
    y: 2.8,
    w: SLIDE_W - 1,
    h: 0.6,
    fontSize: 18,
    color: COLORS.subtext,
    fontFace: FONT_FACE,
    align: "center",
  });
  slide.addText(`対象期間: ${span.oldest} 〜 ${span.newest}`, {
    x: 0.5,
    y: 4.0,
    w: SLIDE_W - 1,
    h: 0.5,
    fontSize: 20,
    color: COLORS.text,
    fontFace: FONT_FACE,
    align: "center",
  });
  slide.addText(`出力日: ${today}`, {
    x: 0.5,
    y: 4.6,
    w: SLIDE_W - 1,
    h: 0.4,
    fontSize: 14,
    color: COLORS.subtext,
    fontFace: FONT_FACE,
    align: "center",
  });
  slide.addText(
    "※ 本レポートは西順一郎先生のSTRAC図表をもとに和仁達也先生が改良した「お金のブロックパズル」と、貸借対照表（B/S）の図解で構成されています。",
    {
      x: 1,
      y: 6.5,
      w: SLIDE_W - 2,
      h: 0.6,
      fontSize: 10,
      color: COLORS.subtext,
      fontFace: FONT_FACE,
      align: "center",
    },
  );
}

// =====================================================
// Slide 2: Overview (KPI summary)
// =====================================================

interface KpiCard {
  label: string;
  value: string;
  color: string;
}

function buildKpiCards(args: GenerateArgs): KpiCard[] {
  const latestPL = args.plResults[0];
  const latestBS = args.bsResults[0];
  return [
    {
      label: "売上高（最新期）",
      value: `${fmtThousand(latestPL.sales)} 千円`,
      color: COLORS.primary,
    },
    {
      label: "税引前当期利益",
      value: `${fmtThousand(latestPL.preTaxProfit)} 千円`,
      color: latestPL.preTaxProfit < 0 ? COLORS.warning : COLORS.highlight,
    },
    {
      label: "自己資本比率",
      value: latestBS && latestBS.totalAssets > 0 ? fmtRate(latestBS.equityRatio) : "-",
      color: COLORS.accent,
    },
    {
      label: "増加キャッシュ",
      value: `${fmtThousand(latestPL.cashIncrease)} 千円`,
      color: latestPL.cashIncrease < 0 ? COLORS.warning : COLORS.highlight,
    },
  ];
}

function renderKpiCards(slide: Slide, cards: KpiCard[]): void {
  const cardW = 2.8;
  const cardH = 2.0;
  const totalW = cardW * 4 + 0.3 * 3;
  const startX = (SLIDE_W - totalW) / 2;
  const startY = 1.8;

  cards.forEach((c, i) => {
    const x = startX + i * (cardW + 0.3);
    slide.addShape("roundRect", {
      x, y: startY, w: cardW, h: cardH,
      fill: { color: "FFFFFF" },
      line: { color: c.color, width: 2 },
      rectRadius: 0.1,
    });
    slide.addText(c.label, {
      x, y: startY + 0.15, w: cardW, h: 0.5,
      fontSize: 14, color: COLORS.subtext, fontFace: FONT_FACE, align: "center",
    });
    slide.addText(c.value, {
      x, y: startY + 0.7, w: cardW, h: 1.0,
      fontSize: 28, bold: true, color: c.color, fontFace: FONT_FACE, align: "center",
    });
  });
}

function addOverviewSlide(pptx: Pptx, args: GenerateArgs): void {
  const slide = pptx.addSlide();
  addSlideTitle(slide, "経営の概観");

  const latestPL = args.plResults[0];

  if (!latestPL || latestPL.sales === 0) {
    slide.addText("P/Lデータが入力されていません。", {
      x: 0.5,
      y: 3,
      w: SLIDE_W - 1,
      h: 0.5,
      fontSize: 16,
      color: COLORS.subtext,
      fontFace: FONT_FACE,
      align: "center",
    });
    return;
  }

  renderKpiCards(slide, buildKpiCards(args));

  slide.addText(
    `P/L: ${args.plResults.filter((r) => r.sales > 0).length}期分 / B/S: ${args.bsResults.filter((r) => r.totalAssets > 0).length}期分のデータを集計しています。`,
    {
      x: 0.5,
      y: 4.5,
      w: SLIDE_W - 1,
      h: 0.4,
      fontSize: 12,
      color: COLORS.subtext,
      fontFace: FONT_FACE,
      align: "center",
    },
  );
}

// =====================================================
// Slide 3: P/L diagrams
// =====================================================

async function addPLDiagramSlide(pptx: Pptx, args: GenerateArgs): Promise<void> {
  const slide = pptx.addSlide();
  addSlideTitle(slide, "損益の流れ（P/L 5期分のブロックパズル）");
  await renderDiagramRow(slide, args, "pl", args.plResults.map((r) => r.periodLabel));
}

// =====================================================
// Slide 4: B/S diagrams
// =====================================================

async function addBSDiagramSlide(pptx: Pptx, args: GenerateArgs): Promise<void> {
  const slide = pptx.addSlide();
  addSlideTitle(slide, "財務体質（B/S 5期分のブロックパズル）");
  await renderDiagramRow(slide, args, "bs", args.bsResults.map((r) => r.periodLabel));
}

interface CellPlacement {
  x: number;
  y: number;
  w: number;
  h: number;
}

async function renderDiagramRow(
  slide: Slide,
  args: GenerateArgs,
  prefix: "pl" | "bs",
  periodLabels: string[],
): Promise<void> {
  // 5枚を3列×2行のグリッドで配置（左→右、上→下）。最終行は中央寄せ。
  const count = periodLabels.length;
  const cols = 3;
  const cardW = 3.6;
  const cardH = 2.8;
  const gapX = 0.2;
  const gapY = 0.25;
  const startY = 1.0;

  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const itemsInRow = Math.min(count - row * cols, cols);
    const rowW = cardW * itemsInRow + gapX * (itemsInRow - 1);
    const rowStartX = (SLIDE_W - rowW) / 2;
    const placement: CellPlacement = {
      x: rowStartX + col * (cardW + gapX),
      y: startY + row * (cardH + gapY),
      w: cardW,
      h: cardH,
    };
    await renderDiagramCell({ slide, args, prefix, i, p: placement });
  }
}

interface CellArgs {
  slide: Slide;
  args: GenerateArgs;
  prefix: "pl" | "bs";
  i: number;
  p: CellPlacement;
}

async function renderDiagramCell({ slide, args, prefix, i, p }: CellArgs): Promise<void> {
  const el = args.diagramElements.get(`${prefix}-${i}`);
  if (!el) {
    slide.addShape("rect", {
      x: p.x, y: p.y, w: p.w, h: p.h,
      fill: { color: "F3F4F6" },
      line: { color: "D1D5DB" },
    });
    slide.addText("（データなし）", {
      x: p.x, y: p.y + p.h / 2 - 0.2, w: p.w, h: 0.4,
      fontSize: 12, color: COLORS.subtext, fontFace: FONT_FACE, align: "center",
    });
    return;
  }
  try {
    const captured = await captureElementToPng(el);
    // 元DOMのアスペクト比を保ったまま、セル内に最大表示（レターボックス）
    const cellAspect = p.w / p.h;
    let imgW = p.w;
    let imgH = p.h;
    if (captured.aspectRatio > cellAspect) {
      // 元画像の方が横長 → 幅をセル幅に合わせ、高さを縮める
      imgH = p.w / captured.aspectRatio;
    } else {
      // 元画像の方が縦長 → 高さをセル高さに合わせ、幅を縮める
      imgW = p.h * captured.aspectRatio;
    }
    const offsetX = (p.w - imgW) / 2;
    const offsetY = (p.h - imgH) / 2;
    slide.addImage({
      data: captured.data,
      x: p.x + offsetX,
      y: p.y + offsetY,
      w: imgW,
      h: imgH,
    });
  } catch (err) {
    console.error(`[pptx-report] failed to capture ${prefix}-${i}:`, err);
    slide.addText("（画像化失敗）", {
      x: p.x, y: p.y + p.h / 2, w: p.w, h: 0.4,
      fontSize: 12, color: COLORS.warning, fontFace: FONT_FACE, align: "center",
    });
  }
}

// =====================================================
// Slide 5/6: Advice
// =====================================================

interface AdviceSlideProps {
  title: string;
  bullets: string[];
  /** bullets抽出失敗時のフォールバック用フルテキスト */
  fullText: string | null;
  accent: string;
}

function addAdviceSlide(pptx: Pptx, p: AdviceSlideProps): void {
  const slide = pptx.addSlide();
  addSlideTitle(slide, p.title, p.accent);

  // 1. アドバイス全体が無い → 未生成メッセージ
  if (!p.fullText || p.fullText.trim() === "") {
    slide.addText(
      "※ AIアドバイスがまだ生成されていません。各タブで「AIアドバイス生成」を実行してください。",
      {
        x: 0.5, y: 3, w: SLIDE_W - 1, h: 0.5,
        fontSize: 16, color: COLORS.subtext, fontFace: FONT_FACE, align: "center",
      },
    );
    return;
  }

  // 2. 改善アクションのbullet抽出に成功 → bullet表示
  if (p.bullets.length > 0) {
    const items = p.bullets.map((b) => ({
      text: b,
      options: {
        bullet: { type: "bullet" as const },
        fontSize: 18,
        color: COLORS.text,
        fontFace: FONT_FACE,
        paraSpaceAfter: 12,
      },
    }));
    slide.addText(items, {
      x: 1.0, y: 1.0, w: SLIDE_W - 2, h: SLIDE_H - 2.0,
      valign: "top",
    });
    return;
  }

  // 3. bullet抽出失敗 → アドバイス全体を簡易整形してテキスト表示（フォールバック）
  const cleanText = p.fullText
    .replace(/\*\*([^*]+)\*\*/g, "$1") // 太字記号除去
    .replace(/^## /gm, "")              // 見出し記号除去
    .trim();
  slide.addText(cleanText, {
    x: 0.6, y: 1.0, w: SLIDE_W - 1.2, h: SLIDE_H - 1.8,
    fontSize: 11, color: COLORS.text, fontFace: FONT_FACE,
    valign: "top", paraSpaceAfter: 4,
    autoFit: true,
  });
}

// =====================================================
// Slide 7: Top actions
// =====================================================

function addTopActionsSlide(pptx: Pptx, args: GenerateArgs): void {
  const slide = pptx.addSlide();
  addSlideTitle(slide, "改善アクション TOP3", COLORS.warning);

  const pl = extractActionBullets(args.plAdviceText ?? "", 4);
  const bs = extractActionBullets(args.bsAdviceText ?? "", 4);
  const merged = interleave(pl, bs).slice(0, 3);

  if (merged.length === 0) {
    slide.addText(
      "※ AIアドバイスがまだ生成されていません。",
      {
        x: 0.5, y: 3, w: SLIDE_W - 1, h: 0.5,
        fontSize: 16, color: COLORS.subtext, fontFace: FONT_FACE, align: "center",
      },
    );
    return;
  }

  const cardW = SLIDE_W - 2;
  const cardH = 1.4;
  const startY = 1.5;
  const gap = 0.25;

  merged.forEach((b, i) => {
    const y = startY + i * (cardH + gap);
    slide.addShape("roundRect", {
      x: 1.0, y, w: cardW, h: cardH,
      fill: { color: "FFFBEB" },
      line: { color: "F59E0B", width: 2 },
      rectRadius: 0.1,
    });
    slide.addText(`#${i + 1}`, {
      x: 1.2, y: y + 0.1, w: 0.8, h: 0.6,
      fontSize: 24, bold: true, color: "B45309", fontFace: FONT_FACE,
    });
    slide.addText(b, {
      x: 2.1, y: y + 0.1, w: cardW - 1.2, h: cardH - 0.2,
      fontSize: 16, color: COLORS.text, fontFace: FONT_FACE, valign: "middle",
    });
  });
}

function interleave<T>(a: T[], b: T[]): T[] {
  const out: T[] = [];
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) {
    if (i < a.length) { out.push(a[i]); }
    if (i < b.length) { out.push(b[i]); }
  }
  return out;
}

// =====================================================
// Helpers
// =====================================================

function addSlideTitle(slide: Slide, title: string, accent: string = COLORS.primary): void {
  slide.addShape("rect", {
    x: 0,
    y: 0,
    w: SLIDE_W,
    h: 0.6,
    fill: { color: accent },
    line: { color: accent },
  });
  slide.addText(title, {
    x: 0.5,
    y: 0.05,
    w: SLIDE_W - 1,
    h: 0.5,
    fontSize: 22,
    bold: true,
    color: "FFFFFF",
    fontFace: FONT_FACE,
    valign: "middle",
  });
}
