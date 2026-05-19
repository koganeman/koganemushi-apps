"use client";

import { useShikinGuriStore } from "@/stores/shikin-guri-store";
import { formatYen } from "@/lib/format";
import type { TaxForecastResult } from "@/lib/tax-forecast-calc";
import { EditableYenCell } from "./editable-yen-cell";

function fyLabel(c: { year: number; month: number; day: number }): string {
  return `${c.year}/${c.month}/${c.day} 期`;
}

export function CorporateTaxInputTable({
  result,
}: {
  result: TaxForecastResult;
}) {
  const corporateTax = useShikinGuriStore((s) => s.taxForecast.corporateTax);
  const setInput = useShikinGuriStore((s) => s.setCorporateTaxInput);

  return (
    <div className="overflow-auto">
      <h3 className="font-semibold mb-2">法人税概算予測</h3>
      <table className="border-collapse text-xs">
        <thead>
          <tr>
            <th className="border bg-gray-100 px-2 py-1 text-left min-w-[220px]">
              項目
            </th>
            {result.periods.map((p) => (
              <th
                key={p.periodIndex}
                className="border bg-gray-100 px-2 py-1 text-right min-w-[150px]"
              >
                第{p.periodIndex + 1}期 {fyLabel(p.closing)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="hover:bg-blue-50/40">
            <td className="border px-2 py-1">繰越欠損金</td>
            {[0, 1, 2].map((pi) => (
              <td key={pi} className="border p-0 bg-blue-50/30">
                <EditableYenCell
                  value={corporateTax[pi].carryForwardLoss}
                  onChange={(v) =>
                    setInput(pi as 0 | 1 | 2, { carryForwardLoss: v })
                  }
                  ariaLabel={`第${pi + 1}期 繰越欠損金`}
                />
              </td>
            ))}
          </tr>
          <tr className="hover:bg-blue-50/40">
            <td className="border px-2 py-1">
              前期事業税減算
              <span className="block text-[10px] text-gray-500">
                2期目以降は前期事業税額を自動連鎖（手入力で上書き可）
              </span>
            </td>
            {[0, 1, 2].map((pi) => {
              const manual =
                pi === 0 || corporateTax[pi].prevBusinessTaxDeductionManual;
              return (
                <td key={pi} className="border p-0">
                  {manual ? (
                    <EditableYenCell
                      value={
                        pi === 0
                          ? corporateTax[pi].prevBusinessTaxDeduction
                          : corporateTax[pi].prevBusinessTaxDeduction
                      }
                      onChange={(v) =>
                        setInput(pi as 0 | 1 | 2, {
                          prevBusinessTaxDeduction: v,
                        })
                      }
                      bg="bg-blue-50/30"
                      ariaLabel={`第${pi + 1}期 前期事業税減算`}
                    />
                  ) : (
                    <div className="px-2 py-1 text-right tabular-nums text-gray-500">
                      {formatYen(result.periods[pi].resolvedPrevBizTaxDeduction)}
                      <span className="text-[10px]">（自動）</span>
                    </div>
                  )}
                  {pi >= 1 && (
                    <label className="flex items-center gap-1 px-2 pb-1 text-[10px] text-gray-600">
                      <input
                        type="checkbox"
                        checked={corporateTax[pi].prevBusinessTaxDeductionManual}
                        onChange={(e) =>
                          setInput(pi as 0 | 1 | 2, {
                            prevBusinessTaxDeductionManual: e.target.checked,
                          })
                        }
                      />
                      手入力で上書き
                    </label>
                  )}
                </td>
              );
            })}
          </tr>
          <tr className="hover:bg-blue-50/40">
            <td className="border px-2 py-1">住民税均等割</td>
            {[0, 1, 2].map((pi) => (
              <td key={pi} className="border p-0 bg-blue-50/30">
                <EditableYenCell
                  value={corporateTax[pi].perCapitaLevy}
                  onChange={(v) =>
                    setInput(pi as 0 | 1 | 2, { perCapitaLevy: v })
                  }
                  ariaLabel={`第${pi + 1}期 住民税均等割`}
                />
              </td>
            ))}
          </tr>
          <tr className="hover:bg-blue-50/40">
            <td className="border px-2 py-1">
              既納付予定納税（法人税・1期目のみ反映）
            </td>
            {[0, 1, 2].map((pi) => (
              <td key={pi} className="border p-0 bg-blue-50/30">
                <EditableYenCell
                  value={corporateTax[pi].prepaidTax}
                  onChange={(v) =>
                    setInput(pi as 0 | 1 | 2, { prepaidTax: v })
                  }
                  ariaLabel={`第${pi + 1}期 既納付予定納税（法人税）`}
                />
              </td>
            ))}
          </tr>
          {(
            [
              ["法人所得", "corporateIncome"],
              ["法人税額", "corporateTaxAmount"],
              ["地方法人税（法人税額 × 10.4%）", "localCorporateTaxAmount"],
              ["法人住民税（法人税割 7%）", "residentTaxAmount"],
              [
                "防衛特別法人税（法人税額 500万超 × 4%）",
                "defenseTaxAmount",
              ],
              ["事業税額（特別法人事業税込）", "businessTaxAmount"],
              ["年税額", "annualTaxAmount"],
            ] as const
          ).map(([label, key]) => {
            const isAnnual = key === "annualTaxAmount";
            return (
              <tr
                key={key}
                className={
                  isAnnual ? "bg-yellow-100 font-semibold" : "bg-yellow-50"
                }
              >
                <td className="border px-2 py-1">
                  {label}
                  {key === "defenseTaxAmount" && (
                    <span className="block text-[10px] text-gray-500">
                      防衛非適用期は 0
                    </span>
                  )}
                </td>
                {result.periods.map((p) => {
                  const v = p[key];
                  const dim =
                    key === "defenseTaxAmount" && !p.defenseApplied
                      ? "text-gray-400"
                      : "";
                  return (
                    <td
                      key={p.periodIndex}
                      className={`border px-2 py-1 text-right tabular-nums ${dim}`}
                    >
                      {formatYen(v)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
