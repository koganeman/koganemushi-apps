"use client";

import type { BSDetail } from "@/types/financial-analysis";
import { formatYen, parseYen } from "@/lib/format";

const ROW_DEFS: { label: string; field: keyof BSDetail; hint: string }[] = [
  { label: "売上債権", field: "receivables", hint: "売掛金 + 受取手形" },
  { label: "棚卸資産", field: "inventory", hint: "商品・製品・原材料・仕掛品" },
  { label: "買掛債務", field: "payables", hint: "買掛金 + 支払手形" },
  { label: "借入金合計", field: "totalDebt", hint: "短期 + 長期 + 1年内返済予定（役員借入除く）" },
];

interface Props {
  details: BSDetail[];
  periodLabels: string[];
  onUpdate: (index: number, field: keyof BSDetail, value: number) => void;
}

export function FABSDetailTable({ details, periodLabels, onUpdate }: Props) {
  return (
    <section className="bg-white border rounded-lg p-4 space-y-3">
      <h3 className="text-sm font-bold text-gray-700">B/S詳細入力（円単位）</h3>
      <p className="text-xs text-gray-500">
        ローカルベンチマーク指標の計算に必要な内訳項目。確定申告書PDFには載らないため手入力をお願いします。
      </p>
      <div className="overflow-x-auto">
        <table className="border-collapse text-sm">
          <thead>
            <tr>
              <th className="border bg-gray-100 px-2 py-1 text-left sticky left-0 z-10 min-w-[200px]">
                項目
              </th>
              {periodLabels.map((label, i) => (
                <th key={i} className="border bg-emerald-50 px-2 py-1 text-center min-w-[160px]">
                  {label || `第${5 - i}期`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROW_DEFS.map((row) => (
              <tr key={row.field}>
                <td className="border px-2 py-1 sticky left-0 z-10 bg-white">
                  <div>{row.label}</div>
                  <div className="text-[10px] text-gray-500">{row.hint}</div>
                </td>
                {details.map((d, i) => (
                  <td key={i} className="border p-0">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatYen(d[row.field])}
                      onChange={(e) => onUpdate(i, row.field, parseYen(e.target.value))}
                      className="w-full px-2 py-1 text-right bg-transparent focus:bg-white focus:outline-blue-400 outline-none"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
