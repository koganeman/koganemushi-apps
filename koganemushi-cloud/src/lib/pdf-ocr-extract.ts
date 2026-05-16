/**
 * 画像のみ PDF（テキスト層を持たないスキャン PDF 等）から、各ページを Canvas に描画して
 * tesseract.js で日本語 OCR を実行し、テキスト行配列を返す。
 *
 * 出力は `extractTextLinesFromPdf` と同じ `string[]` 形式で、後段の
 * `parsePLFromPdfLines` / `parseBSFromPdfLines` にそのまま渡せる。
 */

import { createWorker, OEM, type LoggerMessage } from "tesseract.js";

const PDF_WORKER_PATH = "/pdf.worker.min.mjs";
const OCR_RENDER_SCALE = 2.0;

export type OcrPhase =
  | "loading-lang"
  | "rendering"
  | "recognizing"
  | "done";

export interface OcrProgress {
  phase: OcrPhase;
  /** 1-indexed。OCR 開始前（言語データ読込中等）は 0 */
  page: number;
  totalPages: number;
  /** 0..1。phase 内の相対進捗（recognizing 中は Tesseract logger の progress を反映） */
  progress: number;
}

export async function extractTextLinesFromImagePdf(
  file: File,
  onProgress?: (p: OcrProgress) => void,
): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist");
  const opts = pdfjs.GlobalWorkerOptions as { workerSrc: string };
  if (!opts.workerSrc) {
    opts.workerSrc = PDF_WORKER_PATH;
  }
  const buf = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data: buf, useSystemFonts: true }).promise;
  const totalPages = doc.numPages;

  onProgress?.({ phase: "loading-lang", page: 0, totalPages, progress: 0 });

  let currentPage = 0;
  const worker = await createWorker("jpn", OEM.LSTM_ONLY, {
    logger: (m: LoggerMessage) => {
      if (m.status === "recognizing text" && currentPage > 0) {
        onProgress?.({
          phase: "recognizing",
          page: currentPage,
          totalPages,
          progress: m.progress,
        });
      }
    },
  });

  try {
    const allLines: string[] = [];
    for (let i = 1; i <= totalPages; i++) {
      currentPage = i;
      onProgress?.({ phase: "rendering", page: i, totalPages, progress: 0 });
      const page = await doc.getPage(i);
      const text = await ocrSinglePage(page, worker);
      allLines.push(...splitTextIntoLines(text));
    }
    onProgress?.({ phase: "done", page: totalPages, totalPages, progress: 1 });
    return allLines;
  } finally {
    await worker.terminate();
  }
}

type PdfPage = Awaited<ReturnType<Awaited<ReturnType<typeof import("pdfjs-dist").getDocument>["promise"]>["getPage"]>>;
type TesseractWorker = Awaited<ReturnType<typeof createWorker>>;

async function ocrSinglePage(page: PdfPage, worker: TesseractWorker): Promise<string> {
  const viewport = page.getViewport({ scale: OCR_RENDER_SCALE });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D コンテキストを取得できませんでした");
  }
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  const result = await worker.recognize(canvas);
  // 描画用 Canvas のメモリを解放
  canvas.width = 0;
  canvas.height = 0;
  return result.data.text ?? "";
}

function splitTextIntoLines(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length > 0) { out.push(trimmed); }
  }
  return out;
}
