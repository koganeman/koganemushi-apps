"use client";

import { useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { PLInputTable } from "@/components/block-puzzle/pl-input-table";
import { BlockPuzzleDiagram } from "@/components/block-puzzle/block-puzzle-diagram";
import { AdvicePanel } from "@/components/block-puzzle/advice-panel";
import {
  calcBlockPuzzle,
  createSamplePLPeriods,
} from "@/lib/block-puzzle-calc";
import { unitLabel } from "@/components/block-puzzle/format-helpers";
import {
  useBlockPuzzleStore,
  type BlockPuzzleExportData,
} from "@/stores/block-puzzle-store";
import { useShallow } from "zustand/react/shallow";

function timestampForFilename(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export default function BlockPuzzlePage() {
  const {
    periods,
    unit,
    showCashSection,
    updateField,
    applyPdfToColumn,
    setUnit,
    setShowCashSection,
    setPeriods,
    resetPeriods,
    loadFromJson,
  } = useBlockPuzzleStore(
    useShallow((s) => ({
      periods: s.periods,
      unit: s.unit,
      showCashSection: s.showCashSection,
      updateField: s.updateField,
      applyPdfToColumn: s.applyPdfToColumn,
      setUnit: s.setUnit,
      setShowCashSection: s.setShowCashSection,
      setPeriods: s.setPeriods,
      resetPeriods: s.resetPeriods,
      loadFromJson: s.loadFromJson,
    }))
  );

  const results = useMemo(
    () => periods.map((p) => calcBlockPuzzle(p)),
    [periods]
  );

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLoadSample = () => {
    setPeriods(createSamplePLPeriods());
  };

  const handleExport = () => {
    const state = useBlockPuzzleStore.getState();
    const data: BlockPuzzleExportData = {
      version: 1,
      periods: state.periods,
      unit: state.unit,
      showCashSection: state.showCashSection,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `block-puzzle_${timestampForFilename()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handlePrint = () => {
    window.print();
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) { return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = String(ev.target?.result ?? "");
        const data = JSON.parse(text) as BlockPuzzleExportData;
        if (typeof data !== "object" || data === null || !Array.isArray(data.periods)) {
          alert("JSONの形式が不正です。periods配列が必要です。");
          return;
        }
        loadFromJson(data);
        alert("インポートしました。");
      } catch (err) {
        alert(`インポートに失敗しました: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        if (fileInputRef.current) { fileInputRef.current.value = ""; }
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-gray-50 bp-printable">
      <main className="max-w-[1800px] mx-auto p-4 space-y-6">
        <header className="space-y-1">
          <h1 className="text-xl font-bold">お金のブロックパズル</h1>
          <p className="text-sm text-gray-600 bp-print-hide">
            損益計算書から「お金の流れ」を視覚的に把握するためのツールです。
            西順一郎先生のSTRAC図表をもとに和仁達也先生が改良した図解。
          </p>
          {/* 印刷時のみ表示するメタ情報 */}
          <p className="bp-print-only text-xs text-gray-600">
            出力日時: {new Date().toLocaleString("ja-JP")}
          </p>
        </header>

        {/* 操作パネル */}
        <div className="flex flex-wrap items-center gap-3 bg-white border rounded-lg p-3 bp-print-hide">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-700">表示単位</span>
            <label className="flex items-center gap-1">
              <input
                type="radio"
                checked={unit === "yen"}
                onChange={() => setUnit("yen")}
              />
              円単位
            </label>
            <label className="flex items-center gap-1">
              <input
                type="radio"
                checked={unit === "thousand"}
                onChange={() => setUnit("thousand")}
              />
              千円単位
            </label>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={showCashSection}
                onChange={(e) => setShowCashSection(e.target.checked)}
              />
              キャッシュ欄を表示
            </label>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handlePrint}
              title="ブロックパズルとAIアドバイスをPDF/印刷します（ブラウザの印刷ダイアログから「PDFとして保存」を選択）"
            >
              PDF出力
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleImportClick}
              title="JSONファイルから入力データを読み込みます"
            >
              インポート
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExport}
              title="現在の入力データをJSONファイルに保存します"
            >
              エクスポート
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleImportFile}
              className="hidden"
            />
            <Button size="sm" variant="outline" onClick={handleLoadSample}>
              サンプル読込
            </Button>
            <Button size="sm" variant="outline" onClick={resetPeriods}>
              クリア
            </Button>
          </div>
        </div>

        {/* P/L入力（印刷時は非表示） */}
        <section className="bp-print-hide">
          <h2 className="text-base font-bold mb-2">
            <span className="inline-block w-3 h-3 bg-black rounded-full mr-1" />
            P/L入力（円単位で入力）
          </h2>
          <PLInputTable periods={periods} onChange={updateField} onApplyPdf={applyPdfToColumn} />
          <p className="text-xs text-gray-500 mt-1">
            ※ 入力値はブラウザに自動保存されます（次回開いた時も保持）。各列ヘッダーの「PDF読込」で確定申告書PDFから自動抽出できます。
            「販売管理費計（人件費以外）」は販管費 − 人件費 + 営業外費用 − 営業外収益 + 特別損失 − 特別利益（PDF読込時に自動計算）。
          </p>
        </section>

        {/* ブロックパズル可視化 */}
        <section>
          <h2 className="text-base font-bold mb-2">
            <span className="inline-block w-3 h-3 bg-black rounded-full mr-1" />
            ブロックパズル（{unitLabel(unit)}単位）
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {results.map((r, i) => (
              <div key={i} className="bp-diagram">
                <BlockPuzzleDiagram
                  result={r}
                  unit={unit}
                  showCashSection={showCashSection}
                />
              </div>
            ))}
          </div>
        </section>

        {/* AIアドバイス */}
        <section>
          <AdvicePanel results={results} />
        </section>
      </main>
    </div>
  );
}
