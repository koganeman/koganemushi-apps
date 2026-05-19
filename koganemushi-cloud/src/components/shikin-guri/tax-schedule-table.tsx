"use client";

import { useShikinGuriStore } from "@/stores/shikin-guri-store";
import { formatYen } from "@/lib/format";
import type { TaxForecastResult } from "@/lib/tax-forecast-calc";
import { EditableYenCell } from "./editable-yen-cell";

const KIND_LABEL: Record<string, string> = {
  kakutei: "確定申告",
  "corp-chukan": "法人税中間",
  "consumption-interim": "消費税中間",
  withholding: "源泉(納期特例)",
};

export function TaxScheduleTable({ result }: { result: TaxForecastResult }) {
  const setWithholdingTax = useShikinGuriStore((s) => s.setWithholdingTax);

  return (
    <div className="overflow-auto">
      <h3 className="font-semibold mb-2">
        納税予定表{" "}
        <span className="text-xs font-normal text-gray-500">
          （資金繰り表の該当月へ加算転記）
        </span>
      </h3>
      <table className="border-collapse text-xs">
        <thead>
          <tr>
            <th className="border bg-gray-100 px-2 py-1 text-left min-w-[110px]">
              納付期限
            </th>
            <th className="border bg-gray-100 px-2 py-1 text-left min-w-[150px]">
              種別
            </th>
            <th className="border bg-gray-100 px-2 py-1 text-right min-w-[120px]">
              法人税等
            </th>
            <th className="border bg-gray-100 px-2 py-1 text-right min-w-[120px]">
              消費税等
            </th>
            <th className="border bg-gray-100 px-2 py-1 text-right min-w-[130px]">
              源泉所得税(納期特例)
            </th>
          </tr>
        </thead>
        <tbody>
          {result.schedule.map((r) => {
            const kinds = r.kinds.filter((k) => k !== "withholding");
            return (
              <tr key={r.month} className="hover:bg-blue-50/40">
                <td className="border px-2 py-1 tabular-nums">
                  {r.date.year}/{r.date.month}/{r.date.day}
                </td>
                <td className="border px-2 py-1 text-gray-600">
                  {kinds.map((k) => KIND_LABEL[k]).join(" + ") || "—"}
                </td>
                <td className="border px-2 py-1 text-right tabular-nums">
                  {r.corporateTaxAmount ? formatYen(r.corporateTaxAmount) : ""}
                </td>
                <td className="border px-2 py-1 text-right tabular-nums">
                  {r.consumptionTaxAmount
                    ? formatYen(r.consumptionTaxAmount)
                    : ""}
                </td>
                {r.isWithholdingInputRow ? (
                  <td className="border p-0 bg-blue-50/40">
                    <EditableYenCell
                      value={r.withholdingTaxAmount}
                      onChange={(v) => setWithholdingTax(r.month, v)}
                      ariaLabel={`${r.month} 源泉所得税(納期特例)`}
                    />
                  </td>
                ) : (
                  <td className="border px-2 py-1 text-right text-gray-300">
                    —
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
