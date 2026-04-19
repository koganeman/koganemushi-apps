"use client";

import { useHojinnariStore, type HojinnariTab } from "@/stores/hojinnari-store";
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

export default function HojinnariPage() {
  const activeTab = useHojinnariStore((s) => s.activeTab);
  const setActiveTab = useHojinnariStore((s) => s.setActiveTab);
  const taxYear = useHojinnariStore((s) => s.taxYear);
  const setTaxYear = useHojinnariStore((s) => s.setTaxYear);

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
        <div className="ml-auto pr-2">
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
