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
import { calcExecutive, sumResults, calcCorporateTaxTotal } from "@/lib/calc-engine";
import { createDefaultSimulationData } from "@/lib/defaults";
import { formatYen } from "@/lib/format";

const VISIBLE_COUNT = 10;

export default function SimulationPage() {
  const [data, setData] = useState(() => createDefaultSimulationData());

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

  // 法人税
  const currentCorporateTax = useMemo(() => {
    const execPay = data.currentExecutives.reduce(
      (sum, e) =>
        sum + e.regularSalary + e.predeterminedBonus1 + e.predeterminedBonus2 + e.predeterminedBonus3,
      0
    );
    return calcCorporateTaxTotal(
      data.corporateTaxParams,
      execPay,
      currentTotals.employerSocialInsurance,
      data.effectiveTaxRates
    );
  }, [data.corporateTaxParams, data.currentExecutives, currentTotals, data.effectiveTaxRates]);

  const comparisonCorporateTax = useMemo(() => {
    const execPay = data.comparisonExecutives.reduce(
      (sum, e) =>
        sum + e.regularSalary + e.predeterminedBonus1 + e.predeterminedBonus2 + e.predeterminedBonus3,
      0
    );
    return calcCorporateTaxTotal(
      data.corporateTaxParams,
      execPay,
      comparisonTotals.employerSocialInsurance,
      data.effectiveTaxRates
    );
  }, [data.corporateTaxParams, data.comparisonExecutives, comparisonTotals, data.effectiveTaxRates]);

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

  // 現状転記
  const handleTransfer = useCallback(() => {
    setData((prev) => {
      const transferred = prev.currentExecutives.map((exec) => ({
        ...exec,
      }));
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

      <main className="p-4 space-y-6 max-w-[1600px] mx-auto">
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
      </main>
    </div>
  );
}
