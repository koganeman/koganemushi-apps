"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { PLInputTable } from "@/components/block-puzzle/pl-input-table";
import { BlockPuzzleDiagram } from "@/components/block-puzzle/block-puzzle-diagram";
import {
  calcBlockPuzzle,
  createSamplePLPeriods,
} from "@/lib/block-puzzle-calc";
import { unitLabel } from "@/components/block-puzzle/format-helpers";
import { useBlockPuzzleStore } from "@/stores/block-puzzle-store";
import { useShallow } from "zustand/react/shallow";

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
    }))
  );

  const results = useMemo(
    () => periods.map((p) => calcBlockPuzzle(p)),
    [periods]
  );

  const handleLoadSample = () => {
    setPeriods(createSamplePLPeriods());
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-[1800px] mx-auto p-4 space-y-6">
        <header className="space-y-1">
          <h1 className="text-xl font-bold">お金のブロックパズル</h1>
          <p className="text-sm text-gray-600">
            損益計算書から「お金の流れ」を視覚的に把握するためのツールです。
            西順一郎先生のSTRAC図表をもとに和仁達也先生が改良した図解。
          </p>
        </header>

        {/* 操作パネル */}
        <div className="flex flex-wrap items-center gap-3 bg-white border rounded-lg p-3">
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
            <Button size="sm" variant="outline" onClick={handleLoadSample}>
              サンプル読込
            </Button>
            <Button size="sm" variant="outline" onClick={resetPeriods}>
              クリア
            </Button>
          </div>
        </div>

        {/* P/L入力 */}
        <section>
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
              <BlockPuzzleDiagram
                key={i}
                result={r}
                unit={unit}
                showCashSection={showCashSection}
              />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
