"use client";

import { useState, useMemo, useCallback } from "react";
import type {
  RateSettings,
  CorporateTaxParams,
  ExecutiveInput,
} from "@/types/simulation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RateSettingsPanel } from "@/components/rate-settings";
import { ExecutiveTable } from "@/components/executive-table";
import { HojinzeiSheet } from "@/components/hojinzei-sheet";
import { HoukokushoSheet } from "@/components/houkokusho-sheet";
import { calcExecutive, sumResults, calcCorporateTaxTotal } from "@/lib/calc-engine";
import { createDefaultSimulationData, createEmptyExecutive } from "@/lib/defaults";
import { formatYen } from "@/lib/format";

const VISIBLE_COUNT = 10;

type Tab = "simulation" | "hojinzei" | "houkokusho";

const TAB_LABELS: { id: Tab; label: string }[] = [
  { id: "simulation", label: "シミュレーション" },
  { id: "hojinzei", label: "法人税" },
  { id: "houkokusho", label: "報告書" },
];

export default function SimulationPage() {
  const [data, setData] = useState(() => createDefaultSimulationData());
  const [activeTab, setActiveTab] = useState<Tab>("simulation");

  // PLAN2用の比較データ（初期は空）
  const [plan2Executives, setPlan2Executives] = useState<ExecutiveInput[]>(
    () => Array.from({ length: 10 }, () => createEmptyExecutive())
  );

  // --- 計算結果（メモ化） ---
  const currentResults = useMemo(() => {
    return data.currentExecutives.map((exec, i) =>
      calcExecutive(
        exec,
        data.rates,
        data.governmentHealthInsurance,
        data.combineOtherSalaryForInsurance,
        i
      )
    );
  }, [data.currentExecutives, data.rates, data.governmentHealthInsurance, data.combineOtherSalaryForInsurance]);

  const currentTotals = useMemo(() => sumResults(currentResults), [currentResults]);

  const comparisonResults = useMemo(() => {
    return data.comparisonExecutives.map((exec, i) =>
      calcExecutive(
        exec,
        data.rates,
        data.governmentHealthInsurance,
        data.combineOtherSalaryForInsurance,
        i
      )
    );
  }, [data.comparisonExecutives, data.rates, data.governmentHealthInsurance, data.combineOtherSalaryForInsurance]);

  const comparisonTotals = useMemo(() => sumResults(comparisonResults), [comparisonResults]);

  // 役員報酬合計（現状）
  const currentExecPay = useMemo(() =>
    data.currentExecutives.reduce(
      (s, e) => s + e.regularSalary + e.predeterminedBonus1 + e.predeterminedBonus2 + e.predeterminedBonus3,
      0
    ),
    [data.currentExecutives]
  );

  // 役員報酬合計（比較）
  const comparisonExecPay = useMemo(() =>
    data.comparisonExecutives.reduce(
      (s, e) => s + e.regularSalary + e.predeterminedBonus1 + e.predeterminedBonus2 + e.predeterminedBonus3,
      0
    ),
    [data.comparisonExecutives]
  );

  // 法人所得金額（役員報酬・会社社保控除後）
  const currentCorporateIncome = useMemo(() =>
    data.corporateTaxParams.preTaxCorporateIncome - currentExecPay - currentTotals.employerSocialInsurance,
    [data.corporateTaxParams, currentExecPay, currentTotals.employerSocialInsurance]
  );

  const comparisonCorporateIncome = useMemo(() =>
    data.corporateTaxParams.preTaxCorporateIncome - comparisonExecPay - comparisonTotals.employerSocialInsurance,
    [data.corporateTaxParams, comparisonExecPay, comparisonTotals.employerSocialInsurance]
  );

  // 法人税（現状）
  const currentCorporateTax = useMemo(() =>
    calcCorporateTaxTotal(
      data.corporateTaxParams,
      currentExecPay,
      currentTotals.employerSocialInsurance,
      data.effectiveTaxRates
    ),
    [data.corporateTaxParams, currentExecPay, currentTotals.employerSocialInsurance, data.effectiveTaxRates]
  );

  // 法人税（比較）
  const comparisonCorporateTax = useMemo(() =>
    calcCorporateTaxTotal(
      data.corporateTaxParams,
      comparisonExecPay,
      comparisonTotals.employerSocialInsurance,
      data.effectiveTaxRates
    ),
    [data.corporateTaxParams, comparisonExecPay, comparisonTotals.employerSocialInsurance, data.effectiveTaxRates]
  );

  // --- PLAN2計算 ---
  const plan2Results = useMemo(() =>
    plan2Executives.map((exec, i) =>
      calcExecutive(exec, data.rates, data.governmentHealthInsurance, data.combineOtherSalaryForInsurance, i)
    ),
    [plan2Executives, data.rates, data.governmentHealthInsurance, data.combineOtherSalaryForInsurance]
  );

  const plan2Totals = useMemo(() => sumResults(plan2Results), [plan2Results]);

  const plan2ExecPay = useMemo(() =>
    plan2Executives.reduce(
      (s, e) => s + e.regularSalary + e.predeterminedBonus1 + e.predeterminedBonus2 + e.predeterminedBonus3,
      0
    ),
    [plan2Executives]
  );

  const plan2CorporateIncome = useMemo(() =>
    data.corporateTaxParams.preTaxCorporateIncome - plan2ExecPay - plan2Totals.employerSocialInsurance,
    [data.corporateTaxParams, plan2ExecPay, plan2Totals.employerSocialInsurance]
  );

  const plan2CorporateTax = useMemo(() =>
    calcCorporateTaxTotal(
      data.corporateTaxParams,
      plan2ExecPay,
      plan2Totals.employerSocialInsurance,
      data.effectiveTaxRates
    ),
    [data.corporateTaxParams, plan2ExecPay, plan2Totals.employerSocialInsurance, data.effectiveTaxRates]
  );

  // --- ハンドラ ---
  const handleRatesChange = useCallback((rates: RateSettings) => {
    setData((prev) => ({ ...prev, rates }));
  }, []);

  const handleCorporateTaxParamsChange = useCallback((params: CorporateTaxParams) => {
    setData((prev) => ({ ...prev, corporateTaxParams: params }));
  }, []);

  const handleCurrentExecChange = useCallback(
    (index: number, exec: ExecutiveInput) => {
      setData((prev) => {
        const updated = [...prev.currentExecutives];
        updated[index] = exec;
        return { ...prev, currentExecutives: updated };
      });
    },
    []
  );

  const handleComparisonExecChange = useCallback(
    (index: number, exec: ExecutiveInput) => {
      setData((prev) => {
        const updated = [...prev.comparisonExecutives];
        updated[index] = exec;
        return { ...prev, comparisonExecutives: updated };
      });
    },
    []
  );

  // PLAN1比較データをPLAN2にコピー
  const handleCopyToPlan2 = useCallback(() => {
    setPlan2Executives(data.comparisonExecutives.map((e) => ({ ...e })));
  }, [data.comparisonExecutives]);

  // 現状転記
  const handleTransfer = useCallback(() => {
    setData((prev) => {
      const transferred = prev.currentExecutives.map((exec) => ({ ...exec }));
      return { ...prev, comparisonExecutives: transferred };
    });
  }, []);

  // 政管健保切替
  const handleGovernmentHealthInsuranceChange = useCallback(
    (checked: boolean) => {
      setData((prev) => ({ ...prev, governmentHealthInsurance: checked }));
    },
    []
  );

  // 他の給与社保合算
  const handleCombineOtherSalaryChange = useCallback(
    (checked: boolean) => {
      setData((prev) => ({ ...prev, combineOtherSalaryForInsurance: checked }));
    },
    []
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b px-6 py-3">
        <h1 className="text-lg font-bold">
          こがねむしクラウド - 役員報酬シミュレーション
        </h1>
        <p className="text-xs text-muted-foreground">円単位で入力してください</p>
      </header>

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
            <RateSettingsPanel
              rates={data.rates}
              corporateTaxParams={data.corporateTaxParams}
              onRatesChange={handleRatesChange}
              onCorporateTaxParamsChange={handleCorporateTaxParamsChange}
            />

            {/* グローバルフラグ */}
            <div className="flex items-center gap-6 px-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={data.governmentHealthInsurance}
                  onCheckedChange={(c) => handleGovernmentHealthInsuranceChange(!!c)}
                />
                政管健保（協会けんぽ）
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={data.combineOtherSalaryForInsurance}
                  onCheckedChange={(c) => handleCombineOtherSalaryChange(!!c)}
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
              <ExecutiveTable
                executives={data.currentExecutives}
                results={currentResults}
                totals={currentTotals}
                onExecutiveChange={handleCurrentExecChange}
                visibleCount={VISIBLE_COUNT}
              />
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
                <Button size="sm" variant="outline" onClick={handleTransfer}>
                  現状から転記
                </Button>
              </div>
              <ExecutiveTable
                executives={data.comparisonExecutives}
                results={comparisonResults}
                totals={comparisonTotals}
                onExecutiveChange={handleComparisonExecChange}
                visibleCount={VISIBLE_COUNT}
              />
              <div className="mt-2 flex items-center gap-4">
                <span className="text-sm">
                  法人税金合計: <strong>{formatYen(comparisonCorporateTax)}</strong> 円
                </span>
              </div>
            </section>
          </div>
        )}

        {/* 法人税タブ */}
        {activeTab === "hojinzei" && (
          <HojinzeiSheet
            corporateTaxParams={data.corporateTaxParams}
            effectiveTaxRates={data.effectiveTaxRates}
            currentCorporateIncome={currentCorporateIncome}
            currentCorporateTax={currentCorporateTax}
            comparisonCorporateIncome={comparisonCorporateIncome}
            comparisonCorporateTax={comparisonCorporateTax}
          />
        )}

        {/* 報告書タブ */}
        {activeTab === "houkokusho" && (
          <HoukokushoSheet
            corporateTaxParams={data.corporateTaxParams}
            currentExecutives={data.currentExecutives}
            currentTotals={currentTotals}
            currentCorporateTax={currentCorporateTax}
            currentCorporateIncome={currentCorporateIncome}
            comparisonExecutives={data.comparisonExecutives}
            comparisonTotals={comparisonTotals}
            comparisonCorporateTax={comparisonCorporateTax}
            comparisonCorporateIncome={comparisonCorporateIncome}
            plan2Executives={plan2Executives}
            plan2Totals={plan2Totals}
            plan2CorporateTax={plan2CorporateTax}
            plan2CorporateIncome={plan2CorporateIncome}
            onCopyToPlan2={handleCopyToPlan2}
          />
        )}
      </main>
    </div>
  );
}
