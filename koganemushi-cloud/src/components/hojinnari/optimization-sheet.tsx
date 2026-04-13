"use client";

import { useHojinnariStore } from "@/stores/hojinnari-store";
import { useShallow } from "zustand/react/shallow";
import {
  optimizePlan2Salary,
  calcPlan1,
  calcIndividual,
} from "@/lib/hojinnari-calc";
import { formatYen, parseYen } from "@/lib/format";
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

  // 現在の個人手取額
  const individual = calcIndividual(input);
  const currentNetIncome = individual.netIncome;

  // PLAN1（完全法人成り）最適化: 役員報酬を変化させる
  const plan2Points = optimizePlan2Salary(input, rates, 1000000);

  // PLAN2（マイクロ法人成り）最適化: 法人移転売上は固定、役員報酬を変化させる
  const plan1Points: Array<{
    salary: number;
    combinedNetIncome: number;
    ownerNetIncome: number;
    corporateRetained: number;
  }> = [];
  const step = 1000000;
  const microRevenue = input.plan1MicroRevenue;
  for (let sal = 0; sal <= input.businessIncome; sal += step) {
    const modified = { ...input, plan1MicroSalary: sal };
    const r = calcPlan1(modified, rates);
    plan1Points.push({
      salary: sal,
      combinedNetIncome: r.combinedNetIncome,
      ownerNetIncome: r.ownerNetIncome,
      corporateRetained: r.corporateRetained,
    });
  }

  return (
    <div className="p-4 space-y-4">
      {/* PLAN1 完全法人成り 最適化 */}
      <div className="bg-white rounded border p-4 space-y-3">
        <h2 className="font-bold text-sm border-b pb-2">
          <span className="inline-block bg-orange-500 text-white text-xs px-2 py-0.5 rounded mr-2">PLAN1</span>
          完全法人成り — 役員報酬の最適化
        </h2>
        <p className="text-xs text-gray-500">
          今、法人成りするといくら役員報酬がもらえるか？
        </p>

        <div className="flex flex-wrap gap-4 items-end mb-2">
          <div>
            <p className="text-xs text-gray-500">現在の個人手取額</p>
            <p className="text-xl font-bold text-gray-700">{formatYen(currentNetIncome)}</p>
          </div>
        </div>
        <p className="text-xs text-gray-400">※ 100万円刻みで試算</p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-xs">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-right py-1 px-2 font-medium text-gray-500 border-r">役員報酬</th>
                <th className="text-right py-1 px-2 font-medium text-gray-500 border-r">役員手取り</th>
                <th className="text-right py-1 px-2 font-medium text-gray-500 border-r">法人内部留保</th>
                <th className="text-right py-1 px-2 font-medium text-gray-500 border-r">合算CF手取り</th>
                <th className="text-right py-1 px-2 font-medium text-gray-500">現在との比較</th>
              </tr>
            </thead>
            <tbody>
              {plan2Points.map((p) => {
                const diff = p.totalNetIncome - currentNetIncome;
                return (
                  <tr
                    key={p.salary}
                    className={`border-b ${p.salary === input.plan2Salary ? "bg-blue-50" : ""}`}
                  >
                    <td className="py-1 px-2 text-right font-mono border-r">{formatYen(p.salary)}</td>
                    <td className="py-1 px-2 text-right font-mono border-r">{formatYen(p.ownerNetIncome)}</td>
                    <td className={`py-1 px-2 text-right font-mono border-r ${p.corporateRetained < 0 ? "text-red-600" : ""}`}>
                      {formatYen(p.corporateRetained)}
                    </td>
                    <td className="py-1 px-2 text-right font-mono border-r">{formatYen(p.totalNetIncome)}</td>
                    <td className={`py-1 px-2 text-right font-mono ${diff >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {diff >= 0 ? "+" : ""}{formatYen(diff)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* PLAN1 コメント */}
        {(() => {
          const best = plan2Points.reduce((a, b) =>
            (b.totalNetIncome - currentNetIncome) > (a.totalNetIncome - currentNetIncome) ? b : a
          );
          const bestDiff = best.totalNetIncome - currentNetIncome;
          const ownerDiff = best.ownerNetIncome - currentNetIncome;
          // 役員手取り >= 現在の個人手取額 かつ 合算CFがプラスになるケース
          const maintained = plan2Points.filter(
            (p) => p.ownerNetIncome >= currentNetIncome && p.totalNetIncome > currentNetIncome
          );
          // その中で合算CF差額が最大のもの
          const bestMaintained = maintained.length > 0
            ? maintained.reduce((a, b) =>
                (b.totalNetIncome - currentNetIncome) > (a.totalNetIncome - currentNetIncome) ? b : a
              )
            : null;
          return (
            <div className="bg-orange-50 border border-orange-200 rounded p-3 text-sm space-y-1">
              <p>
                合算CF手取りの現在との比較が最大になるのは、役員報酬
                <span className="font-bold text-orange-700"> {formatYen(best.salary)} </span>
                のときで、現在より
                <span className={`font-bold ${bestDiff >= 0 ? "text-green-700" : "text-red-600"}`}>
                  {" "}{bestDiff >= 0 ? "+" : ""}{formatYen(bestDiff)}
                </span>
                {bestDiff >= 0 ? " 有利" : " 不利"}になります。
              </p>
              <p>
                ただし、その場合の役員手取りは
                <span className="font-bold"> {formatYen(best.ownerNetIncome)} </span>
                となり、現在の個人手取額と比べると
                <span className={`font-bold ${ownerDiff >= 0 ? "text-green-700" : "text-red-600"}`}>
                  {" "}{ownerDiff >= 0 ? "+" : ""}{formatYen(ownerDiff)}
                </span>
                {ownerDiff < 0 ? "（個人の手取りは減少します）" : ""}。
              </p>
              {bestMaintained ? (
                <p>
                  現在の手取りを維持しつつ合算CFがプラスになるのは、役員報酬
                  <span className="font-bold text-orange-700"> {formatYen(bestMaintained.salary)} </span>
                  のときで、合算CF差額は
                  <span className="font-bold text-green-700">
                    {" "}+{formatYen(bestMaintained.totalNetIncome - currentNetIncome)}
                  </span>
                  です。
                </p>
              ) : (
                <p className="text-red-600">
                  現在の手取りを維持しつつ合算CFがプラスになる役員報酬額はありません。
                </p>
              )}
            </div>
          );
        })()}
      </div>

      {/* PLAN2 マイクロ法人成り 最適化 */}
      <div className="bg-white rounded border p-4 space-y-3">
        <h2 className="font-bold text-sm border-b pb-2">
          <span className="inline-block bg-blue-600 text-white text-xs px-2 py-0.5 rounded mr-2">PLAN2</span>
          マイクロ法人成り — 移転売上の最適化
        </h2>
        <p className="text-xs text-gray-500">
          マイクロ法人成り　役員報酬をどれだけ抑えれば有利なのか？
        </p>

        <div className="flex flex-wrap gap-4 items-end mb-2">
          <div>
            <p className="text-xs text-gray-500">現在の個人手取額</p>
            <p className="text-xl font-bold text-gray-700">{formatYen(currentNetIncome)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">法人移転売上（固定）</p>
            <YenInput
              value={input.plan1MicroRevenue}
              onChange={(v) => setInput({ plan1MicroRevenue: v })}
            />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">配偶者給与（固定）</p>
            <YenInput
              value={input.plan1SpouseSalary}
              onChange={(v) => setInput({ plan1SpouseSalary: v })}
            />
          </div>
        </div>
        <p className="text-xs text-gray-400">※ 100万円刻みで試算</p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-xs">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-right py-1 px-2 font-medium text-gray-500 border-r">役員報酬</th>
                <th className="text-right py-1 px-2 font-medium text-gray-500 border-r">役員手取り</th>
                <th className="text-right py-1 px-2 font-medium text-gray-500 border-r">法人内部留保</th>
                <th className="text-right py-1 px-2 font-medium text-gray-500 border-r">合算CF手取り</th>
                <th className="text-right py-1 px-2 font-medium text-gray-500">現在との比較</th>
              </tr>
            </thead>
            <tbody>
              {plan1Points.map((p) => {
                const diff = p.combinedNetIncome - currentNetIncome;
                return (
                  <tr
                    key={p.salary}
                    className={`border-b ${p.salary === input.plan1MicroSalary ? "bg-blue-50" : ""}`}
                  >
                    <td className="py-1 px-2 text-right font-mono border-r">{formatYen(p.salary)}</td>
                    <td className="py-1 px-2 text-right font-mono border-r">{formatYen(p.ownerNetIncome)}</td>
                    <td className={`py-1 px-2 text-right font-mono border-r ${p.corporateRetained < 0 ? "text-red-600" : ""}`}>
                      {formatYen(p.corporateRetained)}
                    </td>
                    <td className="py-1 px-2 text-right font-mono border-r">{formatYen(p.combinedNetIncome)}</td>
                    <td className={`py-1 px-2 text-right font-mono ${diff >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {diff >= 0 ? "+" : ""}{formatYen(diff)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* PLAN2 コメント */}
        {(() => {
          const best = plan1Points.reduce((a, b) =>
            (b.combinedNetIncome - currentNetIncome) > (a.combinedNetIncome - currentNetIncome) ? b : a
          );
          const bestDiff = best.combinedNetIncome - currentNetIncome;
          const ownerDiff = best.ownerNetIncome - currentNetIncome;
          // 役員手取り >= 現在の個人手取額 かつ 合算CFがプラスになるケース
          const maintained = plan1Points.filter(
            (p) => p.ownerNetIncome >= currentNetIncome && p.combinedNetIncome > currentNetIncome
          );
          const bestMaintained = maintained.length > 0
            ? maintained.reduce((a, b) =>
                (b.combinedNetIncome - currentNetIncome) > (a.combinedNetIncome - currentNetIncome) ? b : a
              )
            : null;
          return (
            <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm space-y-1">
              <p>
                合算CF手取りの現在との比較が最大になるのは、役員報酬
                <span className="font-bold text-blue-700"> {formatYen(best.salary)} </span>
                のときで、現在より
                <span className={`font-bold ${bestDiff >= 0 ? "text-green-700" : "text-red-600"}`}>
                  {" "}{bestDiff >= 0 ? "+" : ""}{formatYen(bestDiff)}
                </span>
                {bestDiff >= 0 ? " 有利" : " 不利"}になります。
              </p>
              <p>
                ただし、その場合の役員手取りは
                <span className="font-bold"> {formatYen(best.ownerNetIncome)} </span>
                となり、現在の個人手取額と比べると
                <span className={`font-bold ${ownerDiff >= 0 ? "text-green-700" : "text-red-600"}`}>
                  {" "}{ownerDiff >= 0 ? "+" : ""}{formatYen(ownerDiff)}
                </span>
                {ownerDiff < 0 ? "（個人の手取りは減少します）" : ""}。
              </p>
              {bestMaintained ? (
                <p>
                  現在の手取りを維持しつつ合算CFがプラスになるのは、役員報酬
                  <span className="font-bold text-blue-700"> {formatYen(bestMaintained.salary)} </span>
                  のときで、合算CF差額は
                  <span className="font-bold text-green-700">
                    {" "}+{formatYen(bestMaintained.combinedNetIncome - currentNetIncome)}
                  </span>
                  です。
                </p>
              ) : (
                <p className="text-red-600">
                  現在の手取りを維持しつつ合算CFがプラスになる役員報酬額はありません。
                </p>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
