"use client";

import { useState } from "react";
import { useShikinGuriStore, PERIOD_LENGTH_MONTHS } from "@/stores/shikin-guri-store";
import { enumerateMonths, formatJpMonth } from "@/lib/shikin-guri-months";
import { checkConsistency, deriveAccounts, deriveCashflow } from "@/lib/shikin-guri-calc";
import { formatYen } from "@/lib/format";

export function ConsistencyBanner() {
  const period = useShikinGuriStore((s) => s.period);
  const cashflow = useShikinGuriStore((s) => s.cashflow);
  const accounts = useShikinGuriStore((s) => s.accounts);
  const [open, setOpen] = useState(false);

  const months = enumerateMonths(period.startMonth, PERIOD_LENGTH_MONTHS);
  const derived = deriveCashflow(cashflow, months);
  const accDerived = deriveAccounts(accounts, months);
  const issues = checkConsistency(derived, accDerived, months);

  if (issues.length === 0) { return null; }

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 text-sm">
      <div className="flex items-center gap-3">
        <span className="text-amber-700">
          ⚠ {issues.length}か月で 期末現預金残高 と 口座残高合計 が一致しません
        </span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-blue-700 underline text-xs"
        >
          {open ? "閉じる" : "詳細"}
        </button>
      </div>
      {open && (
        <div className="mt-2 max-h-48 overflow-y-auto">
          <table className="text-xs border-collapse">
            <thead>
              <tr className="bg-amber-100">
                <th className="border px-2 py-1 text-left">月</th>
                <th className="border px-2 py-1 text-right">期末現預金</th>
                <th className="border px-2 py-1 text-right">口座残高合計</th>
                <th className="border px-2 py-1 text-right">差額</th>
              </tr>
            </thead>
            <tbody>
              {issues.map((i) => (
                <tr key={i.month}>
                  <td className="border px-2 py-0.5">{formatJpMonth(i.month)}</td>
                  <td className="border px-2 py-0.5 text-right">{formatYen(i.closing)}</td>
                  <td className="border px-2 py-0.5 text-right">{formatYen(i.accountTotal)}</td>
                  <td
                    className={`border px-2 py-0.5 text-right ${i.diff < 0 ? "text-red-600" : "text-blue-700"}`}
                  >
                    {i.diff > 0 ? "+" : ""}
                    {formatYen(i.diff)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
