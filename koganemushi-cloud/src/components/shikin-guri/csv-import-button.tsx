"use client";

import { useRef, useState } from "react";
import { CsvPreviewDialog, type PreviewMode } from "./csv-preview-dialog";

interface Props {
  /** ボタンラベル */
  label: string;
  /** プレビューモード */
  mode: PreviewMode;
  /** title属性 */
  title?: string;
  /** ボタンスタイル */
  variant?: "primary" | "secondary";
}

export function CsvImportButton({ label, mode, title, variant = "primary" }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvText, setCsvText] = useState<string | null>(null);

  const handleClick = () => fileInputRef.current?.click();

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) { return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = String(ev.target?.result ?? "");
      setCsvText(text);
      if (fileInputRef.current) { fileInputRef.current.value = ""; }
    };
    reader.readAsText(file, "utf-8");
  };

  const styles =
    variant === "primary"
      ? "border-blue-500 text-blue-700 hover:bg-blue-50"
      : "border-gray-400 text-gray-700 hover:bg-gray-50";

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        title={title}
        className={`text-xs border rounded px-3 py-1 transition-colors ${styles}`}
      >
        {label}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        onChange={handleFile}
        className="hidden"
      />
      {csvText !== null && (
        <CsvPreviewDialog
          csvText={csvText}
          mode={mode}
          onClose={() => setCsvText(null)}
        />
      )}
    </>
  );
}
