"use client";

import { useMemo } from "react";
import { useShikinGuriStore, PERIOD_LENGTH_MONTHS } from "@/stores/shikin-guri-store";
import {
  enumerateMonths,
  formatJpMonth,
  formatShortJpMonth,
} from "@/lib/shikin-guri-months";
import { deriveAccounts, deriveCashflow, isForecastMonth } from "@/lib/shikin-guri-calc";
import { EditableYenCell } from "./editable-yen-cell";
import { CsvImportButton } from "./csv-import-button";
import type { MonthKey } from "@/types/shikin-guri";

const COL_WIDTH = 110;

export function AccountsTable() {
  const period = useShikinGuriStore((s) => s.period);
  const accounts = useShikinGuriStore((s) => s.accounts);
  const cashflow = useShikinGuriStore((s) => s.cashflow);
  const addAccount = useShikinGuriStore((s) => s.addAccount);
  const removeAccount = useShikinGuriStore((s) => s.removeAccount);
  const renameAccount = useShikinGuriStore((s) => s.renameAccount);
  const setAccountBalance = useShikinGuriStore((s) => s.setAccountBalance);

  const months = useMemo(
    () => enumerateMonths(period.startMonth, PERIOD_LENGTH_MONTHS),
    [period.startMonth]
  );

  const derived = useMemo(() => deriveAccounts(accounts, months), [accounts, months]);
  const cashDerived = useMemo(() => deriveCashflow(cashflow, months), [cashflow, months]);

  const headerCellClass = (m: MonthKey) =>
    isForecastMonth(m, period.currentMonth) ? "bg-amber-100" : "bg-blue-100";
  const cellBg = (m: MonthKey) =>
    isForecastMonth(m, period.currentMonth) ? "bg-amber-50/40" : "";

  return (
    <div className="px-4 py-4">
      <div className="flex items-center gap-2 mb-2">
        <CsvImportButton
          label="CSV取込（口座残高）"
          mode="accounts"
          title="口座残高明細表CSVを取り込む"
        />
        <button
          type="button"
          onClick={() => addAccount("")}
          className="text-xs border border-blue-500 text-blue-700 rounded px-3 py-1 hover:bg-blue-50 transition-colors"
        >
          ＋ 口座を追加
        </button>
        <span className="text-xs text-gray-500 ml-2">
          月末残高を入力。残高合計と前月増減は自動計算。
        </span>
      </div>

      <div className="overflow-x-auto border rounded">
        <table className="border-collapse text-sm">
          <thead className="sticky top-0 z-20">
            <tr>
              <th className="border bg-gray-100 px-2 py-1 text-left sticky left-0 z-30 min-w-[200px]">
                金融機関名
              </th>
              {months.map((m) => (
                <th
                  key={m}
                  className={`border px-1 py-1 text-center ${headerCellClass(m)}`}
                  style={{ minWidth: COL_WIDTH }}
                  title={formatJpMonth(m)}
                >
                  {formatShortJpMonth(m)}
                </th>
              ))}
              <th className="border bg-gray-100 px-2 py-1 w-12">操作</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id}>
                <td className="border px-1 py-0.5 sticky left-0 z-10 bg-white">
                  <input
                    type="text"
                    value={a.name}
                    onChange={(e) => renameAccount(a.id, e.target.value)}
                    placeholder="例：滋賀銀行堅田"
                    className="w-full px-1 py-0.5 outline-none focus:bg-white focus:ring-1 focus:ring-blue-400"
                  />
                </td>
                {months.map((m) => (
                  <td key={m} className={`border p-0 ${cellBg(m)}`}>
                    <EditableYenCell
                      value={a.balances[m] ?? 0}
                      onChange={(v) => setAccountBalance(a.id, m, v)}
                      ariaLabel={`${a.name || "口座"} ${m}`}
                    />
                  </td>
                ))}
                <td className="border px-1 py-0.5 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`口座「${a.name || "(無題)"}」を削除しますか？`)) {
                        removeAccount(a.id);
                      }
                    }}
                    className="text-red-600 hover:text-red-800 text-xs"
                    aria-label="削除"
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))}

            {/* 残高合計 */}
            <tr className="bg-gray-100 font-semibold">
              <td className="border px-2 py-1 sticky left-0 z-10 bg-gray-100">
                残高合計
              </td>
              {months.map((m) => (
                <td key={m} className={`border p-0 ${cellBg(m)} bg-gray-100`}>
                  <EditableYenCell
                    value={derived.total[m] ?? 0}
                    onChange={() => {}}
                    readOnly
                    bold
                  />
                </td>
              ))}
              <td className="border bg-gray-100"></td>
            </tr>

            {/* 前月増減 */}
            <tr className="bg-gray-50">
              <td className="border px-2 py-1 sticky left-0 z-10 bg-gray-50">
                前月増減
              </td>
              {months.map((m, i) => (
                <td key={m} className={`border p-0 ${cellBg(m)} bg-gray-50`}>
                  <EditableYenCell
                    value={i === 0 ? 0 : derived.momDelta[m] ?? 0}
                    onChange={() => {}}
                    readOnly
                  />
                </td>
              ))}
              <td className="border bg-gray-50"></td>
            </tr>

            {/* 期末現預金残高（参照表示・整合性確認用） */}
            <tr className="bg-blue-50">
              <td className="border px-2 py-1 sticky left-0 z-10 bg-blue-50 text-blue-700">
                資金繰り表 期末残高
              </td>
              {months.map((m) => (
                <td key={m} className={`border p-0 ${cellBg(m)} bg-blue-50`}>
                  <EditableYenCell
                    value={cashDerived.closing[m] ?? 0}
                    onChange={() => {}}
                    readOnly
                  />
                </td>
              ))}
              <td className="border bg-blue-50"></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
