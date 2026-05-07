"use client";

import type { PLPeriodInput } from "@/types/block-puzzle";
import { formatYen, parseYen } from "@/lib/format";
import { PdfImportButton } from "./pdf-import-button";

const ROW_DEFS: { label: string; field: keyof PLPeriodInput; bold?: boolean; section?: string }[] = [
  { label: "売上高合計", field: "sales", bold: true },
  { label: "売上原価", field: "costOfSales" },
  { label: "変動費に含まれる人件費等", field: "personnelInVariableCost", section: "adjustment" },
  { label: "役員報酬", field: "executiveCompensation", section: "personnel" },
  { label: "役員賞与", field: "executiveBonus", section: "personnel" },
  { label: "給料手当", field: "salaryAllowance", section: "personnel" },
  { label: "雑給", field: "miscellaneousSalary", section: "personnel" },
  { label: "賞与", field: "bonus", section: "personnel" },
  { label: "退職金", field: "retirementBenefits", section: "personnel" },
  { label: "法定福利費", field: "legalWelfare", section: "personnel" },
  { label: "販売管理費計（人件費以外）", field: "sellingAdminOther" },
  { label: "税引前当期純損益金額（参考）", field: "preTaxIncomeRef" },
  { label: "減価償却費", field: "depreciation", section: "cash" },
  { label: "法人税等", field: "corporateTaxEtc", section: "cash" },
  { label: "借入金返済", field: "loanRepayment", section: "cash" },
];

interface PLInputTableProps {
  periods: PLPeriodInput[];
  onChange: (index: number, field: keyof PLPeriodInput, value: number | string) => void;
  onApplyPdf?: (index: number, next: PLPeriodInput) => void;
}

export function PLInputTable({ periods, onChange, onApplyPdf }: PLInputTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-sm">
        <thead>
          <tr>
            <th className="border bg-gray-100 px-2 py-1 text-left sticky left-0 z-10 min-w-[220px]">
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
                  {onApplyPdf && <PdfImportButton columnIndex={i} onApply={onApplyPdf} />}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROW_DEFS.map((row) => {
            let rowBg = "";
            if (row.section === "personnel") { rowBg = "bg-yellow-50/40"; }
            else if (row.section === "cash") { rowBg = "bg-blue-50/40"; }
            else if (row.section === "adjustment") { rowBg = "bg-orange-50/60"; }
            return (
            <tr key={row.field} className={rowBg}>
              <td className={`border px-2 py-1 sticky left-0 z-10 bg-white ${row.bold ? "font-bold" : ""}`}>
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
