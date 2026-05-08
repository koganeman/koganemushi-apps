"use client";

import type { BSPeriodInput } from "@/types/balance-sheet";
import { formatYen, parseYen } from "@/lib/format";

const ROW_DEFS: {
  label: string;
  field: keyof BSPeriodInput;
  section: "asset" | "liability" | "equity";
}[] = [
  { label: "現預金", field: "cash", section: "asset" },
  { label: "流動資産（現預金除く）", field: "currentAssetsExCash", section: "asset" },
  { label: "固定資産", field: "fixedAssets", section: "asset" },
  { label: "流動負債", field: "currentLiabilities", section: "liability" },
  { label: "固定負債", field: "longTermLiabilities", section: "liability" },
  { label: "純資産", field: "netAssets", section: "equity" },
];

interface Props {
  periods: BSPeriodInput[];
  onChange: (
    index: number,
    field: keyof BSPeriodInput,
    value: number | string,
  ) => void;
}

export function BSInputTable({ periods, onChange }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-sm">
        <thead>
          <tr>
            <th className="border bg-gray-100 px-2 py-1 text-left sticky left-0 z-10 min-w-[200px]">
              項目
            </th>
            {periods.map((p, i) => (
              <th key={i} className="border bg-pink-100 px-2 py-1 text-center min-w-[160px]">
                <div className="flex flex-col items-center gap-1">
                  <input
                    type="text"
                    value={p.periodLabel}
                    onChange={(e) => onChange(i, "periodLabel", e.target.value)}
                    className="bg-transparent w-full text-center font-semibold focus:bg-white focus:outline-blue-400 outline-none rounded px-1"
                  />
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROW_DEFS.map((row) => {
            let rowBg = "";
            if (row.section === "asset") { rowBg = "bg-emerald-50/40"; }
            else if (row.section === "liability") { rowBg = "bg-pink-50/40"; }
            else if (row.section === "equity") { rowBg = "bg-orange-50/40"; }
            return (
              <tr key={row.field} className={rowBg}>
                <td className="border px-2 py-1 sticky left-0 z-10 bg-white">
                  {row.label}
                </td>
                {periods.map((p, i) => (
                  <td key={i} className="border p-0">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatYen(p[row.field] as number)}
                      onChange={(e) => onChange(i, row.field, parseYen(e.target.value))}
                      className="w-full px-2 py-1 text-right bg-transparent focus:bg-white focus:outline-blue-400 outline-none"
                    />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
