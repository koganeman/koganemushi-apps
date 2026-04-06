"use client";

import { useState } from "react";
import { useHojinnariStore } from "@/stores/hojinnari-store";
import { useShallow } from "zustand/react/shallow";
import { formatYen } from "@/lib/format";
import { Input } from "@/components/ui/input";

function DecisionMeasureYenInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Input
      className="w-full text-right text-xs h-7 px-1"
      value={focused ? (value === 0 ? "" : String(value)) : (value === 0 ? "" : formatYen(value))}
      onChange={(e) => {
        const str = e.target.value.replace(/[^\d]/g, "");
        onChange(str === "" ? 0 : parseInt(str, 10));
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholder="0"
    />
  );
}

export function DecisionMeasuresTable() {
  const { decisionMeasures: measures, setDecisionMeasure: onMeasureChange } = useHojinnariStore(
    useShallow((s) => ({ decisionMeasures: s.decisionMeasures, setDecisionMeasure: s.setDecisionMeasure }))
  );

  const totals = (measures ?? []).reduce(
    (acc, m) => ({
      corporateExpense: acc.corporateExpense + m.corporateExpense,
      taxDeductible: acc.taxDeductible + m.taxDeductible,
      personalIncomeIncrease: acc.personalIncomeIncrease + m.personalIncomeIncrease,
      hiddenAssetIncrease: acc.hiddenAssetIncrease + m.hiddenAssetIncrease,
    }),
    { corporateExpense: 0, taxDeductible: 0, personalIncomeIncrease: 0, hiddenAssetIncrease: 0 }
  );

  const thCls = "py-1.5 px-2 text-center text-xs font-bold text-white bg-[#1f3f7a] border border-gray-400";
  const tdCls = "py-0.5 px-1 border border-gray-300 text-xs";
  const tdBoldCls = "py-1 px-2 text-right text-xs font-bold font-mono border border-gray-300";

  return (
    <div className="bg-white rounded border p-4 space-y-2">
      <h2 className="font-bold text-sm border-b pb-2">法人成り後に実施する決算対策</h2>
      <p className="text-xs text-gray-500">報告書の計算に影響します。</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-xs">
          <thead>
            <tr>
              <th className={`${thCls} text-left w-36`}>項目</th>
              <th className={thCls}>法人支出額</th>
              <th className={thCls}>損金算入額</th>
              <th className={thCls}>個人手取り増加</th>
              <th className={thCls}>法人の簿外資産</th>
            </tr>
          </thead>
          <tbody>
            {(measures ?? []).map((m, i) => (
              <tr key={i} className={i < 4 ? "bg-yellow-50" : ""}>
                <td className={tdCls}>
                  <Input
                    className="w-full text-xs h-7 px-1"
                    value={m.name}
                    onChange={(e) => onMeasureChange(i, { name: e.target.value })}
                    placeholder={i < 4 ? undefined : "項目名"}
                  />
                </td>
                <td className={tdCls}>
                  <DecisionMeasureYenInput
                    value={m.corporateExpense}
                    onChange={(v) => onMeasureChange(i, { corporateExpense: v })}
                  />
                </td>
                <td className={tdCls}>
                  <DecisionMeasureYenInput
                    value={m.taxDeductible}
                    onChange={(v) => onMeasureChange(i, { taxDeductible: v })}
                  />
                </td>
                <td className={tdCls}>
                  <DecisionMeasureYenInput
                    value={m.personalIncomeIncrease}
                    onChange={(v) => onMeasureChange(i, { personalIncomeIncrease: v })}
                  />
                </td>
                <td className={tdCls}>
                  <DecisionMeasureYenInput
                    value={m.hiddenAssetIncrease}
                    onChange={(v) => onMeasureChange(i, { hiddenAssetIncrease: v })}
                  />
                </td>
              </tr>
            ))}
            <tr className="bg-gray-100">
              <td className="py-1 px-2 text-xs font-bold border border-gray-300">合計</td>
              <td className={tdBoldCls}>{totals.corporateExpense > 0 ? formatYen(totals.corporateExpense) : ""}</td>
              <td className={tdBoldCls}>{totals.taxDeductible > 0 ? formatYen(totals.taxDeductible) : ""}</td>
              <td className={tdBoldCls}>{totals.personalIncomeIncrease > 0 ? formatYen(totals.personalIncomeIncrease) : ""}</td>
              <td className={tdBoldCls}>{totals.hiddenAssetIncrease > 0 ? formatYen(totals.hiddenAssetIncrease) : ""}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
