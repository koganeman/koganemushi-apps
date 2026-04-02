"use client";

import { useHojinnariStore } from "@/stores/hojinnari-store";
import { useShallow } from "zustand/react/shallow";
import { calcHojinnari } from "@/lib/hojinnari-calc";
import { formatYen } from "@/lib/format";

function SectionRow({
  label,
  individual,
  corporate,
  bold,
}: {
  label: string;
  individual: number;
  corporate: number;
  bold?: boolean;
}) {
  const diff = corporate - individual;
  return (
    <tr className={`border-b last:border-0 ${bold ? "font-bold bg-gray-50" : ""}`}>
      <td className="py-2 pr-4 text-sm text-gray-700">{label}</td>
      <td className="py-2 px-4 text-right text-sm font-mono">{formatYen(individual)}</td>
      <td className="py-2 px-4 text-right text-sm font-mono">{formatYen(corporate)}</td>
      <td
        className={`py-2 pl-4 text-right text-sm font-mono ${
          diff > 0 ? "text-blue-600" : diff < 0 ? "text-red-600" : "text-gray-400"
        }`}
      >
        {diff > 0 ? "+" : ""}
        {diff !== 0 ? formatYen(diff) : "—"}
      </td>
    </tr>
  );
}

export function HoukokushoSheet() {
  const { input, rates } = useHojinnariStore(
    useShallow((s) => ({ input: s.input, rates: s.rates }))
  );

  const { individual, corporate, difference } = calcHojinnari(input, rates);

  return (
    <div className="p-4">
      <div className="bg-white rounded-lg border p-6 max-w-3xl mx-auto">
        <h2 className="font-bold text-lg mb-1">法人なりシミュレーション 報告書</h2>
        <p className="text-sm text-gray-500 mb-6">
          事業所得 {formatYen(input.businessIncome)} のケース
        </p>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2">
                <th className="text-left py-2 pr-4 text-sm font-medium text-gray-500">項目</th>
                <th className="text-right py-2 px-4 text-sm font-medium text-gray-500">個人事業主</th>
                <th className="text-right py-2 px-4 text-sm font-medium text-gray-500">法人</th>
                <th className="text-right py-2 pl-4 text-sm font-medium text-gray-500">差額</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b bg-gray-50">
                <td className="py-1 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide" colSpan={4}>
                  収入
                </td>
              </tr>
              <SectionRow
                label="事業所得"
                individual={individual.businessIncome}
                corporate={input.corporateSalary + input.spouseSalary + corporate.corporateIncome}
              />
              <tr className="border-b bg-gray-50">
                <td className="py-1 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide" colSpan={4}>
                  控除・費用
                </td>
              </tr>
              <SectionRow
                label="青色申告特別控除"
                individual={individual.blueDeduction}
                corporate={0}
              />
              <SectionRow
                label="専従者給与"
                individual={individual.spouseExpense}
                corporate={input.spouseSalary}
              />
              <SectionRow
                label="給与所得控除（役員）"
                individual={0}
                corporate={input.corporateSalary - corporate.ownerSalaryAfterDeduction}
              />
              <SectionRow
                label="基礎控除"
                individual={individual.basicDeduction}
                corporate={corporate.ownerBasicDeduction}
              />
              <tr className="border-b bg-gray-50">
                <td className="py-1 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide" colSpan={4}>
                  税金・社会保険
                </td>
              </tr>
              <SectionRow
                label="所得税（復興特別税込）"
                individual={individual.incomeTax}
                corporate={corporate.ownerIncomeTax}
              />
              <SectionRow
                label="住民税"
                individual={individual.residentTax}
                corporate={corporate.ownerResidentTax}
              />
              <SectionRow
                label="社会保険料（個人負担）"
                individual={individual.nationalInsurance}
                corporate={corporate.ownerSocialInsurance}
              />
              <SectionRow
                label="法人税"
                individual={0}
                corporate={corporate.corporateTax}
              />
              <SectionRow
                label="法人事業税"
                individual={0}
                corporate={corporate.businessTax}
              />
              <tr className="border-b bg-gray-50">
                <td className="py-1 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide" colSpan={4}>
                  手取り
                </td>
              </tr>
              <SectionRow
                label="法人内部留保"
                individual={0}
                corporate={corporate.corporateRetained}
              />
              <SectionRow
                label="手取り合計"
                individual={individual.netIncome}
                corporate={corporate.totalNetIncome}
                bold
              />
            </tbody>
          </table>
        </div>

        <div
          className={`mt-6 p-4 rounded-lg text-center ${
            difference >= 0 ? "bg-blue-50 border border-blue-200" : "bg-red-50 border border-red-200"
          }`}
        >
          <p className="text-sm text-gray-600">法人なりによる年間手取り増減</p>
          <p
            className={`text-3xl font-bold mt-1 ${
              difference >= 0 ? "text-blue-700" : "text-red-700"
            }`}
          >
            {difference >= 0 ? "+" : ""}
            {formatYen(difference)}
          </p>
          {difference > 0 && (
            <p className="text-sm text-blue-600 mt-1">
              法人なりにより手取りが増加します
            </p>
          )}
          {difference < 0 && (
            <p className="text-sm text-red-600 mt-1">
              現時点では個人事業主の方が有利です
            </p>
          )}
          {difference === 0 && (
            <p className="text-sm text-gray-500 mt-1">
              差はありません
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
