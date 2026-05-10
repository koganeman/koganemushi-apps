"use client";

import { useRef } from "react";
import { useHojinnariStore, type HojinnariTab, type HojinnariExportData } from "@/stores/hojinnari-store";
import { TaxYearSelector } from "@/components/tax-year-selector";
import { SimulationSheet } from "@/components/hojinnari/simulation-sheet";
import { DecisionMeasuresTable } from "@/components/hojinnari/decision-measures-table";
import { HoujinnariSheet } from "@/components/hojinnari/houjinnari-sheet";
import { HoukokushoSheet } from "@/components/hojinnari/houkokusho-sheet";
import { OptimizationSheet } from "@/components/hojinnari/optimization-sheet";
import { CalcDetailSheet } from "@/components/hojinnari/calc-detail-sheet";

const TAB_LABELS: { id: HojinnariTab; label: string }[] = [
  { id: "simulation", label: "シミュレーション" },
  { id: "houjinnari", label: "法人成り" },
  { id: "houkokusho", label: "報告書" },
  { id: "saitekika", label: "最適化" },
  { id: "keisan-meisai", label: "計算明細" },
];

function timestampForFilename(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export default function HojinnariPage() {
  const activeTab = useHojinnariStore((s) => s.activeTab);
  const setActiveTab = useHojinnariStore((s) => s.setActiveTab);
  const taxYear = useHojinnariStore((s) => s.taxYear);
  const setTaxYear = useHojinnariStore((s) => s.setTaxYear);
  const loadFromJson = useHojinnariStore((s) => s.loadFromJson);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const state = useHojinnariStore.getState();
    const data: HojinnariExportData = {
      version: 1,
      input: state.input,
      rates: state.rates,
      decisionMeasures: state.decisionMeasures,
      taxYear: state.taxYear,
      reportPlan2Input: state.reportPlan2Input,
      reportPlan2Rates: state.reportPlan2Rates,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hojinnari_${timestampForFilename()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = String(ev.target?.result ?? "");
        const data = JSON.parse(text) as HojinnariExportData;
        if (typeof data !== "object" || data === null) {
          alert("JSONの形式が不正です。");
          return;
        }
        loadFromJson(data);
        alert("インポートしました。");
      } catch (err) {
        alert(`インポートに失敗しました: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        // 同じファイルを連続で選べるようリセット
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* タブナビゲーション（layout.tsx のヘッダー下） */}
      <div className="bg-white border-b px-6 flex items-center gap-0">
        {TAB_LABELS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-blue-600 text-blue-700 bg-blue-50"
                : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
        <div className="ml-auto pr-2 flex items-center gap-2">
          <a
            href="https://peach-fin-48b.notion.site/34ded47bc575806ca970f5bc991420fe"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs border border-blue-500 text-blue-700 rounded px-3 py-1 hover:bg-blue-50 transition-colors inline-flex items-center gap-1"
            title="法人成りシミュレーション 操作マニュアル"
          >
            マニュアル
            <span aria-hidden="true">↗</span>
          </a>
          <button
            onClick={handleImportClick}
            className="text-xs border border-blue-500 text-blue-700 rounded px-3 py-1 hover:bg-blue-50 transition-colors"
            title="JSONファイルから入力データを読み込みます"
          >
            インポート
          </button>
          <button
            onClick={handleExport}
            className="text-xs border border-green-500 text-green-700 rounded px-3 py-1 hover:bg-green-50 transition-colors"
            title="現在の入力データをJSONファイルに保存します"
          >
            エクスポート
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportFile}
            className="hidden"
          />
          <TaxYearSelector value={taxYear} onChange={setTaxYear} />
        </div>
      </div>

      <main className="max-w-[1400px] mx-auto">
        {activeTab === "simulation" && <SimulationSheet />}
        {activeTab === "simulation" && (
          <div className="px-4 pb-4">
            <DecisionMeasuresTable />
          </div>
        )}
        {activeTab === "houjinnari" && <HoujinnariSheet />}
        {activeTab === "houkokusho" && <HoukokushoSheet />}
        {activeTab === "saitekika" && <OptimizationSheet />}
        {activeTab === "keisan-meisai" && <CalcDetailSheet />}
      </main>
    </div>
  );
}
