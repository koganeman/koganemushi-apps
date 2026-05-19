"use client";

import { useShikinGuriStore } from "@/stores/shikin-guri-store";
import { formatYen } from "@/lib/format";
import type { ConsumptionTaxInput } from "@/types/shikin-guri";
import type { TaxForecastResult } from "@/lib/tax-forecast-calc";
import { EditableYenCell } from "./editable-yen-cell";

type Field = keyof ConsumptionTaxInput;

const ROWS: { field: Field; label: string; group?: "+" | "-" }[] = [
  { field: "preTaxProfit", label: "税引前利益" },
  { field: "officerCompensation", label: "役員報酬", group: "+" },
  { field: "otherSalary", label: "その他給与", group: "+" },
  { field: "legalWelfare", label: "法定福利費", group: "+" },
  { field: "depreciation", label: "減価償却費", group: "+" },
  { field: "insurance", label: "保険料", group: "+" },
  { field: "interestPaid", label: "支払利息", group: "+" },
  { field: "otherNonTaxablePurchase", label: "その他非課税仕入れ", group: "+" },
  { field: "interestReceived", label: "受取利息", group: "-" },
  { field: "dividendReceived", label: "受取配当金", group: "-" },
  { field: "otherNonTaxableSales", label: "その他非課税売上", group: "-" },
  {
    field: "prepaidTax",
    label: "期中納付済 消費税 予定納税額（第1期の確定から控除）",
  },
];

function fyLabel(c: { year: number; month: number; day: number }): string {
  return `${c.year}/${c.month}/${c.day} 期`;
}

export function ConsumptionTaxInputTable({
  result,
}: {
  result: TaxForecastResult;
}) {
  const consumptionTax = useShikinGuriStore((s) => s.taxForecast.consumptionTax);
  const setInput = useShikinGuriStore((s) => s.setConsumptionTaxInput);

  return (
    <div className="overflow-auto">
      <h3 className="font-semibold mb-2">
        消費税概算予測{" "}
        <span className="text-xs font-normal text-gray-500">
          （軽減税率・8割特例は考慮していません）
        </span>
      </h3>
      <table className="border-collapse text-xs">
        <thead>
          <tr>
            <th className="border bg-gray-100 px-2 py-1 w-8" />
            <th className="border bg-gray-100 px-2 py-1 text-left min-w-[220px]">
              項目
            </th>
            {result.periods.map((p) => (
              <th
                key={p.periodIndex}
                className="border bg-gray-100 px-2 py-1 text-right min-w-[130px]"
              >
                第{p.periodIndex + 1}期 {fyLabel(p.closing)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r, rowIdx) => (
            <tr key={r.field} className="hover:bg-blue-50/40">
              <td className="border px-1 py-1 text-center text-gray-400">
                {r.group ?? ""}
              </td>
              <td className="border px-2 py-1">{r.label}</td>
              {[0, 1, 2].map((pi) => (
                <td key={pi} className="border p-0 bg-blue-50/30">
                  <EditableYenCell
                    value={consumptionTax[pi][r.field]}
                    onChange={(v) =>
                      setInput(pi as 0 | 1 | 2, { [r.field]: v })
                    }
                    ariaLabel={`第${pi + 1}期 ${r.label}`}
                    enterNavGroup="cons-tax"
                    enterNavRow={rowIdx}
                    enterNavCol={pi}
                  />
                </td>
              ))}
            </tr>
          ))}
          <tr className="bg-yellow-50 font-semibold">
            <td className="border px-1 py-1" />
            <td className="border px-2 py-1">消費税対象額</td>
            {result.periods.map((p) => (
              <td
                key={p.periodIndex}
                className="border px-2 py-1 text-right tabular-nums"
              >
                {formatYen(p.consumptionTaxableBase)}
              </td>
            ))}
          </tr>
          <tr className="bg-yellow-100 font-semibold">
            <td className="border px-1 py-1" />
            <td className="border px-2 py-1">概算消費税額 10%</td>
            {result.periods.map((p) => (
              <td
                key={p.periodIndex}
                className="border px-2 py-1 text-right tabular-nums"
              >
                {formatYen(p.estimatedConsumptionTax)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
