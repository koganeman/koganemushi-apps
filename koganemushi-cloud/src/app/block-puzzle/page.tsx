"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ReportTabs, type ReportTabKey } from "@/components/block-puzzle/tabs";
import { PLTab } from "@/components/block-puzzle/pl-tab";
import { BSTab } from "@/components/block-puzzle/bs-tab";
import { IntegratedReportTab } from "@/components/block-puzzle/integrated-report-tab";
import { FinancialAnalysisTab } from "@/components/block-puzzle/financial-analysis-tab";
import { PdfImportButton } from "@/components/block-puzzle/pdf-import-button";
import {
  calcBlockPuzzle,
  createSamplePLPeriods,
} from "@/lib/block-puzzle-calc";
import {
  calcBalanceSheet,
  createSampleBSPeriods,
} from "@/lib/balance-sheet-calc";
import {
  useBlockPuzzleStore,
  type BlockPuzzleExportData,
} from "@/stores/block-puzzle-store";
import { useBalanceSheetStore } from "@/stores/balance-sheet-store";
import { useFinancialAnalysisStore } from "@/stores/financial-analysis-store";
import type { BalanceSheetExportData, BSPeriodInput } from "@/types/balance-sheet";
import type { PLPeriodInput } from "@/types/block-puzzle";

interface CombinedExportData {
  version: 2;
  pl: BlockPuzzleExportData;
  bs: BalanceSheetExportData;
}

function timestampForFilename(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function isCombinedExport(data: unknown): data is CombinedExportData {
  if (typeof data !== "object" || data === null) { return false; }
  const d = data as Record<string, unknown>;
  return d.version === 2 && typeof d.pl === "object" && typeof d.bs === "object";
}

function isLegacyPLExport(data: unknown): data is BlockPuzzleExportData {
  if (typeof data !== "object" || data === null) { return false; }
  const d = data as Record<string, unknown>;
  return Array.isArray(d.periods);
}

export default function BlockPuzzlePage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-gray-500">読み込み中…</div>}>
      <BlockPuzzlePageInner />
    </Suspense>
  );
}

function BlockPuzzlePageInner() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") as ReportTabKey | null;
  const [activeTab, setActiveTab] = useState<ReportTabKey>(
    initialTab === "bs" || initialTab === "report" || initialTab === "analysis"
      ? initialTab
      : "pl",
  );

  const pl = useBlockPuzzleStore();
  const bs = useBalanceSheetStore();
  const fa = useFinancialAnalysisStore();

  const plResults = useMemo(
    () => pl.periods.map((p) => calcBlockPuzzle(p)),
    [pl.periods],
  );
  const idealResult = useMemo(
    () => (pl.ideal ? calcBlockPuzzle(pl.ideal.period) : null),
    [pl.ideal],
  );
  const bsResults = useMemo(
    () => bs.periods.map((p) => calcBalanceSheet(p)),
    [bs.periods],
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [printTimestamp, setPrintTimestamp] = useState<string>("");
  useEffect(() => {
    setPrintTimestamp(new Date().toLocaleString("ja-JP"));
  }, []);

  const handleLoadSample = () => {
    pl.setPeriods(createSamplePLPeriods());
    bs.setPeriods(createSampleBSPeriods());
  };

  const handleClear = () => {
    pl.resetPeriods();
    bs.resetPeriods();
    fa.resetAnalysis();
  };

  const handleShiftPL = (next: PLPeriodInput) => {
    pl.shiftAndInsertPeriod(next);
    fa.shiftAndInsertEmpty();
  };
  const handleShiftBS = (next: BSPeriodInput) => {
    bs.shiftAndInsertPeriod(next);
    // shiftAndInsertEmpty は P/L 側で1回呼ばれれば十分（PdfImportButtonはPL→BSの順で呼ぶ）
    // ただし P/L だけ・B/S だけのシフトは現状のフローでは発生しない
  };

  const handleExport = () => {
    const plState = useBlockPuzzleStore.getState();
    const bsState = useBalanceSheetStore.getState();
    const data: CombinedExportData = {
      version: 2,
      pl: {
        version: 1,
        periods: plState.periods,
        unit: plState.unit,
        showCashSection: plState.showCashSection,
      },
      bs: {
        version: 1,
        periods: bsState.periods,
        unit: bsState.unit,
      },
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `keiei-report_${timestampForFilename()}.json`;
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
    reader.onload = (ev) => applyImportText(String(ev.target?.result ?? ""));
    reader.readAsText(file);
  };

  const applyImportText = (text: string) => {
    try {
      const data = JSON.parse(text) as unknown;
      if (isCombinedExport(data)) {
        pl.loadFromJson(data.pl);
        bs.loadFromJson(data.bs);
        alert("インポートしました（P/L + B/S）。");
      } else if (isLegacyPLExport(data)) {
        pl.loadFromJson(data);
        alert("インポートしました（旧形式：P/Lのみ）。");
      } else {
        alert("JSONの形式が不正です。");
      }
    } catch (err) {
      alert(`インポートに失敗しました: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      if (fileInputRef.current) { fileInputRef.current.value = ""; }
    }
  };

  const handleUnitChange = (next: "yen" | "thousand") => {
    pl.setUnit(next);
    bs.setUnit(next);
  };

  return (
    <div className="min-h-screen bg-gray-50 bp-printable">
      <main className="max-w-[1800px] ml-0 mr-auto p-4 space-y-4">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-xl font-bold">お金のブロックパズル + 貸借対照表</h1>
            <p className="text-sm text-gray-600 bp-print-hide">
              P/Lと貸借対照表を5期分のブロックパズル図で可視化し、AIの経営アドバイスをもとに経営レポート（PPTX）を出力できます。
            </p>
            <p className="bp-print-only text-xs text-gray-600">
              出力日時: {printTimestamp}
            </p>
          </div>
          <a
            href="https://peach-fin-48b.notion.site/35ced47bc5758073bb1ddcc71b0d9413"
            target="_blank"
            rel="noopener noreferrer"
            className="bp-print-hide inline-flex items-center gap-1.5 rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 hover:border-blue-400 transition-colors"
          >
            マニュアルを開く
            <span aria-hidden="true">↗</span>
          </a>
        </header>

        <ControlPanel
          unit={pl.unit}
          onUnitChange={handleUnitChange}
          showCashSection={pl.showCashSection}
          onShowCashSectionChange={pl.setShowCashSection}
          onPrint={handlePrint}
          onImport={handleImportClick}
          onExport={handleExport}
          onLoadSample={handleLoadSample}
          onClear={handleClear}
          onShiftPL={handleShiftPL}
          onShiftBS={handleShiftBS}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleImportFile}
          className="hidden"
        />

        <ReportTabs active={activeTab} onChange={setActiveTab} />

        {activeTab === "pl" && (
          <PLTab
            periods={pl.periods}
            unit={pl.unit}
            showCashSection={pl.showCashSection}
            results={plResults}
            idealResult={idealResult}
            onChange={pl.updateField}
            onApplyPdfPL={pl.applyPdfToColumn}
            onApplyPdfBS={bs.applyPdfToColumn}
          />
        )}
        {activeTab === "bs" && (
          <BSTab
            periods={bs.periods}
            unit={bs.unit}
            results={bsResults}
            onChange={bs.updateField}
          />
        )}
        {activeTab === "analysis" && (
          <FinancialAnalysisTab
            plResults={plResults}
            bsResults={bsResults}
          />
        )}
        {activeTab === "report" && (
          <IntegratedReportTab
            plResults={plResults}
            bsResults={bsResults}
            plAdviceText={pl.advice?.text ?? null}
            bsAdviceText={bs.advice?.text ?? null}
            idealResult={idealResult}
            idealReasoning={pl.ideal?.reasoning ?? null}
            unit={pl.unit}
            showCashSection={pl.showCashSection}
          />
        )}
      </main>
    </div>
  );
}

interface ControlPanelProps {
  unit: "yen" | "thousand";
  onUnitChange: (u: "yen" | "thousand") => void;
  showCashSection: boolean;
  onShowCashSectionChange: (v: boolean) => void;
  onPrint: () => void;
  onImport: () => void;
  onExport: () => void;
  onLoadSample: () => void;
  onClear: () => void;
  onShiftPL: (next: PLPeriodInput) => void;
  onShiftBS: (next: BSPeriodInput) => void;
}

function ControlPanel({
  unit,
  onUnitChange,
  showCashSection,
  onShowCashSectionChange,
  onPrint,
  onImport,
  onExport,
  onLoadSample,
  onClear,
  onShiftPL,
  onShiftBS,
}: ControlPanelProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 bg-white border rounded-lg p-3 bp-print-hide">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-700">表示単位</span>
        <label className="flex items-center gap-1">
          <input
            type="radio"
            checked={unit === "yen"}
            onChange={() => onUnitChange("yen")}
          />
          円単位
        </label>
        <label className="flex items-center gap-1">
          <input
            type="radio"
            checked={unit === "thousand"}
            onChange={() => onUnitChange("thousand")}
          />
          千円単位
        </label>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={showCashSection}
            onChange={(e) => onShowCashSectionChange(e.target.checked)}
          />
          P/Lのキャッシュ欄を表示
        </label>
      </div>
      <div className="ml-auto flex items-center gap-2 flex-wrap">
        <PdfImportButton
          applyMode="shift"
          onShiftPL={onShiftPL}
          onShiftBS={onShiftBS}
        />
        <Button size="sm" variant="outline" onClick={onPrint}>
          PDF出力
        </Button>
        <Button size="sm" variant="outline" onClick={onImport}>
          インポート
        </Button>
        <Button size="sm" variant="outline" onClick={onExport}>
          エクスポート
        </Button>
        <Button size="sm" variant="outline" onClick={onLoadSample}>
          サンプル読込
        </Button>
        <Button size="sm" variant="outline" onClick={onClear}>
          クリア
        </Button>
      </div>
    </div>
  );
}
