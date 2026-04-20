"use client";

import { useCallback } from "react";
import type { ExecutiveInput, ExecutiveResult } from "@/types/simulation";
import { Checkbox } from "@/components/ui/checkbox";
import { formatYen, parseYen } from "@/lib/format";
import { useSimulationStore } from "@/stores/simulation-store";
import { useCurrentResults, useComparisonResults } from "@/hooks/use-computed-results";

/** 行定義 */
interface RowDef {
  label: string;
  key: "input" | "computed" | "checkbox";
  field?: keyof ExecutiveInput;
  resultField?: keyof ExecutiveResult;
  inputBg?: string;
  boldLabel?: boolean;
}

const rows: RowDef[] = [
  { label: "役員名", key: "input", field: "name" },
  { label: "年齢", key: "input", field: "age" },
  { label: "定期同額", key: "input", field: "regularSalary", inputBg: "bg-yellow-50" },
  { label: "変更前月額", key: "input", field: "preChangeMonthlyRemuneration", inputBg: "bg-yellow-50" },
  { label: "変更後月額", key: "input", field: "postChangeMonthlyRemuneration", inputBg: "bg-yellow-50" },
  { label: "改定月", key: "input", field: "standardRemunerationChangeMonth", inputBg: "bg-yellow-50" },
  { label: "事前確定給与1回目", key: "input", field: "predeterminedBonus1", inputBg: "bg-yellow-50" },
  { label: "事前確定給与2回目", key: "input", field: "predeterminedBonus2", inputBg: "bg-yellow-50" },
  { label: "事前確定給与3回目", key: "input", field: "predeterminedBonus3", inputBg: "bg-yellow-50" },
  { label: "他の給与収入", key: "input", field: "otherSalaryIncome", inputBg: "bg-yellow-50" },
  { label: "確定給付年金掛金", key: "input", field: "definedBenefitPension", inputBg: "bg-yellow-50" },
  { label: "給与所得金額", key: "computed", resultField: "salaryIncomeAfterDeduction" },
  { label: "配当所得", key: "input", field: "dividendIncome", inputBg: "bg-orange-50" },
  { label: "他の所得金額", key: "input", field: "otherIncome", inputBg: "bg-orange-50" },
  { label: "社会保険料控除額", key: "computed", resultField: "socialInsuranceDeduction" },
  { label: "他の所得控除額", key: "input", field: "otherDeductions", inputBg: "bg-yellow-50" },
  { label: "基礎控除額", key: "computed", resultField: "basicDeduction" },
  { label: "課税所得金額", key: "computed", resultField: "taxableIncome" },
  { label: "所得税", key: "computed", resultField: "incomeTax" },
  { label: "配当控除額", key: "computed", resultField: "dividendCreditIncomeTax" },
  { label: "税額控除", key: "input", field: "taxCredit", inputBg: "bg-yellow-50" },
  { label: "住民税", key: "computed", resultField: "residentTax" },
  { label: "配当控除額", key: "computed", resultField: "dividendCreditResidentTax" },
  { label: "個人税金合計", key: "computed", resultField: "totalPersonalTax", boldLabel: true },
  { label: "健康保険料", key: "computed", resultField: "healthInsurance" },
  { label: "厚生年金保険料", key: "computed", resultField: "pensionInsurance" },
  { label: "社会保険料計", key: "computed", resultField: "totalSocialInsurance", boldLabel: true },
  { label: "税金＋社会保険料", key: "computed", resultField: "totalTaxAndInsurance", boldLabel: true },
  { label: "手取り額", key: "computed", resultField: "netIncome", boldLabel: true },
  { label: "会社負担社会保険料", key: "computed", resultField: "employerSocialInsurance" },
  { label: "社会保険料合計", key: "computed", resultField: "totalSocialInsuranceCombined", boldLabel: true },
];

export type ExecutiveTablePlan = "current" | "comparison";

interface ExecutiveTableProps {
  plan: ExecutiveTablePlan;
  visibleCount?: number;
}

interface CellContext {
  exec: ExecutiveInput;
  result: ExecutiveResult | undefined;
  index: number;
  updateField: (i: number, field: keyof ExecutiveInput, v: string | number | boolean) => void;
}

/** 健保任意入力セル */
function renderManualHealthCell(ctx: CellContext): React.ReactNode {
  return (
    <td key={ctx.index} className="border px-0 py-0 bg-yellow-50">
      <CellInput
        value={ctx.exec.manualHealthInsuranceAmount}
        onChange={(v) => ctx.updateField(ctx.index, "manualHealthInsuranceAmount", v)}
        bg="bg-yellow-50"
      />
    </td>
  );
}

/** 入力セル */
function renderInputCell(row: RowDef, ctx: CellContext): React.ReactNode {
  const field = row.field!;
  return (
    <td key={ctx.index} className={`border px-0 py-0 ${row.inputBg ?? ""}`}>
      <CellInput
        value={ctx.exec[field] as string | number}
        onChange={(v) => ctx.updateField(ctx.index, field, v)}
        isName={field === "name"}
        isAge={field === "age"}
        isMonth={field === "standardRemunerationChangeMonth"}
        bg={row.inputBg}
      />
    </td>
  );
}

/** 計算結果セル */
function renderComputedCell(row: RowDef, ctx: CellContext): React.ReactNode {
  const val = ctx.result![row.resultField!] as number;
  const bgClass = row.resultField === "netIncome" ? "bg-green-50 font-bold" : "bg-blue-50";
  return (
    <td key={ctx.index} className={`border px-1 py-0.5 text-right ${bgClass}`}>
      {val !== 0 ? formatYen(val) : ""}
    </td>
  );
}

/** 健康保険任意入力判定 */
function isManualHealthRow(row: RowDef, exec: ExecutiveInput): boolean {
  return row.resultField === "healthInsurance" &&
    exec.manualHealthInsurance && exec.socialInsuranceEnrolled;
}

/** 各役員セルのレンダリング */
function renderExecCell(row: RowDef, ctx: CellContext): React.ReactNode {
  if (isManualHealthRow(row, ctx.exec)) { return renderManualHealthCell(ctx); }
  if (row.key === "input" && row.field) { return renderInputCell(row, ctx); }
  if (row.key === "computed" && row.resultField && ctx.result) { return renderComputedCell(row, ctx); }
  return <td key={ctx.index} className="border px-1 py-0.5" />;
}

function CellInput({
  value,
  onChange,
  isName,
  isAge,
  isMonth,
  bg,
}: {
  value: string | number;
  onChange: (v: string | number) => void;
  isName?: boolean;
  isAge?: boolean;
  isMonth?: boolean;
  bg?: string;
}) {
  if (isName) {
    return (
      <input
        type="text"
        className={`w-full px-1 py-0.5 text-sm border-0 focus:outline-none focus:ring-1 focus:ring-blue-400 ${bg ?? ""}`}
        value={value as string}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (isAge || isMonth) {
    const min = isMonth ? 1 : 0;
    const max = isMonth ? 13 : undefined;
    return (
      <input
        type="number"
        min={min}
        max={max}
        className={`w-full px-1 py-0.5 text-sm text-right border-0 focus:outline-none focus:ring-1 focus:ring-blue-400 ${bg ?? ""}`}
        value={value === 0 ? "" : value}
        onChange={(e) => {
          const n = parseInt(e.target.value) || 0;
          if (isMonth) {
            onChange(Math.min(13, Math.max(1, n || 1)));
          } else {
            onChange(n);
          }
        }}
      />
    );
  }

  // 金額入力
  return (
    <input
      type="text"
      className={`w-full px-1 py-0.5 text-sm text-right border-0 focus:outline-none focus:ring-1 focus:ring-blue-400 ${bg ?? ""}`}
      defaultValue={value === 0 ? "" : formatYen(value as number)}
      onBlur={(e) => onChange(parseYen(e.target.value))}
      key={String(value)}
    />
  );
}

export function ExecutiveTable({
  plan,
  visibleCount = 10,
}: ExecutiveTableProps) {
  const executives = useSimulationStore((s) =>
    plan === "current" ? s.currentExecutives : s.comparisonExecutives
  );
  const updateExecutive = useSimulationStore((s) =>
    plan === "current" ? s.updateCurrentExecutive : s.updateComparisonExecutive
  );
  const currentData = useCurrentResults();
  const comparisonData = useComparisonResults();
  const { results, totals } = plan === "current" ? currentData : comparisonData;

  const updateField = useCallback(
    (index: number, field: keyof ExecutiveInput, value: string | number | boolean) => {
      const updated = { ...executives[index], [field]: value };
      updateExecutive(index, updated);
    },
    [executives, updateExecutive]
  );

  const visible = executives.slice(0, visibleCount);

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-xs w-full">
        <thead>
          {/* 加入チェックボックス行 */}
          <tr className="border-b">
            <th className="sticky left-0 bg-white z-10 border px-2 py-1 text-left w-36 min-w-36">
              <span className="text-xs font-bold">社会保険</span>
            </th>
            {visible.map((exec, i) => (
              <th key={i} className="border px-1 py-1 text-center min-w-24">
                <div className="flex items-center justify-center gap-1">
                  <Checkbox
                    checked={exec.socialInsuranceEnrolled}
                    onCheckedChange={(checked) =>
                      updateField(i, "socialInsuranceEnrolled", !!checked)
                    }
                    className="h-3.5 w-3.5"
                  />
                  <span className="text-xs">加入</span>
                </div>
              </th>
            ))}
            <th className="border px-2 py-1 text-center font-bold bg-green-50 min-w-28">
              合計
            </th>
          </tr>
          {/* 子育て等チェックボックス行 */}
          <tr className="border-b">
            <th className="sticky left-0 bg-white z-10 border px-2 py-1 text-left w-36 min-w-36">
              <span className="text-xs text-gray-600">子育て等</span>
            </th>
            {visible.map((exec, i) => (
              <th key={i} className="border px-1 py-1 text-center">
                <Checkbox
                  checked={exec.childcareHousehold}
                  onCheckedChange={(checked) =>
                    updateField(i, "childcareHousehold", !!checked)
                  }
                  className="h-3.5 w-3.5"
                />
              </th>
            ))}
            <th className="border px-2 py-1 bg-green-50" />
          </tr>
          {/* 健保任意入力チェックボックス行 */}
          <tr className="border-b">
            <th className="sticky left-0 bg-white z-10 border px-2 py-1 text-left w-36 min-w-36">
              <span className="text-xs text-gray-600">健保任意入力</span>
            </th>
            {visible.map((exec, i) => (
              <th key={i} className="border px-1 py-1 text-center">
                <Checkbox
                  checked={exec.manualHealthInsurance}
                  onCheckedChange={(checked) =>
                    updateField(i, "manualHealthInsurance", !!checked)
                  }
                  className="h-3.5 w-3.5"
                  disabled={!exec.socialInsuranceEnrolled}
                />
              </th>
            ))}
            <th className="border px-2 py-1 bg-green-50" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIdx) => (
            <tr
              key={rowIdx}
              className={`border-b ${row.boldLabel ? "bg-slate-50" : ""}`}
            >
              {/* 項目名 */}
              <td
                className={`sticky left-0 bg-white z-10 border px-2 py-0.5 text-left whitespace-nowrap ${
                  row.boldLabel ? "font-bold bg-slate-50" : ""
                }`}
              >
                {row.label}
              </td>

              {/* 各役員のセル */}
              {visible.map((exec, i) =>
                renderExecCell(row, { exec, result: results[i], index: i, updateField })
              )}

              {/* 合計列 */}
              <td
                className={`border px-1 py-0.5 text-right font-bold bg-green-50 ${
                  row.boldLabel ? "font-bold" : ""
                }`}
              >
                {row.resultField && totals
                  ? formatYen(totals[row.resultField] as number)
                  : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
