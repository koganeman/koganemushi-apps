"use client";

import { useHojinnariStore, type HojinnariTab } from "@/stores/hojinnari-store";
import { SimulationSheet } from "@/components/hojinnari/simulation-sheet";
import { HoujinnariSheet } from "@/components/hojinnari/houjinnari-sheet";
import { HoukokushoSheet } from "@/components/hojinnari/houkokusho-sheet";
import { OptimizationSheet } from "@/components/hojinnari/optimization-sheet";

const TAB_LABELS: { id: HojinnariTab; label: string }[] = [
  { id: "simulation", label: "シミュレーション" },
  { id: "houjinnari", label: "法人成り" },
  { id: "houkokusho", label: "報告書" },
  { id: "saitekika", label: "最適化" },
];

export default function HojinnariPage() {
  const activeTab = useHojinnariStore((s) => s.activeTab);
  const setActiveTab = useHojinnariStore((s) => s.setActiveTab);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* タブナビゲーション（layout.tsx のヘッダー下） */}
      <div className="bg-white border-b px-6 flex gap-0">
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
      </div>

      <main className="max-w-[1400px] mx-auto">
        {activeTab === "simulation" && <SimulationSheet />}
        {activeTab === "houjinnari" && <HoujinnariSheet />}
        {activeTab === "houkokusho" && <HoukokushoSheet />}
        {activeTab === "saitekika" && <OptimizationSheet />}
      </main>
    </div>
  );
}
