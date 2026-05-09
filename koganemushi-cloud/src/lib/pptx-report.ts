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
import type { AnalysisResult, IndicatorKey } from "@/types/financial-analysis";
import { INDICATOR_META } from "./financial-analysis-calc";
import {
  COLORS,
  FONT_FACE,
  captureElementToPng,
  deriveSpanLabels,
  extractActionBullets,
  extractSectionText,
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
  /** 直近3期の財務分析結果（左ほど最新）。空配列 or null=未入力 */
  analysisResults: AnalysisResult[];
  /** AI理想P/L の計算結果。null=未生成 */
  idealResult: BlockPuzzleResult | null;
  /** AI理想P/L の reasoning Markdown。null=未生成 */
  idealReasoning: string | null;
  /** key: "pl-0" / "bs-0" / "pl-ideal" 形式の data-pptx-export-id */
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
  addFinancialAnalysisSlide(pptx, args);
  addFormulaTableSlide(pptx);
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
  await addIdealPLSlide(pptx, args);

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
// Slide: 財務分析（ローカルベンチマーク）
// =====================================================

function addFinancialAnalysisSlide(pptx: Pptx, args: GenerateArgs): void {
  const slide = pptx.addSlide();
  addSlideTitle(slide, "財務分析（経済産業省ローカルベンチマーク準拠）", COLORS.accent);

  const recent = args.analysisResults.slice(0, 3);

  if (recent.length === 0) {
    slide.addText(
      "※ 財務分析タブで業種・従業員数・B/S詳細を入力すると、ここに6指標の評価が表示されます。",
      {
        x: 0.5, y: 3.2, w: SLIDE_W - 1, h: 0.5,
        fontSize: 16, color: COLORS.subtext, fontFace: FONT_FACE, align: "center",
      },
    );
    return;
  }

  renderFAGradeStrip(slide, recent);
  renderFAIndicatorTable(slide, recent);
}

interface GradeCellArgs {
  slide: Slide;
  r: AnalysisResult;
  x: number;
  y: number;
  w: number;
  h: number;
  isLatest: boolean;
}

function renderFAGradeStrip(slide: Slide, recent: AnalysisResult[]): void {
  const cellW = 3.0;
  const cellH = 1.2;
  const startY = 0.9;
  const startX = (SLIDE_W - cellW * 3 - 0.3 * 2) / 2;
  recent.forEach((r, i) => {
    renderFAGradeCell({
      slide,
      r,
      x: startX + i * (cellW + 0.3),
      y: startY,
      w: cellW,
      h: cellH,
      isLatest: i === 0,
    });
  });
}

function gradeCellLineColor(isLatest: boolean): string {
  return isLatest ? "60A5FA" : "D1D5DB";
}

function renderFAGradeCell(a: GradeCellArgs): void {
  const { slide, r, x, y, w, h, isLatest } = a;
  slide.addShape("roundRect", {
    x, y, w, h,
    fill: { color: isLatest ? "EFF6FF" : "FFFFFF" },
    line: { color: gradeCellLineColor(isLatest), width: isLatest ? 2 : 1 },
    rectRadius: 0.08,
  });
  const labelPrefix = isLatest ? "★最新期 " : "";
  slide.addText(`${labelPrefix}${r.periodLabel || "-"}`, {
    x: x + 0.15, y: y + 0.08, w: w - 0.3, h: 0.35,
    fontSize: 11, color: isLatest ? "1D4ED8" : COLORS.subtext, fontFace: FONT_FACE,
  });
  slide.addText(r.grade ?? "-", {
    x: x + 0.2, y: y + 0.45, w: 0.8, h: 0.7,
    fontSize: 36, bold: true, color: gradeBadgeColor(r.grade), fontFace: FONT_FACE, align: "center",
  });
  const scoreText = r.totalScore !== null ? `${r.totalScore} / 30 点` : "計算不可";
  slide.addText(scoreText, {
    x: x + 1.05, y: y + 0.55, w: w - 1.2, h: 0.5,
    fontSize: 16, bold: true, color: COLORS.text, fontFace: FONT_FACE, valign: "middle",
  });
}

function gradeBadgeColor(g: AnalysisResult["grade"]): string {
  if (g === "A") { return "059669"; }
  if (g === "B") { return "1D4ED8"; }
  if (g === "C") { return "D97706"; }
  if (g === "D") { return "DC2626"; }
  return "9CA3AF";
}

interface CellSpec {
  text: string;
  align: "left" | "center" | "right";
}

interface TableLayout {
  tableX: number;
  tableY: number;
  tableW: number;
  colW: number[];
  headerH: number;
  rowH: number;
}

function buildFATableLayout(): TableLayout {
  const tableX = 0.4;
  const tableY = 2.4;
  const tableW = SLIDE_W - 0.8;
  const colWidths = [3.6, 0.9, 0.7, 1.4, 1.4, 1.4, 1.4];
  const totalCol = colWidths.reduce((a, b) => a + b, 0);
  const scale = tableW / totalCol;
  return {
    tableX, tableY, tableW,
    colW: colWidths.map((w) => w * scale),
    headerH: 0.4,
    rowH: 0.6,
  };
}

function pickPeriodLabel(recent: AnalysisResult[], i: number, fallback: string): string {
  return recent[i]?.periodLabel || fallback;
}

function buildHeaderLabels(recent: AnalysisResult[]): string[] {
  return [
    "指標 / 分類",
    "",
    "単位",
    pickPeriodLabel(recent, 0, "最新期"),
    pickPeriodLabel(recent, 1, "前期"),
    pickPeriodLabel(recent, 2, "前々期"),
    "業界中央値",
  ];
}

function headerAlign(c: number): "left" | "center" {
  return c >= 3 ? "center" : "left";
}

function renderFATableHeader(slide: Slide, layout: TableLayout, recent: AnalysisResult[]): void {
  const labels = buildHeaderLabels(recent);
  let xCur = layout.tableX;
  for (let c = 0; c < layout.colW.length; c++) {
    slide.addShape("rect", {
      x: xCur, y: layout.tableY, w: layout.colW[c], h: layout.headerH,
      fill: { color: "F3F4F6" }, line: { color: "D1D5DB" },
    });
    slide.addText(labels[c], {
      x: xCur + 0.05, y: layout.tableY, w: layout.colW[c] - 0.1, h: layout.headerH,
      fontSize: 10, bold: true, color: COLORS.text, fontFace: FONT_FACE,
      valign: "middle", align: headerAlign(c),
    });
    xCur += layout.colW[c];
  }
}

function buildFADataRow(meta: typeof INDICATOR_META[number], recent: AnalysisResult[]): CellSpec[] {
  return [
    { text: meta.label, align: "left" },
    { text: meta.category, align: "center" },
    { text: meta.unit, align: "center" },
    { text: cellTextFor(recent[0], meta.key, meta.format), align: "right" },
    { text: cellTextFor(recent[1], meta.key, meta.format), align: "right" },
    { text: cellTextFor(recent[2], meta.key, meta.format), align: "right" },
    { text: medianTextFor(recent[0], meta.key, meta.format), align: "right" },
  ];
}

function renderFATableRow(
  slide: Slide,
  layout: TableLayout,
  cells: CellSpec[],
  rowIdx: number,
): void {
  const y = layout.tableY + layout.headerH + rowIdx * layout.rowH;
  let xCur = layout.tableX;
  const fillColor = rowIdx % 2 === 0 ? "FFFFFF" : "F9FAFB";
  for (let c = 0; c < cells.length; c++) {
    slide.addShape("rect", {
      x: xCur, y, w: layout.colW[c], h: layout.rowH,
      fill: { color: fillColor }, line: { color: "E5E7EB" },
    });
    slide.addText(cells[c].text, {
      x: xCur + 0.05, y: y + 0.02, w: layout.colW[c] - 0.1, h: layout.rowH - 0.04,
      fontSize: 10, color: COLORS.text, fontFace: FONT_FACE,
      valign: "middle", align: cells[c].align,
    });
    xCur += layout.colW[c];
  }
}

function renderFAIndicatorTable(slide: Slide, recent: AnalysisResult[]): void {
  const layout = buildFATableLayout();
  renderFATableHeader(slide, layout, recent);
  INDICATOR_META.forEach((meta, rowIdx) => {
    renderFATableRow(slide, layout, buildFADataRow(meta, recent), rowIdx);
  });
  const footerY = layout.tableY + layout.headerH + INDICATOR_META.length * layout.rowH + 0.2;
  slide.addText(
    "※ 各セルは「値（スコア/5）」を表示。スコア5=最良、1=最悪。中堅企業（中小企業基本法上限超）はベンチマーク非対応のためスコア欄が空欄になります。",
    {
      x: layout.tableX, y: footerY, w: layout.tableW, h: 0.4,
      fontSize: 9, color: COLORS.subtext, fontFace: FONT_FACE,
    },
  );
}

function cellTextFor(
  r: AnalysisResult | undefined,
  key: IndicatorKey,
  format: (v: number) => string,
): string {
  if (!r) { return "-"; }
  const ind = r[key];
  if (ind.value === null) { return "-"; }
  const valueStr = format(ind.value);
  if (ind.score === null) { return valueStr; }
  return `${valueStr}（${ind.score}/5）`;
}

function medianTextFor(
  r: AnalysisResult | undefined,
  key: IndicatorKey,
  format: (v: number) => string,
): string {
  if (!r) { return "-"; }
  const med = r[key].benchMedian;
  return med === null ? "-" : format(med);
}

// =====================================================
// Slide: 指標の意味（算式）
// =====================================================

function addFormulaTableSlide(pptx: Pptx): void {
  const slide = pptx.addSlide();
  addSlideTitle(slide, "指標の意味（算式）", COLORS.accent);
  slide.addText("経済産業省「ローカルベンチマーク」の指標定義に準拠", {
    x: 0.5, y: 0.85, w: SLIDE_W - 1, h: 0.3,
    fontSize: 12, color: COLORS.subtext, fontFace: FONT_FACE,
  });

  // テーブル: 指標 | 分類 | 単位 | 算式
  const tableX = 0.4;
  const tableY = 1.4;
  const tableW = SLIDE_W - 0.8;
  const colWidthsRatio = [3.0, 1.4, 0.8, 7.3]; // 比率
  const total = colWidthsRatio.reduce((a, b) => a + b, 0);
  const colW = colWidthsRatio.map((w) => (w / total) * tableW);
  const headerH = 0.45;
  const rowH = 0.85;

  renderFormulaHeader(slide, { x: tableX, y: tableY, colW, h: headerH });
  INDICATOR_META.forEach((meta, i) => {
    renderFormulaRow(slide, {
      x: tableX,
      y: tableY + headerH + i * rowH,
      colW,
      rowH,
      rowIdx: i,
      meta,
    });
  });
}

interface FormulaHeaderArgs {
  x: number;
  y: number;
  colW: number[];
  h: number;
}

function renderFormulaHeader(slide: Slide, a: FormulaHeaderArgs): void {
  const labels = ["指標", "分類", "単位", "算式"];
  let cur = a.x;
  for (let c = 0; c < a.colW.length; c++) {
    slide.addShape("rect", {
      x: cur, y: a.y, w: a.colW[c], h: a.h,
      fill: { color: "F3F4F6" }, line: { color: "D1D5DB" },
    });
    slide.addText(labels[c], {
      x: cur + 0.1, y: a.y, w: a.colW[c] - 0.2, h: a.h,
      fontSize: 12, bold: true, color: COLORS.text, fontFace: FONT_FACE,
      valign: "middle", align: c === 2 ? "center" : "left",
    });
    cur += a.colW[c];
  }
}

interface FormulaRowArgs {
  x: number;
  y: number;
  colW: number[];
  rowH: number;
  rowIdx: number;
  meta: typeof INDICATOR_META[number];
}

function renderFormulaRow(slide: Slide, a: FormulaRowArgs): void {
  const { x, y, colW, rowH, rowIdx, meta } = a;
  const fillColor = rowIdx % 2 === 0 ? "FFFFFF" : "F9FAFB";
  const cells: { text: string; align: "left" | "center"; bold?: boolean }[] = [
    { text: meta.label, align: "left", bold: true },
    { text: meta.category, align: "left" },
    { text: meta.unit, align: "center" },
    { text: meta.formula, align: "left" },
  ];
  let cur = x;
  for (let c = 0; c < cells.length; c++) {
    slide.addShape("rect", {
      x: cur, y, w: colW[c], h: rowH,
      fill: { color: fillColor }, line: { color: "E5E7EB" },
    });
    slide.addText(cells[c].text, {
      x: cur + 0.1, y: y + 0.05, w: colW[c] - 0.2, h: rowH - 0.1,
      fontSize: c === 3 ? 10 : 11,
      bold: cells[c].bold ?? false,
      color: COLORS.text, fontFace: FONT_FACE,
      valign: "middle", align: cells[c].align,
    });
    cur += colW[c];
  }
}

// =====================================================
// Slide: AI理想P/L（最終ページ）
// =====================================================

async function addIdealPLSlide(pptx: Pptx, args: GenerateArgs): Promise<void> {
  const slide = pptx.addSlide();
  addSlideTitle(slide, "AIが提案する理想のP/L", COLORS.accent);

  if (!args.idealResult || !args.idealReasoning) {
    slide.addText(
      "※ P/Lタブの「AI理想P/L」を生成すると、ここに理想P/Lのブロックパズル図と全体方針・主要KPI・改善アクションが表示されます。",
      {
        x: 0.5, y: 3.2, w: SLIDE_W - 1, h: 0.5,
        fontSize: 16, color: COLORS.subtext, fontFace: FONT_FACE, align: "center",
      },
    );
    return;
  }

  await renderIdealPuzzleImage(slide, args);
  renderIdealReasoningSections(slide, args.idealReasoning);
}

async function renderIdealPuzzleImage(slide: Slide, args: GenerateArgs): Promise<void> {
  // 左半分（最大5.0インチ幅）にブロックパズル画像
  const imgArea = { x: 0.4, y: 1.0, w: 5.0, h: 6.0 };
  slide.addText(`理想期: ${args.idealResult?.periodLabel || "-"}`, {
    x: imgArea.x, y: imgArea.y, w: imgArea.w, h: 0.35,
    fontSize: 12, bold: true, color: COLORS.accent, fontFace: FONT_FACE, align: "center",
  });
  const el = args.diagramElements.get("pl-ideal");
  if (!el) {
    slide.addShape("rect", {
      x: imgArea.x, y: imgArea.y + 0.4, w: imgArea.w, h: imgArea.h - 0.4,
      fill: { color: "F3F4F6" }, line: { color: "D1D5DB" },
    });
    slide.addText("（理想P/L図のキャプチャに失敗）", {
      x: imgArea.x, y: imgArea.y + 3, w: imgArea.w, h: 0.4,
      fontSize: 11, color: COLORS.subtext, fontFace: FONT_FACE, align: "center",
    });
    return;
  }
  try {
    const captured = await captureElementToPng(el);
    const cellW = imgArea.w;
    const cellH = imgArea.h - 0.4;
    const cellAspect = cellW / cellH;
    let imgW = cellW;
    let imgH = cellH;
    if (captured.aspectRatio > cellAspect) {
      imgH = cellW / captured.aspectRatio;
    } else {
      imgW = cellH * captured.aspectRatio;
    }
    const offX = (cellW - imgW) / 2;
    const offY = (cellH - imgH) / 2;
    slide.addImage({
      data: captured.data,
      x: imgArea.x + offX,
      y: imgArea.y + 0.4 + offY,
      w: imgW,
      h: imgH,
    });
  } catch (err) {
    console.error("[pptx-report] failed to capture pl-ideal:", err);
  }
}

function renderIdealReasoningSections(slide: Slide, reasoning: string): void {
  // 右半分にreasoningの3セクションを縦並び
  const startX = 5.6;
  const width = SLIDE_W - 5.6 - 0.4;
  const sectionH = 1.8;
  const gap = 0.15;
  const startY = 1.0;

  const sections: { title: string; body: string }[] = [
    {
      title: "🎯 全体方針",
      body: extractSectionText(reasoning, /全体方針|方針|戦略/) || "（情報なし）",
    },
    {
      title: "📊 主要KPIの根拠",
      body: extractSectionText(reasoning, /主要KPI|KPI|根拠/) || "（情報なし）",
    },
    {
      title: "✅ 達成のためのアクション",
      body: formatActionList(extractActionBullets(reasoning, 5)),
    },
  ];

  sections.forEach((sec, i) => {
    renderReasoningBlock({
      slide,
      title: sec.title,
      body: sec.body,
      x: startX,
      y: startY + i * (sectionH + gap),
      w: width,
      h: sectionH,
    });
  });
}

function formatActionList(bullets: string[]): string {
  if (bullets.length === 0) { return "（情報なし）"; }
  return bullets.map((b, i) => `${i + 1}. ${b}`).join("\n");
}

interface ReasoningBlockArgs {
  slide: Slide;
  title: string;
  body: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

function renderReasoningBlock(a: ReasoningBlockArgs): void {
  const { slide, title, body, x, y, w, h } = a;
  slide.addShape("roundRect", {
    x, y, w, h,
    fill: { color: "FAF5FF" },
    line: { color: "C084FC", width: 1 },
    rectRadius: 0.06,
  });
  slide.addText(title, {
    x: x + 0.15, y: y + 0.08, w: w - 0.3, h: 0.4,
    fontSize: 13, bold: true, color: "7C3AED", fontFace: FONT_FACE,
  });
  slide.addText(body, {
    x: x + 0.15, y: y + 0.5, w: w - 0.3, h: h - 0.6,
    fontSize: 10, color: COLORS.text, fontFace: FONT_FACE,
    valign: "top", paraSpaceAfter: 2,
    autoFit: true,
  });
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
