"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { PdfImportDialog } from "./pdf-import-dialog";
import {
  extractTextLinesFromPdf,
  parsePLFromPdfLines,
  type ExtractedPLData,
} from "@/lib/pdf-pl-extract";
import type { PLPeriodInput } from "@/types/block-puzzle";

interface Props {
  columnIndex: number;
  onApply: (index: number, next: PLPeriodInput) => void;
}

export function PdfImportButton({ columnIndex, onApply }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [extracted, setExtracted] = useState<ExtractedPLData | null>(null);
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
      const data = parsePLFromPdfLines(lines);
      setExtracted(data);
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
          onApply={(next) => {
            onApply(columnIndex, next);
            setExtracted(null);
          }}
        />
      )}
    </>
  );
}
