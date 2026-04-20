"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { TaxYearSelector } from "@/components/tax-year-selector";
import { RateSettingsPanel } from "@/components/rate-settings";
import { ExecutiveTable } from "@/components/executive-table";
import { HojinzeiSheet } from "@/components/hojinzei-sheet";
import { HoukokushoSheet } from "@/components/houkokusho-sheet";
import { OptimizationSheet } from "@/components/optimization-sheet";
import { useSimulationStore, type Tab } from "@/stores/simulation-store";
import { useShallow } from "zustand/react/shallow";
import { useCurrentResults, useComparisonResults } from "@/hooks/use-computed-results";
import { formatYen } from "@/lib/format";

const VISIBLE_COUNT = 10;

const TAB_LABELS: { id: Tab; label: string }[] = [
  { id: "simulation", label: "シミュレーション" },
  { id: "hojinzei", label: "法人税" },
  { id: "houkokusho", label: "報告書" },
  { id: "saitekika", label: "最適化" },
];

export default function SimulationPage() {
  const {
    activeTab,
    setActiveTab,
    combineOtherSalaryForInsurance,
    setCombineOtherSalaryForInsurance,
    transferCurrentToComparison,
    taxYear,
    setTaxYear,
  } = useSimulationStore(
    useShallow((s) => ({
      activeTab: s.activeTab,
      setActiveTab: s.setActiveTab,
      combineOtherSalaryForInsurance: s.combineOtherSalaryForInsurance,
      setCombineOtherSalaryForInsurance: s.setCombineOtherSalaryForInsurance,
      transferCurrentToComparison: s.transferCurrentToComparison,
      taxYear: s.taxYear,
      setTaxYear: s.setTaxYear,
    }))
  );

  const { corporateTax: currentCorporateTax } = useCurrentResults();
  const { corporateTax: comparisonCorporateTax } = useComparisonResults();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* タブナビゲーション */}
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

      <main className="max-w-[1800px] mx-auto">
        {/* シミュレーションタブ */}
        {activeTab === "simulation" && (
          <div className="p-4 space-y-6">
            {/* 料率設定 */}
            <RateSettingsPanel />

            {/* グローバルフラグ */}
            <div className="flex items-center gap-6 px-2">
              <TaxYearSelector value={taxYear} onChange={setTaxYear} />
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={combineOtherSalaryForInsurance}
                  onCheckedChange={(c) => setCombineOtherSalaryForInsurance(!!c)}
                />
                他の給与収入を社保対象に合算（1人目のみ）
              </label>
            </div>

            {/* 現状 */}
            <section>
              <div className="flex items-center gap-4 mb-2">
                <h2 className="text-base font-bold">
                  <span className="inline-block w-3 h-3 bg-black rounded-full mr-1" />
                  現状の役員報酬設定
                </h2>
              </div>
              <ExecutiveTable plan="current" visibleCount={VISIBLE_COUNT} />
              <div className="mt-2 flex items-center gap-4">
                <span className="text-sm">
                  法人税金合計: <strong>{formatYen(currentCorporateTax)}</strong> 円
                </span>
              </div>
            </section>

            {/* 比較 */}
            <section>
              <div className="flex items-center gap-4 mb-2">
                <h2 className="text-base font-bold">
                  <span className="inline-block w-3 h-3 bg-black rounded-full mr-1" />
                  比較用の役員報酬設定
                </h2>
                <Button size="sm" variant="outline" onClick={transferCurrentToComparison}>
                  現状から転記
                </Button>
              </div>
              <ExecutiveTable plan="comparison" visibleCount={VISIBLE_COUNT} />
              <div className="mt-2 flex items-center gap-4">
                <span className="text-sm">
                  法人税金合計: <strong>{formatYen(comparisonCorporateTax)}</strong> 円
                </span>
              </div>
            </section>
          </div>
        )}

        {/* 法人税タブ */}
        {activeTab === "hojinzei" && <HojinzeiSheet />}

        {/* 最適化タブ */}
        {activeTab === "saitekika" && <OptimizationSheet />}

        {/* 報告書タブ */}
        {activeTab === "houkokusho" && <HoukokushoSheet />}
      </main>
    </div>
  );
}
