"use client";

import { useHojinnariStore } from "@/stores/hojinnari-store";
import { useShallow } from "zustand/react/shallow";
import {
  optimizeCorporateSalary,
  findOptimalSalary,
} from "@/lib/hojinnari-calc";
import { formatYen } from "@/lib/format";
import { Button } from "@/components/ui/button";

export function OptimizationSheet() {
  const { input, rates, setInput } = useHojinnariStore(
    useShallow((s) => ({ input: s.input, rates: s.rates, setInput: s.setInput }))
  );

  const points = optimizeCorporateSalary(input, rates, 1000000);
  const optimalSalary = findOptimalSalary(input, rates, 1000000);
  const maxTotalNet = points.reduce(
    (max, p) => Math.max(max, p.totalNetIncome),
    -Infinity
  );

  function applyOptimal() {
    setInput({ corporateSalary: optimalSalary });
  }

  if (input.businessIncome <= 0) {
    return (
      <div className="p-8 text-center text-gray-500 text-sm">
        シミュレーションタブで事業所得を入力してください。
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {/* 最適値サマリー */}
      <div className="bg-white rounded-lg border p-4">
        <h2 className="font-bold text-base border-b pb-2 mb-3">最適役員給与の探索</h2>
        <div className="flex flex-wrap gap-6 items-end">
          <div>
            <p className="text-xs text-gray-500">最適役員給与（手取り最大）</p>
            <p className="text-2xl font-bold text-blue-700">{formatYen(optimalSalary)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">その時の手取り合計</p>
            <p className="text-2xl font-bold">{formatYen(maxTotalNet)}</p>
          </div>
          <Button onClick={applyOptimal} variant="default" size="sm">
            この値を適用
          </Button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          ※ 100万円刻みで試算しています。実際の最適値はこの前後にある場合があります。
        </p>
      </div>

      {/* 試算テーブル */}
      <div className="bg-white rounded-lg border p-4">
        <h2 className="font-bold text-base border-b pb-2 mb-3">役員給与別 手取りシミュレーション</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px]">
            <thead>
              <tr className="border-b">
                <th className="text-right py-1.5 pr-4 text-xs text-gray-500 font-medium">役員給与</th>
                <th className="text-right py-1.5 px-4 text-xs text-gray-500 font-medium">役員手取り</th>
                <th className="text-right py-1.5 px-4 text-xs text-gray-500 font-medium">内部留保</th>
                <th className="text-right py-1.5 pl-4 text-xs text-gray-500 font-medium">手取り合計</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr
                  key={p.salary}
                  className={`border-b last:border-0 ${
                    p.salary === input.corporateSalary ? "bg-blue-50" : ""
                  } ${p.totalNetIncome === maxTotalNet ? "font-bold" : ""}`}
                >
                  <td className="py-1.5 pr-4 text-right text-sm font-mono">
                    {formatYen(p.salary)}
                    {p.totalNetIncome === maxTotalNet && (
                      <span className="ml-1 text-xs text-blue-600">★最適</span>
                    )}
                  </td>
                  <td className="py-1.5 px-4 text-right text-sm font-mono">
                    {formatYen(p.ownerNetIncome)}
                  </td>
                  <td className="py-1.5 px-4 text-right text-sm font-mono">
                    {formatYen(p.corporateRetained)}
                  </td>
                  <td
                    className={`py-1.5 pl-4 text-right text-sm font-mono ${
                      p.totalNetIncome === maxTotalNet ? "text-blue-700" : ""
                    }`}
                  >
                    {formatYen(p.totalNetIncome)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
