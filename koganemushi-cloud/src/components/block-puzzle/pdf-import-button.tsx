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
import type { PLPeriodInput } from "@/types/block-puzzle";
import type { BSPeriodInput } from "@/types/balance-sheet";

export interface ExtractedCombined {
  pl: ExtractedPLData;
  bs: ExtractedBSData;
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

export function PdfImportButton(props: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [extracted, setExtracted] = useState<ExtractedCombined | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mode = resolveMode(props);
  const buttonSize = props.buttonSize ?? (mode === "shift" ? "sm" : "xs");
  const buttonLabel = props.buttonLabel ?? (mode === "shift" ? "新年度PDF取込" : "PDF読込");

  const onPick = () => inputRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) { return; }
    setLoading(true);
    setError(null);
    try {
      const lines = await extractTextLinesFromPdf(file);
      setExtracted({
        pl: parsePLFromPdfLines(lines),
        bs: parseBSFromPdfLines(lines),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF読込エラー");
    } finally {
      setLoading(false);
    }
  };

  const handleApply = makeApplyHandler(props, () => setExtracted(null));

  return (
    <>
      <Button size={buttonSize} variant="outline" onClick={onPick} disabled={loading}>
        {loading ? "読込中..." : buttonLabel}
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
      {extracted && (
        <PdfImportDialog
          open={!!extracted}
          extracted={extracted}
          mode={mode}
          onCancel={() => setExtracted(null)}
          onApply={handleApply}
        />
      )}
    </>
  );
}
