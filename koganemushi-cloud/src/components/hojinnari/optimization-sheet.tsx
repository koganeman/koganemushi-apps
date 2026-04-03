"use client";

import { useHojinnariStore } from "@/stores/hojinnari-store";
import { useShallow } from "zustand/react/shallow";
import {
  optimizePlan2Salary,
  findOptimalPlan2Salary,
  calcPlan1,
  calcPlan2,
} from "@/lib/hojinnari-calc";
import { formatYen, parseYen } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function YenInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <Input
      className="w-full text-right text-sm h-7 px-2"
      value={value === 0 ? "" : formatYen(value)}
      onChange={(e) => onChange(Number(parseYen(e.target.value)) || 0)}
      placeholder="0"
    />
  );
}

export function OptimizationSheet() {
  const { input, rates, setInput } = useHojinnariStore(
    useShallow((s) => ({ input: s.input, rates: s.rates, setInput: s.setInput }))
  );

  if (input.businessIncome <= 0) {
    return (
      <div className="p-8 text-center text-gray-500 text-sm">
        シミュレーションタブで事業所得を入力してください。
      </div>
    );
  }

  // PLAN2 最適化
  const plan2Points = optimizePlan2Salary(input, rates, 1000000);
  const optimalPlan2Salary = findOptimalPlan2Salary(input, rates, 1000000);
  const plan2MaxNet = plan2Points.reduce((m, p) => Math.max(m, p.totalNetIncome), -Infinity);

  // PLAN1 最適化（移転売上を変化させる）
  const plan1Points: Array<{
    microRevenue: number;
    combinedNetIncome: number;
    ownerNetIncome: number;
    corporateRetained: number;
  }> = [];
  const step = 1000000;
  for (let rev = 0; rev <= input.businessIncome; rev += step) {
    const modified = { ...input, plan1MicroRevenue: rev };
    const r = calcPlan1(modified, rates);
    plan1Points.push({
      microRevenue: rev,
      combinedNetIncome: r.combinedNetIncome,
      ownerNetIncome: r.ownerNetIncome,
      corporateRetained: r.corporateRetained,
    });
  }
  const plan1MaxNet = plan1Points.reduce((m, p) => Math.max(m, p.combinedNetIncome), -Infinity);
  const optimalPlan1Rev = plan1Points.reduce((best, p) =>
    p.combinedNetIncome > best.combinedNetIncome ? p : best
  ).microRevenue;

  return (
    <div className="p-4 space-y-4">
      {/* PLAN2 最適化 */}
      <div className="bg-white rounded border p-4 space-y-3">
        <h2 className="font-bold text-sm border-b pb-2">
          <span className="inline-block bg-orange-500 text-white text-xs px-2 py-0.5 rounded mr-2">PLAN2</span>
          完全法人成り — 役員報酬の最適化
        </h2>
        <p className="text-xs text-gray-500">
          今、完全法人化するといくら役員報酬を取れば手取りが最大になるか
        </p>

        <div className="flex flex-wrap gap-4 items-end mb-2">
          <div>
            <p className="text-xs text-gray-500">最適役員報酬</p>
            <p className="text-xl font-bold text-orange-600">{formatYen(optimalPlan2Salary)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">そのときの合算手取り</p>
            <p className="text-xl font-bold">{formatYen(plan2MaxNet)}</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setInput({ plan2Salary: optimalPlan2Salary })}
          >
            PLAN2に適用
          </Button>
        </div>
        <p className="text-xs text-gray-400">※ 100万円刻みで試算。実際の最適値はこの前後にある場合があります。</p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-xs">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-right py-1 px-2 font-medium text-gray-500 border-r">役員報酬</th>
                <th className="text-right py-1 px-2 font-medium text-gray-500 border-r">役員手取り</th>
                <th className="text-right py-1 px-2 font-medium text-gray-500 border-r">法人内部留保</th>
                <th className="text-right py-1 px-2 font-medium text-gray-500">合算CF手取り</th>
              </tr>
            </thead>
            <tbody>
              {plan2Points.map((p) => {
                const isOptimal = p.totalNetIncome === plan2MaxNet;
                const isCurrent = p.salary === input.plan2Salary;
                return (
                  <tr
                    key={p.salary}
                    className={`border-b ${isOptimal ? "bg-orange-50 font-bold" : ""} ${isCurrent ? "bg-blue-50" : ""}`}
                  >
                    <td className="py-1 px-2 text-right font-mono border-r">
                      {formatYen(p.salary)}
                      {isOptimal && <span className="ml-1 text-orange-600 text-[10px]">★最適</span>}
                    </td>
                    <td className="py-1 px-2 text-right font-mono border-r">{formatYen(p.ownerNetIncome)}</td>
                    <td className="py-1 px-2 text-right font-mono border-r">{formatYen(p.corporateRetained)}</td>
                    <td className={`py-1 px-2 text-right font-mono ${isOptimal ? "text-orange-700" : ""}`}>
                      {formatYen(p.totalNetIncome)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* PLAN1 最適化 */}
      <div className="bg-white rounded border p-4 space-y-3">
        <h2 className="font-bold text-sm border-b pb-2">
          <span className="inline-block bg-blue-600 text-white text-xs px-2 py-0.5 rounded mr-2">PLAN1</span>
          マイクロ法人成り — 移転売上の最適化
        </h2>
        <p className="text-xs text-gray-500">
          法人に移転する売上をいくらにすれば合算手取りが最大になるか
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-2">
          <div>
            <p className="text-xs text-gray-500 mb-1">役員報酬（固定）</p>
            <YenInput
              value={input.plan1MicroSalary}
              onChange={(v) => setInput({ plan1MicroSalary: v })}
            />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">配偶者給与（固定）</p>
            <YenInput
              value={input.plan1SpouseSalary}
              onChange={(v) => setInput({ plan1SpouseSalary: v })}
            />
          </div>
          <div className="flex flex-col justify-end">
            <p className="text-xs text-gray-500">最適移転売上</p>
            <p className="text-lg font-bold text-blue-700">{formatYen(optimalPlan1Rev)}</p>
          </div>
          <div className="flex flex-col justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setInput({ plan1MicroRevenue: optimalPlan1Rev })}
            >
              PLAN1に適用
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-xs">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-right py-1 px-2 font-medium text-gray-500 border-r">法人移転売上</th>
                <th className="text-right py-1 px-2 font-medium text-gray-500 border-r">役員手取り</th>
                <th className="text-right py-1 px-2 font-medium text-gray-500 border-r">法人内部留保</th>
                <th className="text-right py-1 px-2 font-medium text-gray-500">合算CF手取り</th>
              </tr>
            </thead>
            <tbody>
              {plan1Points.map((p) => {
                const isOptimal = p.combinedNetIncome === plan1MaxNet;
                const isCurrent = p.microRevenue === input.plan1MicroRevenue;
                return (
                  <tr
                    key={p.microRevenue}
                    className={`border-b ${isOptimal ? "bg-blue-50 font-bold" : ""} ${isCurrent ? "bg-yellow-50" : ""}`}
                  >
                    <td className="py-1 px-2 text-right font-mono border-r">
                      {formatYen(p.microRevenue)}
                      {isOptimal && <span className="ml-1 text-blue-600 text-[10px]">★最適</span>}
                    </td>
                    <td className="py-1 px-2 text-right font-mono border-r">{formatYen(p.ownerNetIncome)}</td>
                    <td className="py-1 px-2 text-right font-mono border-r">{formatYen(p.corporateRetained)}</td>
                    <td className={`py-1 px-2 text-right font-mono ${isOptimal ? "text-blue-700" : ""}`}>
                      {formatYen(p.combinedNetIncome)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 比較サマリー */}
      <div className="bg-white rounded border p-4">
        <h3 className="font-bold text-sm mb-3">現在の設定での比較</h3>
        <div className="grid grid-cols-3 gap-3 text-center text-sm">
          {[
            { label: "PLAN1 合算CF", value: calcPlan1(input, rates).combinedNetIncome, color: "blue" },
            { label: "PLAN2 合算CF", value: calcPlan2(input, rates).combinedNetIncome, color: "orange" },
            { label: "有利プラン", value: calcPlan1(input, rates).combinedNetIncome >= calcPlan2(input, rates).combinedNetIncome ? "PLAN1" : "PLAN2", isText: true, color: "gray" },
          ].map((item, i) => (
            <div key={i} className="border rounded p-3">
              <p className="text-xs text-gray-500">{item.label}</p>
              {item.isText ? (
                <p className="text-lg font-bold text-gray-700">{item.value}</p>
              ) : (
                <p className={`text-lg font-bold text-${item.color}-700`}>{formatYen(item.value as number)}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
