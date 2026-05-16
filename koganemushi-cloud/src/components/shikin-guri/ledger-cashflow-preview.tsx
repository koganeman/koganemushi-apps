"use client";

import { SUBJECTS, OPENING_BALANCE_LABEL } from "@/lib/shikin-guri-subjects";
import { formatJpMonth } from "@/lib/shikin-guri-months";
import { formatYen } from "@/lib/format";
import type { CashflowCsvImportResult } from "@/lib/shikin-guri-csv";

interface Props {
  cashflow: CashflowCsvImportResult;
}

/** 生成された資金繰り実績表（科目×月）の読取専用プレビュー */
export function LedgerCashflowPreview({ cashflow }: Props) {
  const { months } = cashflow;
  return (
    <div className="overflow-x-auto border rounded">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-gray-600">
          <tr>
            <th className="px-3 py-2 text-left font-medium sticky left-0 bg-gray-50 z-10">
              科目
            </th>
            {months.map((m) => (
              <th
                key={m}
                className="px-3 py-2 text-right font-medium whitespace-nowrap"
              >
                {formatJpMonth(m)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SUBJECTS.map((s) => {
            const row = cashflow.cellsBySubject[s.id] ?? {};
            const hasData = months.some((m) => (row[m] ?? 0) !== 0);
            return (
              <tr
                key={s.id}
                className={`border-t ${hasData ? "bg-white" : "bg-white text-gray-400"}`}
              >
                <td className="px-3 py-2 whitespace-nowrap sticky left-0 bg-white z-10">
                  {s.label}
                </td>
                {months.map((m) => (
                  <td
                    key={m}
                    className="px-3 py-2 text-right tabular-nums whitespace-nowrap"
                  >
                    {formatYen(row[m] ?? 0) || "0"}
                  </td>
                ))}
              </tr>
            );
          })}
          <tr className="border-t bg-blue-50 font-medium">
            <td className="px-3 py-2 whitespace-nowrap sticky left-0 bg-blue-50 z-10">
              {OPENING_BALANCE_LABEL}
            </td>
            {months.map((m, i) => (
              <td
                key={m}
                className="px-3 py-2 text-right tabular-nums whitespace-nowrap"
              >
                {i === 0
                  ? formatYen(cashflow.openingBalanceCandidate ?? 0) || "0"
                  : ""}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
