"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatYen } from "@/lib/format";
import {
  sweepRegularSalary,
  sweepDividend,
} from "@/lib/optimize";
import { useSimulationStore } from "@/stores/simulation-store";
import { useShallow } from "zustand/react/shallow";

export function OptimizationSheet() {
  const {
    executives,
    comparisonExecutives,
    rates,
    isGovernmentHealthInsurance,
    combineOtherSalaryForInsurance,
    corporateTaxParams,
    effectiveTaxRates,
    applyDividend,
  } = useSimulationStore(
    useShallow((s) => ({
      executives: s.currentExecutives,
      comparisonExecutives: s.comparisonExecutives,
      rates: s.rates,
      isGovernmentHealthInsurance: s.governmentHealthInsurance,
      combineOtherSalaryForInsurance: s.combineOtherSalaryForInsurance,
      corporateTaxParams: s.corporateTaxParams,
      effectiveTaxRates: s.effectiveTaxRates,
      applyDividend: s.applyDividend,
    }))
  );
  const [salarySweep, setSalarySweep] = useState<
    { salary: number; netIncome: number; combinedCF: number; isBaseline: boolean }[] | null
  >(null);
  const [dividendResult, setDividendResult] = useState<{
    rows: { dividend: number; salary: number; netIncome: number; combinedCF: number }[];
    optimalDividend: number;
    optimalSalary: number;
  } | null>(null);
  const ctx = {
    executives,
    comparisonExecutives,
    rates,
    isGovernmentHealthInsurance,
    combineOtherSalaryForInsurance,
    corporateTaxParams,
    effectiveTaxRates,
  };

  const preTaxIncome = corporateTaxParams.preTaxCorporateIncome;
  const noIncome = preTaxIncome === 0;

  return (
    <div className="p-4 space-y-8">
      {noIncome && (
        <div className="p-3 bg-yellow-50 border border-yellow-300 rounded text-sm text-yellow-800">
          役員報酬支払前法人所得が 0 のため試算できません。料率設定パネルで法人所得を設定してください。
        </div>
      )}

      {/* セクション1: 役員報酬最適化 */}
      <section>
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-base font-bold">役員報酬最適化</h2>
          <Button
            size="sm"
            variant="outline"
            disabled={noIncome}
            onClick={() => setSalarySweep(sweepRegularSalary(ctx))}
          >
            試算
          </Button>
        </div>
        <p className="text-xs text-gray-500 mb-2">
          定期同額給与を変化させて手取り額が最大になる報酬額を探します（比較用役員1人目）
        </p>
        {salarySweep && (
          <SalaryTable rows={salarySweep} />
        )}
      </section>

      {/* セクション2: 配当金最適化 */}
      <section>
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-base font-bold">配当金最適化</h2>
          <Button
            size="sm"
            variant="outline"
            disabled={noIncome}
            onClick={() => setDividendResult(sweepDividend(ctx))}
          >
            試算
          </Button>
          {dividendResult && (
            <Button
              size="sm"
              variant="default"
              onClick={() =>
                applyDividend(
                  dividendResult.optimalDividend,
                  dividendResult.optimalSalary
                )
              }
            >
              適用
            </Button>
          )}
        </div>
        <p className="text-xs text-gray-500 mb-2">
          配当所得を変化させ（定期同額 = 法人所得 − 配当）手取り額が最大になる値を探します
        </p>
        {dividendResult && (
          <DividendTable rows={dividendResult.rows} />
        )}
      </section>

    </div>
  );
}

function SalaryTable({
  rows,
}: {
  rows: { salary: number; netIncome: number; combinedCF: number; isBaseline: boolean }[];
}) {
  const maxCF = Math.max(...rows.map((r) => r.combinedCF));
  return (
    <div className="overflow-auto">
      <table className="text-xs border-collapse border border-gray-300 w-auto">
        <thead>
          <tr className="bg-[#d6e4f7]">
            <th className="border border-gray-300 px-3 py-1 text-right">定期同額給与</th>
            <th className="border border-gray-300 px-3 py-1 text-right">手取り額</th>
            <th className="border border-gray-300 px-3 py-1 text-right">合算CF（差分）</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const isMax = row.combinedCF === maxCF;
            let rowClass = "";
            if (isMax) {
              rowClass = "bg-yellow-200 font-bold";
            } else if (row.isBaseline) {
              rowClass = "bg-blue-50 font-semibold";
            }
            return (
              <tr key={i} className={rowClass}>
                <td className="border border-gray-300 px-3 py-0.5 text-right">
                  {formatYen(row.salary)}
                  {row.isBaseline && <span className="ml-1 text-blue-600 text-xs">（現状）</span>}
                </td>
                <td className="border border-gray-300 px-3 py-0.5 text-right">
                  {formatYen(row.netIncome)}
                </td>
                <td className="border border-gray-300 px-3 py-0.5 text-right">
                  {formatYen(row.combinedCF)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DividendTable({
  rows,
}: {
  rows: { dividend: number; salary: number; netIncome: number; combinedCF: number }[];
}) {
  const maxCF = Math.max(...rows.map((r) => r.combinedCF));
  return (
    <div className="overflow-auto">
      <table className="text-xs border-collapse border border-gray-300 w-auto">
        <thead>
          <tr className="bg-[#d6e4f7]">
            <th className="border border-gray-300 px-3 py-1 text-right">配当所得</th>
            <th className="border border-gray-300 px-3 py-1 text-right">定期同額</th>
            <th className="border border-gray-300 px-3 py-1 text-right">手取り額</th>
            <th className="border border-gray-300 px-3 py-1 text-right">合算CF（差分）</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const isMax = row.combinedCF === maxCF;
            return (
              <tr key={i} className={isMax ? "bg-yellow-200 font-bold" : ""}>
                <td className="border border-gray-300 px-3 py-0.5 text-right">
                  {formatYen(row.dividend)}
                </td>
                <td className="border border-gray-300 px-3 py-0.5 text-right">
                  {formatYen(row.salary)}
                </td>
                <td className="border border-gray-300 px-3 py-0.5 text-right">
                  {formatYen(row.netIncome)}
                </td>
                <td className="border border-gray-300 px-3 py-0.5 text-right">
                  {formatYen(row.combinedCF)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

