"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { PdfImportDialog } from "./pdf-import-dialog";
import {
  extractTextLinesFromPdf,
  parsePLFromPdfLines,
  type ExtractedPLData,
} from "@/lib/pdf-pl-extract";
import {
  parseBSFromPdfLines,
  type ExtractedBSData,
} from "@/lib/pdf-bs-extract";
import {
  extractTextLinesFromImagePdf,
  type OcrProgress,
} from "@/lib/pdf-ocr-extract";
import type { PLPeriodInput } from "@/types/block-puzzle";
import type { BSPeriodInput } from "@/types/balance-sheet";

export interface ExtractedCombined {
  pl: ExtractedPLData;
  bs: ExtractedBSData;
  viaOcr: boolean;
}

/** overwrite: 指定列に上書き / shift: 過去期を1つ右にシフトし最新期に挿入 */
export type PdfApplyMode = "overwrite" | "shift";

type Props =
  | {
      applyMode?: "overwrite";
      buttonLabel?: string;
      buttonSize?: "xs" | "sm";
      columnIndex: number;
      onApplyPL: (index: number, next: PLPeriodInput) => void;
      onApplyBS: (index: number, next: BSPeriodInput) => void;
    }
  | {
      applyMode: "shift";
      buttonLabel?: string;
      buttonSize?: "xs" | "sm";
      onShiftPL: (next: PLPeriodInput) => void;
      onShiftBS: (next: BSPeriodInput) => void;
    };

function resolveMode(props: Props): PdfApplyMode {
  return props.applyMode === "shift" ? "shift" : "overwrite";
}

function resolveButtonSize(props: Props, mode: PdfApplyMode): "xs" | "sm" {
  if (props.buttonSize) { return props.buttonSize; }
  return mode === "shift" ? "sm" : "xs";
}

function resolveButtonLabel(props: Props, mode: PdfApplyMode): string {
  if (props.buttonLabel) { return props.buttonLabel; }
  return mode === "shift" ? "新年度PDF取込" : "PDF読込";
}

function makeApplyHandler(props: Props, clear: () => void) {
  return ({ plInput, bsInput }: { plInput: PLPeriodInput; bsInput: BSPeriodInput }) => {
    if (props.applyMode === "shift") {
      props.onShiftPL(plInput);
      props.onShiftBS(bsInput);
    } else {
      props.onApplyPL(props.columnIndex, plInput);
      props.onApplyBS(props.columnIndex, bsInput);
    }
    clear();
  };
}

function progressLabel(p: OcrProgress): string {
  switch (p.phase) {
    case "loading-lang":
      return "OCR言語データ準備中...";
    case "rendering":
      return `OCR描画中 (${p.page}/${p.totalPages})`;
    case "recognizing":
      return `OCR認識中 (${p.page}/${p.totalPages}) ${Math.round(p.progress * 100)}%`;
    case "done":
      return "OCR完了";
  }
}

function computeButtonText(
  loading: boolean,
  ocrProgress: OcrProgress | null,
  buttonLabel: string,
): string {
  if (!loading) { return buttonLabel; }
  if (ocrProgress) { return progressLabel(ocrProgress); }
  return "読込中...";
}

export function PdfImportButton(props: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [extracted, setExtracted] = useState<ExtractedCombined | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageOnlyFile, setImageOnlyFile] = useState<File | null>(null);
  const [ocrProgress, setOcrProgress] = useState<OcrProgress | null>(null);

  const mode = resolveMode(props);
  const buttonSize = resolveButtonSize(props, mode);
  const buttonLabel = resolveButtonLabel(props, mode);

  const onPick = () => inputRef.current?.click();

  const runParsersAndShow = (lines: string[], viaOcr: boolean) => {
    setExtracted({
      pl: parsePLFromPdfLines(lines),
      bs: parseBSFromPdfLines(lines),
      viaOcr,
    });
  };

  const handleExtractedLines = (lines: string[], viaOcr: boolean, file?: File) => {
    if (lines.length === 0 && file && !viaOcr) {
      setImageOnlyFile(file);
      return;
    }
    runParsersAndShow(lines, viaOcr);
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) { return; }
    setLoading(true);
    setError(null);
    setImageOnlyFile(null);
    try {
      const lines = await extractTextLinesFromPdf(file);
      handleExtractedLines(lines, false, file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF読込エラー");
    } finally {
      setLoading(false);
    }
  };

  const runOcr = async () => {
    if (!imageOnlyFile) { return; }
    const file = imageOnlyFile;
    setImageOnlyFile(null);
    setLoading(true);
    setError(null);
    setOcrProgress({ phase: "loading-lang", page: 0, totalPages: 0, progress: 0 });
    try {
      const lines = await extractTextLinesFromImagePdf(file, (p) => setOcrProgress(p));
      handleExtractedLines(lines, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "OCR取込エラー");
    } finally {
      setLoading(false);
      setOcrProgress(null);
    }
  };

  const handleApply = makeApplyHandler(props, () => setExtracted(null));

  const buttonText = computeButtonText(loading, ocrProgress, buttonLabel);

  return (
    <>
      <Button size={buttonSize} variant="outline" onClick={onPick} disabled={loading}>
        {buttonText}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={onFile}
      />
      {error && (
        <div className="text-[10px] text-red-600 max-w-[140px]">{error}</div>
      )}
      {imageOnlyFile && !loading && (
        <ImageOnlyPdfPrompt
          fileName={imageOnlyFile.name}
          onCancel={() => setImageOnlyFile(null)}
          onConfirm={runOcr}
        />
      )}
      {extracted && (
        <PdfImportDialog
          open={!!extracted}
          extracted={extracted}
          mode={mode}
          viaOcr={extracted.viaOcr}
          onCancel={() => setExtracted(null)}
          onApply={handleApply}
        />
      )}
    </>
  );
}

interface ImageOnlyPdfPromptProps {
  fileName: string;
  onCancel: () => void;
  onConfirm: () => void;
}

function ImageOnlyPdfPrompt({ fileName, onCancel, onConfirm }: ImageOnlyPdfPromptProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-5 space-y-3 text-sm">
        <h3 className="font-bold text-base">画像のみのPDFを検出しました</h3>
        <p>
          <span className="font-mono text-xs break-all">{fileName}</span>
          {" "}にはテキスト情報が含まれていません（スキャン画像のみのPDFです）。
        </p>
        <p>
          OCR（光学文字認識）で文字を読み取って取り込みますか？
          <br />
          <span className="text-amber-700">
            ※ 初回は日本語学習データ（約 10 MB）のダウンロードが発生します。
            <br />※ 数十秒〜数分かかる場合があります。誤認識の可能性があるため、結果は必ず確認してください。
          </span>
        </p>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onCancel}>
            キャンセル
          </Button>
          <Button onClick={onConfirm}>OCRで取り込む</Button>
        </div>
      </div>
    </div>
  );
}
