"use client";

import type { CorporateTaxParams, EffectiveTaxRates } from "@/types/simulation";
import { formatYen } from "@/lib/format";
import { useSimulationStore } from "@/stores/simulation-store";
import { useShallow } from "zustand/react/shallow";
import { useCurrentResults, useComparisonResults } from "@/hooks/use-computed-results";

// 静的参照テーブル（令和元年10月1日以降開始事業年度）
const TAX_RATE_PARAMS = [
  { label: "法人税率1", value: "15.00%" },
  { label: "法人税率2", value: "23.20%" },
  { label: "地方法人税率", value: "10.30%" },
  { label: "都道府県民税率1", value: "1.00%" },
  { label: "都道府県民税率2", value: "1.80%" },
  { label: "市町村民税率", value: "6.00%" },
  { label: "事業税率1", value: "3.50%" },
  { label: "事業税率2", value: "5.30%" },
  { label: "事業税率3", value: "7.00%" },
  { label: "特別法人事業税率", value: "37.00%" },
];

// 合計税率・実効税率テーブル
const COMBINED_TAX_RATES = [
  { label: "400万円以下", combined: "22.39%", effective: "21.37%" },
  { label: "800万円以下", combined: "24.86%", effective: "23.17%" },
  { label: "800万円超", combined: "36.80%", effective: "33.58%" },
];

// Props interface removed - now uses Zustand store directly

interface TaxCalcSection {
  title: string;
  corporateIncome: number;
  perCapitaLevy: number;
  carryForwardLoss: number;
  taxTotal: number;
}

function formatTaxRate(income: number, taxTotal: number): string {
  if (income <= 0) return "—";
  return (taxTotal / income * 100).toFixed(2);
}

function TaxCalcTable({ title, corporateIncome, perCapitaLevy, carryForwardLoss, taxTotal }: TaxCalcSection) {
  const incomeAfterLoss = corporateIncome - carryForwardLoss;
  const taxExcludingLevy = taxTotal > perCapitaLevy ? taxTotal - perCapitaLevy : 0;
  // 法人税・住民税・事業税 = incomeAfterLoss <= 0 の場合は均等割のみ、それ以外は合計税額
  const taxAndOthers = incomeAfterLoss <= 0 ? perCapitaLevy : taxTotal;

  return (
    <div>
      <h3 className="text-sm font-bold mb-1">{title}</h3>
      <div className="border border-gray-400 w-[320px]">
        {/* ヘッダー */}
        <div className="bg-[#d6e4f7] border-b border-gray-400 px-2 py-0.5 text-xs font-bold">
          会社法人税等
        </div>
        {/* 法人所得金額 */}
        <div className="grid grid-cols-2 border-b border-gray-300">
          <div className="border-r border-gray-300 px-2 py-0.5 text-xs text-center font-bold bg-[#eef4fb]">
            法人所得金額
          </div>
          <div className="px-2 py-0.5 text-xs text-right font-bold">
            {corporateIncome > 0 ? formatYen(corporateIncome) : corporateIncome === 0 ? "" : `△${formatYen(Math.abs(corporateIncome))}`}
          </div>
        </div>
        {/* 均等割 */}
        <div className="grid grid-cols-2 border-b border-gray-300">
          <div className="border-r border-gray-300 px-2 py-0.5 text-xs text-right text-gray-600 bg-[#eef4fb]">
            均等割
          </div>
          <div className="px-2 py-0.5 text-xs text-right">
            {formatYen(perCapitaLevy)}
          </div>
        </div>
        {/* 繰越欠損金 */}
        <div className="grid grid-cols-2 border-b border-gray-300">
          <div className="border-r border-gray-300 px-2 py-0.5 text-xs text-right text-gray-600 bg-[#eef4fb]">
            繰越欠損金
          </div>
          <div className="px-2 py-0.5 text-xs text-right">
            {formatYen(carryForwardLoss)}
          </div>
        </div>
        {/* 法人税、住民税、事業税 */}
        <div className="grid grid-cols-2 border-b border-gray-300">
          <div className="border-r border-gray-300 px-2 py-0.5 text-xs text-right text-gray-600 bg-[#eef4fb]">
            法人税、住民税、事業税
          </div>
          <div className="px-2 py-0.5 text-xs text-right font-bold">
            {formatYen(taxAndOthers)}
          </div>
        </div>
        {/* 空白行 x3 */}
        {[0, 1, 2].map((i) => (
          <div key={i} className="grid grid-cols-2 border-b border-gray-300">
            <div className="border-r border-gray-300 px-2 py-0.5 text-xs bg-[#eef4fb]">&nbsp;</div>
            <div className="px-2 py-0.5 text-xs">&nbsp;</div>
          </div>
        ))}
        {/* 法人税金合計 */}
        <div className="grid grid-cols-2 border-b border-gray-300 bg-[#d6e4f7]">
          <div className="border-r border-gray-300 px-2 py-0.5 text-xs text-center font-bold">
            法人税金合計
          </div>
          <div className="px-2 py-0.5 text-xs text-right font-bold">
            {formatYen(taxTotal)}
          </div>
        </div>
        {/* 対税(%) */}
        <div className="grid grid-cols-2 bg-[#d6e4f7]">
          <div className="border-r border-gray-300 px-2 py-0.5 text-xs text-center font-bold">
            対税 (%)
          </div>
          <div className="px-2 py-0.5 text-xs text-right">
            {formatTaxRate(corporateIncome, taxTotal)}
          </div>
        </div>
      </div>
    </div>
  );
}

export function HojinzeiSheet() {
  const corporateTaxParams = useSimulationStore((s) => s.corporateTaxParams);
  const { corporateIncome: currentCorporateIncome, corporateTax: currentCorporateTax } = useCurrentResults();
  const { corporateIncome: comparisonCorporateIncome, corporateTax: comparisonCorporateTax } = useComparisonResults();
  return (
    <div className="p-6 space-y-8">
      {/* 現状 法人税計算 */}
      <section>
        <div className="flex items-center gap-1 mb-3">
          <span className="text-base font-bold">●現状　法人税計算</span>
        </div>
        <div className="flex gap-8 items-start flex-wrap">
          {/* 左: 計算テーブル */}
          <TaxCalcTable
            title=""
            corporateIncome={currentCorporateIncome}
            perCapitaLevy={corporateTaxParams.perCapitaLevy}
            carryForwardLoss={corporateTaxParams.carryForwardLoss}
            taxTotal={currentCorporateTax}
          />

          {/* 中: 合計税率参照テーブル */}
          <div>
            <div className="text-xs font-bold mb-1">中小企業の法人税合計税率</div>
            <table className="border-collapse text-xs border border-gray-400">
              <thead>
                <tr className="bg-[#d6e4f7]">
                  <th className="border border-gray-400 px-3 py-0.5 text-center">法人所得額</th>
                  <th className="border border-gray-400 px-3 py-0.5 text-center">合計税率</th>
                  <th className="border border-gray-400 px-3 py-0.5 text-center">実効税率</th>
                </tr>
              </thead>
              <tbody>
                {COMBINED_TAX_RATES.map((r) => (
                  <tr key={r.label}>
                    <td className="border border-gray-300 px-3 py-0.5 text-center">{r.label}</td>
                    <td className="border border-gray-300 px-3 py-0.5 text-right">{r.combined}</td>
                    <td className="border border-gray-300 px-3 py-0.5 text-right">{r.effective}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[10px] text-gray-500 mt-1 max-w-[260px]">
              ※実効税率とは、事業税と特別法人事業税の損金算入を考慮した税率です。
            </p>
          </div>

          {/* 右: 税率パラメータテーブル */}
          <div>
            <div className="text-xs font-bold mb-1">令和元年１０月１日以降開始事業年度</div>
            <table className="border-collapse text-xs border border-gray-400">
              <tbody>
                {TAX_RATE_PARAMS.map((p, i) => (
                  <tr key={p.label}>
                    <td className="border border-gray-300 px-2 py-0.5 bg-[#eef4fb]">{p.label}</td>
                    <td className="border border-gray-300 px-2 py-0.5 text-right">{p.value}</td>
                    {i === 4 && (
                      <td className="px-2 py-0.5 text-[10px] text-gray-500">
                        法人税1600万円以上ですが、ここでは考慮していません
                      </td>
                    )}
                    {i !== 4 && <td />}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <hr className="border-gray-300" />

      {/* 役員報酬の変更 法人税計算 */}
      <section>
        <div className="flex items-center gap-1 mb-3">
          <span className="text-base font-bold">●役員報酬の変更　法人税計算</span>
        </div>
        <div className="flex gap-8 items-start flex-wrap">
          <TaxCalcTable
            title=""
            corporateIncome={comparisonCorporateIncome}
            perCapitaLevy={corporateTaxParams.perCapitaLevy}
            carryForwardLoss={corporateTaxParams.carryForwardLoss}
            taxTotal={comparisonCorporateTax}
          />
        </div>
      </section>
    </div>
  );
}
