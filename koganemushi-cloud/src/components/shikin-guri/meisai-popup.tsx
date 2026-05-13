"use client";

import { useMemo } from "react";
import { useShikinGuriStore } from "@/stores/shikin-guri-store";
import { formatJpMonth, formatShortJpMonth } from "@/lib/shikin-guri-months";
import { SUBJECT_BY_ID } from "@/lib/shikin-guri-subjects";
import { formatYen } from "@/lib/format";
import type { MonthKey } from "@/types/shikin-guri";

interface Props {
  subjectId: string;
  month?: MonthKey;
  onClose: () => void;
}

export function MeisaiPopup({ subjectId, month, onClose }: Props) {
  const meisai = useShikinGuriStore((s) => s.meisai);
  const cashflow = useShikinGuriStore((s) => s.cashflow);

  const subject = SUBJECT_BY_ID[subjectId];

  const filteredRows = useMemo(() => {
    const bySubject = meisai.filter((r) => r.subjectId === subjectId);
    if (!month) { return bySubject; }
    return bySubject.filter((r) => (r.amounts[month] ?? 0) !== 0);
  }, [meisai, subjectId, month]);

  const monthColumns = useMemo(() => {
    if (month) { return [month]; }
    const set = new Set<MonthKey>();
    for (const r of filteredRows) {
      for (const m of Object.keys(r.amounts)) { set.add(m); }
    }
    return Array.from(set).sort();
  }, [filteredRows, month]);

  const columnTotals = useMemo(() => {
    const totals: Record<MonthKey, number> = {};
    for (const m of monthColumns) {
      let sum = 0;
      for (const r of filteredRows) { sum += r.amounts[m] ?? 0; }
      totals[m] = sum;
    }
    return totals;
  }, [filteredRows, monthColumns]);

  const cellComparisons = useMemo(() => {
    return monthColumns.map((m) => {
      const cell = cashflow.cells[subjectId]?.[m] ?? 0;
      const meisaiSum = columnTotals[m] ?? 0;
      return { month: m, cell, meisaiSum, diff: cell - meisaiSum };
    });
  }, [monthColumns, columnTotals, cashflow.cells, subjectId]);

  const title = month
    ? `${subject?.label ?? subjectId} 明細 (${formatJpMonth(month)})`
    : `${subject?.label ?? subjectId} 明細 (全月)`;

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        <div className="px-6 py-3 border-b flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-4 overflow-auto flex-1 text-sm">
          {filteredRows.length === 0 ? (
            <div className="text-gray-500 py-8 text-center">
              該当する明細データがありません。
              <div className="text-xs mt-1">
                明細表CSVを取込むと、ここに内訳が表示されます。
              </div>
            </div>
          ) : (
            <table className="border-collapse text-xs w-full">
              <thead>
                <tr>
                  <th className="border bg-gray-100 px-2 py-1 text-left sticky left-0 z-10 min-w-[240px]">
                    摘要
                  </th>
                  {monthColumns.map((m) => (
                    <th
                      key={m}
                      className="border bg-gray-100 px-2 py-1 text-right min-w-[100px]"
                    >
                      {formatShortJpMonth(m)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r, i) => (
                  <tr key={`${r.subjectId}-${i}`} className="hover:bg-blue-50/40">
                    <td className="border px-2 py-1 sticky left-0 z-10 bg-white">
                      {r.description}
                    </td>
                    {monthColumns.map((m) => {
                      const v = r.amounts[m] ?? 0;
                      return (
                        <td
                          key={m}
                          className={`border px-2 py-1 text-right ${v === 0 ? "text-gray-300" : ""}`}
                        >
                          {formatYen(v)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr className="bg-yellow-50 font-semibold">
                  <td className="border px-2 py-1 sticky left-0 z-10 bg-yellow-50">合計</td>
                  {monthColumns.map((m) => (
                    <td key={m} className="border px-2 py-1 text-right">
                      {formatYen(columnTotals[m] ?? 0)}
                    </td>
                  ))}
                </tr>
                <tr className="bg-gray-50 text-gray-600">
                  <td className="border px-2 py-1 sticky left-0 z-10 bg-gray-50">
                    セル値（資金繰り表）
                  </td>
                  {cellComparisons.map((c) => (
                    <td key={c.month} className="border px-2 py-1 text-right">
                      {formatYen(c.cell)}
                    </td>
                  ))}
                </tr>
                <tr className="text-xs">
                  <td className="border px-2 py-1 sticky left-0 z-10 bg-white text-gray-500">
                    差異（セル値 − 明細合計）
                  </td>
                  {cellComparisons.map((c) => (
                    <td
                      key={c.month}
                      className={`border px-2 py-1 text-right ${c.diff === 0 ? "text-gray-400" : "text-red-600 font-semibold"}`}
                    >
                      {formatYen(c.diff)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          )}
        </div>

        <div className="px-6 py-3 border-t flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="border border-gray-400 text-gray-700 rounded px-4 py-1.5 text-sm hover:bg-gray-50"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
