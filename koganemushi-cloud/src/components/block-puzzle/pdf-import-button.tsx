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

interface Props {
  columnIndex: number;
  /** P/L入力を該当列に適用 */
  onApplyPL: (index: number, next: PLPeriodInput) => void;
  /** B/S入力を該当列に適用 */
  onApplyBS: (index: number, next: BSPeriodInput) => void;
}

export interface ExtractedCombined {
  pl: ExtractedPLData;
  bs: ExtractedBSData;
}

export function PdfImportButton({ columnIndex, onApplyPL, onApplyBS }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [extracted, setExtracted] = useState<ExtractedCombined | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onPick = () => inputRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) { return; }
    setLoading(true);
    setError(null);
    try {
      const lines = await extractTextLinesFromPdf(file);
      const pl = parsePLFromPdfLines(lines);
      const bs = parseBSFromPdfLines(lines);
      setExtracted({ pl, bs });
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF読込エラー");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button size="xs" variant="outline" onClick={onPick} disabled={loading}>
        {loading ? "読込中..." : "PDF読込"}
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
          onCancel={() => setExtracted(null)}
          onApply={({ plInput, bsInput }) => {
            onApplyPL(columnIndex, plInput);
            onApplyBS(columnIndex, bsInput);
            setExtracted(null);
          }}
        />
      )}
    </>
  );
}
