"use client";

import { INDICATOR_META } from "@/lib/financial-analysis-calc";

/**
 * 6指標の意味（分類・単位・算式）一覧表。財務分析タブの末尾に参考資料として表示する。
 */
export function FAFormulaTable() {
  return (
    <section className="bg-white border rounded-lg p-4 space-y-2">
      <h3 className="text-sm font-bold text-gray-700">指標の意味（算式）</h3>
      <p className="text-xs text-gray-500">
        経済産業省「ローカルベンチマーク」の指標定義に準拠。
      </p>
      <div className="overflow-x-auto">
        <table className="border-collapse text-xs w-full">
          <thead>
            <tr>
              <th className="border bg-gray-100 px-2 py-1 text-left">指標</th>
              <th className="border bg-gray-100 px-2 py-1 text-left">分類</th>
              <th className="border bg-gray-100 px-2 py-1 text-center">単位</th>
              <th className="border bg-gray-100 px-2 py-1 text-left">算式</th>
            </tr>
          </thead>
          <tbody>
            {INDICATOR_META.map((m) => (
              <tr key={m.key}>
                <td className="border px-2 py-1 font-medium">{m.label}</td>
                <td className="border px-2 py-1">{m.category}</td>
                <td className="border px-2 py-1 text-center">{m.unit}</td>
                <td className="border px-2 py-1 text-gray-700">{m.formula}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
