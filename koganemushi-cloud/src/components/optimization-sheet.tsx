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
    taxYear,
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
      taxYear: s.taxYear,
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
    taxYear,
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
        <p className="text-xs text-gray-500 mb-1">
          定期同額給与を変化させて手取り額が最大になる報酬額を探します（比較用役員1人目）
        </p>
        <p className="text-xs text-gray-400 mb-2">
          ※ 手取り額 = 役員個人の手取り、合算CF = 役員手取り + 法人内部留保（法人所得 − 役員報酬 − 会社負担社保 − 法人税）
        </p>
        {salarySweep && (
          <>
            <SalaryTable rows={salarySweep} />
            <SalarySweepComment rows={salarySweep} />
          </>
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
        <p className="text-xs text-gray-500 mb-1">
          配当所得を変化させ（定期同額 = 法人所得 − 配当）手取り額が最大になる値を探します
        </p>
        <p className="text-xs text-gray-400 mb-2">
          ※ 手取り額 = 役員個人の手取り、合算CF = 役員手取り + 法人内部留保（配当・報酬の配分による税負担の違いを比較）
        </p>
        {dividendResult && (
          <>
            <DividendTable rows={dividendResult.rows} />
            <DividendSweepComment rows={dividendResult.rows} />
          </>
        )}
      </section>

    </div>
  );
}

function SalarySweepComment({
  rows,
}: {
  rows: { salary: number; netIncome: number; combinedCF: number; isBaseline: boolean }[];
}) {
  const baseline = rows.find((r) => r.isBaseline);
  if (!baseline) return null;

  const baselineNet = baseline.netIncome;
  const maxCF = Math.max(...rows.map((r) => r.combinedCF));
  const best = rows.find((r) => r.combinedCF === maxCF)!;
  const bestNetDiff = best.netIncome - baselineNet;
  const maxNet = Math.max(...rows.map((r) => r.netIncome));
  const bestNet = rows.find((r) => r.netIncome === maxNet)!;
  const bestNetCFDiff = bestNet.combinedCF;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm space-y-1 mt-2">
      <p>
        <span className="font-bold">合算CF（差分）</span>が最大になるのは定期同額給与
        <span className="font-bold text-blue-700"> {formatYen(best.salary)} </span>
        のときで、現状より
        <span className={`font-bold ${best.combinedCF >= 0 ? "text-green-700" : "text-red-600"}`}>
          {" "}{best.combinedCF >= 0 ? "+" : ""}{formatYen(best.combinedCF)}
        </span>
        {best.combinedCF >= 0 ? " 有利" : " 不利"}です。
        {bestNetDiff !== 0 && (
          <>
            ただし手取り額は現状より
            <span className={`font-bold ${bestNetDiff >= 0 ? "text-green-700" : "text-red-600"}`}>
              {" "}{bestNetDiff >= 0 ? "+" : ""}{formatYen(bestNetDiff)}
            </span>
            {bestNetDiff < 0 ? "（個人の手取りは減少します）" : ""}。
          </>
        )}
      </p>
      <p>
        <span className="font-bold">手取り額</span>が最大になるのは定期同額給与
        <span className="font-bold text-blue-700"> {formatYen(bestNet.salary)} </span>
        のときで、
        <span className="font-bold"> {formatYen(bestNet.netIncome)} </span>です。
        {bestNetCFDiff !== 0 && (
          <>
            そのときの合算CF（差分）は
            <span className={`font-bold ${bestNetCFDiff >= 0 ? "text-green-700" : "text-red-600"}`}>
              {" "}{bestNetCFDiff >= 0 ? "+" : ""}{formatYen(bestNetCFDiff)}
            </span>
            です。
          </>
        )}
      </p>
      {(() => {
        // 推奨: 手取りが現状以上 かつ 合算CF減少が50万円以下
        const candidates = rows.filter(
          (r) => r.netIncome >= baselineNet && r.combinedCF >= -500000
        );
        if (candidates.length === 0) return (
          <p className="text-xs text-gray-500 pt-1">
            ※ 手取り額が現状以上かつ合算CFの減少が50万円以下となる金額はありません。
          </p>
        );
        // 候補の中で手取りが最大のものを推奨
        const recommended = candidates.reduce((a, b) =>
          b.netIncome > a.netIncome ? b : a
        );
        const recNetDiff = recommended.netIncome - baselineNet;
        return (
          <div className="bg-yellow-50 border border-yellow-300 rounded p-2 mt-1">
            <p>
              <span className="font-bold">推奨:</span> 定期同額給与
              <span className="font-bold text-yellow-800"> {formatYen(recommended.salary)} </span>
              — 手取り額は現状より
              <span className="font-bold text-green-700"> +{formatYen(recNetDiff)} </span>
              増加し、合算CF（差分）は
              <span className={`font-bold ${recommended.combinedCF >= 0 ? "text-green-700" : "text-red-600"}`}>
                {" "}{recommended.combinedCF >= 0 ? "+" : ""}{formatYen(recommended.combinedCF)}
              </span>
              です。
            </p>
          </div>
        );
      })()}
      <p className="text-xs text-gray-500 pt-1">
        ※ 合算CFは法人と個人を合わせた全体の資金効率、手取り額は役員個人が受け取れる金額です。
        推奨は手取りが現状以上かつ合算CF減少が50万円以下の中で手取りが最大となる金額です。
      </p>
    </div>
  );
}

function DividendSweepComment({
  rows,
}: {
  rows: { dividend: number; salary: number; netIncome: number; combinedCF: number }[];
}) {
  if (rows.length === 0) return null;

  const baselineNet = rows[0].netIncome;  // 配当0（全額報酬）が基準
  const maxCF = Math.max(...rows.map((r) => r.combinedCF));
  const best = rows.find((r) => r.combinedCF === maxCF)!;
  const bestNetDiff = best.netIncome - baselineNet;
  const maxNet = Math.max(...rows.map((r) => r.netIncome));
  const bestNet = rows.find((r) => r.netIncome === maxNet)!;
  const bestNetCFDiff = bestNet.combinedCF;

  return (
    <div className="bg-green-50 border border-green-200 rounded p-3 text-sm space-y-1 mt-2">
      <p>
        <span className="font-bold">合算CF（差分）</span>が最大になるのは配当所得
        <span className="font-bold text-green-700"> {formatYen(best.dividend)} </span>
        （定期同額 {formatYen(best.salary)}）のときで、現状より
        <span className={`font-bold ${best.combinedCF >= 0 ? "text-green-700" : "text-red-600"}`}>
          {" "}{best.combinedCF >= 0 ? "+" : ""}{formatYen(best.combinedCF)}
        </span>
        {best.combinedCF >= 0 ? " 有利" : " 不利"}です。
        {bestNetDiff !== 0 && (
          <>
            ただし手取り額は現状より
            <span className={`font-bold ${bestNetDiff >= 0 ? "text-green-700" : "text-red-600"}`}>
              {" "}{bestNetDiff >= 0 ? "+" : ""}{formatYen(bestNetDiff)}
            </span>
            {bestNetDiff < 0 ? "（個人の手取りは減少します）" : ""}。
          </>
        )}
      </p>
      <p>
        <span className="font-bold">手取り額</span>が最大になるのは配当所得
        <span className="font-bold text-green-700"> {formatYen(bestNet.dividend)} </span>
        （定期同額 {formatYen(bestNet.salary)}）のときで、
        <span className="font-bold"> {formatYen(bestNet.netIncome)} </span>です。
        {bestNetCFDiff !== 0 && (
          <>
            そのときの合算CF（差分）は
            <span className={`font-bold ${bestNetCFDiff >= 0 ? "text-green-700" : "text-red-600"}`}>
              {" "}{bestNetCFDiff >= 0 ? "+" : ""}{formatYen(bestNetCFDiff)}
            </span>
            です。
          </>
        )}
      </p>
      {(() => {
        const candidates = rows.filter(
          (r) => r.netIncome >= baselineNet && r.combinedCF >= -500000
        );
        if (candidates.length === 0) return (
          <p className="text-xs text-gray-500 pt-1">
            ※ 手取り額が現状以上かつ合算CFの減少が50万円以下となる配分はありません。
          </p>
        );
        const recommended = candidates.reduce((a, b) =>
          b.netIncome > a.netIncome ? b : a
        );
        const recNetDiff = recommended.netIncome - baselineNet;
        return (
          <div className="bg-yellow-50 border border-yellow-300 rounded p-2 mt-1">
            <p>
              <span className="font-bold">推奨:</span> 配当所得
              <span className="font-bold text-yellow-800"> {formatYen(recommended.dividend)} </span>
              （定期同額 {formatYen(recommended.salary)}）
              — 手取り額は現状より
              <span className="font-bold text-green-700"> +{formatYen(recNetDiff)} </span>
              増加し、合算CF（差分）は
              <span className={`font-bold ${recommended.combinedCF >= 0 ? "text-green-700" : "text-red-600"}`}>
                {" "}{recommended.combinedCF >= 0 ? "+" : ""}{formatYen(recommended.combinedCF)}
              </span>
              です。
            </p>
          </div>
        );
      })()}
      <p className="text-xs text-gray-500 pt-1">
        ※ 配当は給与所得控除や社会保険料の対象外ですが、配当控除が適用されます。
        推奨は手取りが現状以上かつ合算CF減少が50万円以下の中で手取りが最大となる配分です。
      </p>
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

