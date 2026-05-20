"use client";

import { useMemo, useState } from "react";
import { useShikinGuriStore, PERIOD_LENGTH_MONTHS } from "@/stores/shikin-guri-store";
import {
  enumerateMonths,
  formatJpMonth,
  formatShortJpMonth,
} from "@/lib/shikin-guri-months";
import {
  BANK_FORMAT_SECTIONS,
  calcBankFormat,
  isForecastMonth,
} from "@/lib/shikin-guri-calc";
import { formatYen } from "@/lib/format";
import { EditableYenCell } from "./editable-yen-cell";
import type { MonthKey } from "@/types/shikin-guri";

const PAGE_SIZE = 12;

export function BankFormatTable() {
  const period = useShikinGuriStore((s) => s.period);
  const cashflow = useShikinGuriStore((s) => s.cashflow);
  const bankFormatManual = useShikinGuriStore((s) => s.bankFormatManual);
  const bankFormatShowAccrual = useShikinGuriStore((s) => s.bankFormatShowAccrual);
  const setBankFormatManualValue = useShikinGuriStore((s) => s.setBankFormatManualValue);
  const setBankFormatShowAccrual = useShikinGuriStore((s) => s.setBankFormatShowAccrual);

  const allMonths = useMemo(
    () => enumerateMonths(period.startMonth, PERIOD_LENGTH_MONTHS),
    [period.startMonth]
  );

  const pages = useMemo(() => {
    const out: MonthKey[][] = [];
    for (let i = 0; i < allMonths.length; i += PAGE_SIZE) {
      out.push(allMonths.slice(i, i + PAGE_SIZE));
    }
    return out;
  }, [allMonths]);

  const [pageIndex, setPageIndex] = useState(0);
  const months = pages[pageIndex] ?? [];

  const result = useMemo(
    () => calcBankFormat(cashflow, months, bankFormatManual),
    [cashflow, months, bankFormatManual]
  );

  const periodLabel =
    months.length > 0
      ? `${formatJpMonth(months[0])} 〜 ${formatJpMonth(months[months.length - 1])}`
      : "";

  const headerBg = (m: MonthKey) =>
    isForecastMonth(m, period.currentMonth) ? "bg-amber-100" : "bg-blue-100";
  const cellBg = (m: MonthKey) =>
    isForecastMonth(m, period.currentMonth) ? "bg-amber-50/40" : "";

  const sumRow = (values: Record<MonthKey, number>) =>
    months.reduce((acc, m) => acc + (values[m] ?? 0), 0);

  return (
    <div className="px-4 py-4">
      <div className="mb-2 flex items-baseline gap-3">
        <h2 className="text-base font-semibold">資金繰り表（金融機関提出用）</h2>
        <span className="text-xs text-gray-600">対象期間：{periodLabel}</span>
      </div>
      <div className="text-xs text-gray-500 mb-3">
        ＊ 資金繰り表タブのデータから自動集計（read-only）。12ヶ月ごとにページ切替。
        印刷時は 36ヶ月＝12ヶ月×3ページの A4横レイアウト。
      </div>

      <div className="mb-2 flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-700">ページ:</span>
        {pages.map((p, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setPageIndex(idx)}
            className={`text-xs border rounded px-2 py-1 ${
              idx === pageIndex
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            }`}
          >
            {idx + 1}/{pages.length}（{formatShortJpMonth(p[0])}〜{formatShortJpMonth(p[p.length - 1])}）
          </button>
        ))}
        <button
          type="button"
          onClick={() => setBankFormatShowAccrual(!bankFormatShowAccrual)}
          className={`ml-4 text-xs border rounded px-2 py-1 ${
            bankFormatShowAccrual
              ? "bg-amber-100 text-amber-800 border-amber-400"
              : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
          }`}
          title="売上高・仕入外注費は発生主義のためアプリでは扱わない。提出時に手入力する場合のみ展開"
        >
          {bankFormatShowAccrual ? "▼ 発生主義行を隠す" : "▶ 発生主義行を入力（売上高・仕入外注費）"}
        </button>
      </div>

      <div className="overflow-x-auto border rounded">
        <table className="border-collapse text-sm">
          <thead className="sticky top-0 z-20">
            <tr>
              <th className="border bg-gray-100 px-2 py-1 sticky left-0 z-30 text-left min-w-[180px]">
                科目
              </th>
              {months.map((m) => (
                <th
                  key={m}
                  className={`border px-2 py-1 text-center ${headerBg(m)}`}
                  style={{ minWidth: 100 }}
                >
                  {formatShortJpMonth(m)}
                </th>
              ))}
              <th className="border bg-gray-100 px-2 py-1 text-center" style={{ minWidth: 110 }}>
                合計
              </th>
            </tr>
          </thead>
          <tbody>
            {/* 情報行（発生主義 - トグル展開時のみ表示・編集可） */}
            {bankFormatShowAccrual && (
              <>
                <tr>
                  <td className="border bg-amber-50 px-2 py-1 sticky left-0 z-10">
                    売上高
                    <span className="ml-1 text-[10px] text-amber-700">(発生主義)</span>
                  </td>
                  {months.map((m) => (
                    <td key={m} className={`border px-1 py-0 text-right ${cellBg(m)}`}>
                      <EditableYenCell
                        value={bankFormatManual.uriageDaka[m] ?? 0}
                        onChange={(v) => setBankFormatManualValue("uriageDaka", m, v)}
                        bg={cellBg(m)}
                        ariaLabel={`${m} 売上高（発生主義）`}
                      />
                    </td>
                  ))}
                  <td className="border bg-amber-50 px-2 py-1 text-right font-semibold">
                    {formatYen(sumRow(result.uriageDaka))}
                  </td>
                </tr>
                <tr>
                  <td className="border bg-amber-50 px-2 py-1 sticky left-0 z-10">
                    仕入・外注費
                    <span className="ml-1 text-[10px] text-amber-700">(発生主義)</span>
                  </td>
                  {months.map((m) => (
                    <td key={m} className={`border px-1 py-0 text-right ${cellBg(m)}`}>
                      <EditableYenCell
                        value={bankFormatManual.shiireGaichuu[m] ?? 0}
                        onChange={(v) => setBankFormatManualValue("shiireGaichuu", m, v)}
                        bg={cellBg(m)}
                        ariaLabel={`${m} 仕入・外注費（発生主義）`}
                      />
                    </td>
                  ))}
                  <td className="border bg-amber-50 px-2 py-1 text-right font-semibold">
                    {formatYen(sumRow(result.shiireGaichuu))}
                  </td>
                </tr>
              </>
            )}

            {/* 前期繰越 */}
            <tr className="bg-gray-100 font-semibold">
              <td className="border px-2 py-1 sticky left-0 bg-gray-100 z-10">前期繰越現金・当座預金</td>
              {months.map((m) => (
                <td key={m} className={`border px-2 py-1 text-right ${cellBg(m)}`}>
                  {formatYen(result.opening[m] ?? 0)}
                </td>
              ))}
              <td className="border px-2 py-1 text-right">—</td>
            </tr>

            {/* セクション: 経常 / 経常外 / 財務 */}
            {BANK_FORMAT_SECTIONS.map((sec) => {
              const secResult = result.sections[sec.id];
              return (
                <SectionRows
                  key={sec.id}
                  sectionId={sec.id}
                  sectionLabel={sec.label}
                  incomeRows={sec.incomeRows}
                  expenseRows={sec.expenseRows}
                  rowValues={secResult.rowValues}
                  incomeTotal={secResult.incomeTotal}
                  expenseTotal={secResult.expenseTotal}
                  net={secResult.net}
                  months={months}
                  cellBg={cellBg}
                  sumRow={sumRow}
                />
              );
            })}

            {/* 総合収支 */}
            <tr className="bg-blue-50 font-semibold">
              <td className="border px-2 py-1 sticky left-0 bg-blue-50 z-10">総合収支</td>
              {months.map((m) => (
                <td key={m} className={`border px-2 py-1 text-right ${cellBg(m)}`}>
                  {formatYen(result.totalNet[m] ?? 0)}
                </td>
              ))}
              <td className="border px-2 py-1 text-right">
                {formatYen(sumRow(result.totalNet))}
              </td>
            </tr>

            {/* 翌月繰越 */}
            <tr className="bg-gray-200 font-semibold">
              <td className="border px-2 py-1 sticky left-0 bg-gray-200 z-10">翌月繰越現金・当座預金</td>
              {months.map((m) => (
                <td key={m} className={`border px-2 py-1 text-right ${cellBg(m)}`}>
                  {formatYen(result.closing[m] ?? 0)}
                </td>
              ))}
              <td className="border px-2 py-1 text-right">—</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface SectionRowsProps {
  sectionId: "keijou" | "keijouGai" | "zaimu";
  sectionLabel: string;
  incomeRows: { id: string; label: string }[];
  expenseRows: { id: string; label: string }[];
  rowValues: Record<string, Record<MonthKey, number>>;
  incomeTotal: Record<MonthKey, number>;
  expenseTotal: Record<MonthKey, number>;
  net: Record<MonthKey, number>;
  months: MonthKey[];
  cellBg: (m: MonthKey) => string;
  sumRow: (values: Record<MonthKey, number>) => number;
}

function SectionRows({
  sectionLabel,
  incomeRows,
  expenseRows,
  rowValues,
  incomeTotal,
  expenseTotal,
  net,
  months,
  cellBg,
  sumRow,
}: SectionRowsProps) {
  return (
    <>
      <tr className="bg-gray-200">
        <td
          className="border px-2 py-1 sticky left-0 bg-gray-200 z-10 font-semibold"
          colSpan={months.length + 2}
        >
          {sectionLabel}
        </td>
      </tr>
      {incomeRows.map((r) => (
        <tr key={r.id}>
          <td className="border px-2 py-1 sticky left-0 bg-white z-10 pl-6">{r.label}</td>
          {months.map((m) => (
            <td key={m} className={`border px-2 py-1 text-right ${cellBg(m)}`}>
              {formatYen(rowValues[r.id]?.[m] ?? 0)}
            </td>
          ))}
          <td className="border px-2 py-1 text-right">
            {formatYen(sumRow(rowValues[r.id] ?? {}))}
          </td>
        </tr>
      ))}
      <tr className="bg-gray-50">
        <td className="border px-2 py-1 sticky left-0 bg-gray-50 z-10 pl-4 font-semibold">
          収入合計
        </td>
        {months.map((m) => (
          <td key={m} className={`border px-2 py-1 text-right font-semibold ${cellBg(m)}`}>
            {formatYen(incomeTotal[m] ?? 0)}
          </td>
        ))}
        <td className="border px-2 py-1 text-right font-semibold">
          {formatYen(sumRow(incomeTotal))}
        </td>
      </tr>
      {expenseRows.map((r) => (
        <tr key={r.id}>
          <td className="border px-2 py-1 sticky left-0 bg-white z-10 pl-6">{r.label}</td>
          {months.map((m) => (
            <td key={m} className={`border px-2 py-1 text-right ${cellBg(m)}`}>
              {formatYen(rowValues[r.id]?.[m] ?? 0)}
            </td>
          ))}
          <td className="border px-2 py-1 text-right">
            {formatYen(sumRow(rowValues[r.id] ?? {}))}
          </td>
        </tr>
      ))}
      <tr className="bg-gray-50">
        <td className="border px-2 py-1 sticky left-0 bg-gray-50 z-10 pl-4 font-semibold">
          支出合計
        </td>
        {months.map((m) => (
          <td key={m} className={`border px-2 py-1 text-right font-semibold ${cellBg(m)}`}>
            {formatYen(expenseTotal[m] ?? 0)}
          </td>
        ))}
        <td className="border px-2 py-1 text-right font-semibold">
          {formatYen(sumRow(expenseTotal))}
        </td>
      </tr>
      <tr className="bg-blue-50/50">
        <td className="border px-2 py-1 sticky left-0 bg-blue-50/50 z-10 pl-4 font-semibold">
          {sectionLabel}（純額）
        </td>
        {months.map((m) => (
          <td key={m} className={`border px-2 py-1 text-right font-semibold ${cellBg(m)}`}>
            {formatYen(net[m] ?? 0)}
          </td>
        ))}
        <td className="border px-2 py-1 text-right font-semibold">{formatYen(sumRow(net))}</td>
      </tr>
    </>
  );
}
