"use client";

import { useMemo, useState } from "react";
import {
  useShikinGuriStore,
  PERIOD_LENGTH_MONTHS,
} from "@/stores/shikin-guri-store";
import {
  formatJpMonth,
  formatShortJpMonth,
  enumerateMonths,
  monthBefore,
} from "@/lib/shikin-guri-months";
import { SUBJECT_BY_ID } from "@/lib/shikin-guri-subjects";
import { formatYen } from "@/lib/format";
import type { MeisaiForecastRow, MonthKey } from "@/types/shikin-guri";
import { EditableYenCell } from "./editable-yen-cell";

/** Zustand セレクタの参照安定用（空フォールバック） */
const EMPTY_VALUES: Record<string, number> = {};
const EMPTY_ADDED: MeisaiForecastRow[] = [];

interface Props {
  subjectId: string;
  month?: MonthKey;
  onClose: () => void;
}

/** 明細行 i の実効予測値（保存値があればそれ、無ければ空欄＝0） */
function effectiveForecast(
  values: Record<string, number>,
  rowIndex: number
): number {
  return values[`m${rowIndex}`] ?? 0;
}

/** 試算合計（明細行の実効値 ＋ 追加行の値） */
function computeForecastTotal(
  rowCount: number,
  values: Record<string, number>,
  addedRows: { value: number }[]
): number {
  let sum = 0;
  for (let i = 0; i < rowCount; i++) {
    sum += effectiveForecast(values, i);
  }
  for (const r of addedRows) { sum += r.value; }
  return sum;
}

/** 予測入力の書込みコントロール（全月モードのみ） */
function ForecastFooter({
  subjectId,
  forecastTotal,
}: {
  subjectId: string;
  forecastTotal: number;
}) {
  const period = useShikinGuriStore((s) => s.period);
  const cashflow = useShikinGuriStore((s) => s.cashflow);
  const setCashflowCell = useShikinGuriStore((s) => s.setCashflowCell);

  const forecastMonths = useMemo(
    () =>
      enumerateMonths(period.startMonth, PERIOD_LENGTH_MONTHS).filter((m) =>
        monthBefore(period.currentMonth, m)
      ),
    [period.startMonth, period.currentMonth]
  );

  const [targetMonth, setTargetMonth] = useState<MonthKey>(
    forecastMonths[0] ?? ""
  );
  const [message, setMessage] = useState<string | null>(null);

  const currentCell = targetMonth
    ? cashflow.cells[subjectId]?.[targetMonth] ?? 0
    : 0;

  const handleWrite = () => {
    if (!targetMonth) { return; }
    const overwriteOk =
      currentCell === 0 ||
      window.confirm(
        `${formatJpMonth(targetMonth)} の現在値 ${formatYen(currentCell)} を ` +
          `試算合計 ${formatYen(forecastTotal)} で上書きします。よろしいですか？`
      );
    if (!overwriteOk) { return; }
    setCashflowCell(subjectId, targetMonth, forecastTotal);
    setMessage(
      `${formatJpMonth(targetMonth)} に ${formatYen(forecastTotal)} を入力しました。`
    );
  };

  return (
    <div className="px-6 py-3 border-t bg-blue-50/40 flex flex-wrap items-center gap-3 text-sm">
      <span className="font-medium">試算合計</span>
      <span className="font-semibold tabular-nums">
        {formatYen(forecastTotal)}
      </span>
      <span className="text-gray-500">を</span>
      <select
        value={targetMonth}
        onChange={(e) => {
          setTargetMonth(e.target.value);
          setMessage(null);
        }}
        className="border border-gray-300 rounded px-2 py-1 text-sm"
        aria-label="書込み先の月"
      >
        {forecastMonths.length === 0 && (
          <option value="">予測月がありません</option>
        )}
        {forecastMonths.map((m) => (
          <option key={m} value={m}>
            {formatJpMonth(m)}
          </option>
        ))}
      </select>
      <span className="text-gray-500">に入力</span>
      {targetMonth && (
        <span className="text-xs text-gray-500">
          （現在値: {formatYen(currentCell)} → 上書き）
        </span>
      )}
      <button
        type="button"
        onClick={handleWrite}
        disabled={!targetMonth}
        className="bg-blue-600 text-white rounded px-3 py-1.5 text-sm hover:bg-blue-700 disabled:opacity-40"
      >
        選択月に試算合計を入力
      </button>
      {message && (
        <span className="text-green-700 text-xs font-medium">{message}</span>
      )}
    </div>
  );
}

/** 追加行（まだ発生していない摘要）の tbody 行群 */
function AddedRows({
  subjectId,
  monthColumns,
}: {
  subjectId: string;
  monthColumns: MonthKey[];
}) {
  const addedRows = useShikinGuriStore(
    (s) => s.meisaiForecast.addedRows[subjectId] ?? EMPTY_ADDED
  );
  const updateRow = useShikinGuriStore((s) => s.updateMeisaiForecastRow);
  const removeRow = useShikinGuriStore((s) => s.removeMeisaiForecastRow);

  return (
    <>
      {addedRows.map((row) => (
        <tr key={row.id} className="bg-green-50/40">
          <td className="border px-2 py-1 sticky left-0 z-10 bg-green-50/60">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => removeRow(subjectId, row.id)}
                className="text-red-500 hover:text-red-700 text-base leading-none px-1"
                aria-label="この追加行を削除"
                title="削除"
              >
                ×
              </button>
              <input
                type="text"
                value={row.description}
                placeholder="摘要（新規）"
                onChange={(e) =>
                  updateRow(subjectId, row.id, { description: e.target.value })
                }
                className="flex-1 px-1 py-1 border border-gray-200 rounded outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
          </td>
          {monthColumns.map((m) => (
            <td key={m} className="border px-2 py-1 text-right text-gray-300">
              {formatYen(0)}
            </td>
          ))}
          <td className="border p-0 bg-blue-50/40">
            <EditableYenCell
              value={row.value}
              onChange={(v) => updateRow(subjectId, row.id, { value: v })}
              ariaLabel={`${row.description || "新規"} 予測入力`}
            />
          </td>
        </tr>
      ))}
    </>
  );
}

export function MeisaiPopup({ subjectId, month, onClose }: Props) {
  const meisai = useShikinGuriStore((s) => s.meisai);
  const cashflow = useShikinGuriStore((s) => s.cashflow);
  const forecastValues = useShikinGuriStore(
    (s) => s.meisaiForecast.values[subjectId] ?? EMPTY_VALUES
  );
  const addedRows = useShikinGuriStore(
    (s) => s.meisaiForecast.addedRows[subjectId] ?? EMPTY_ADDED
  );
  const setForecastValue = useShikinGuriStore((s) => s.setMeisaiForecastValue);
  const addRow = useShikinGuriStore((s) => s.addMeisaiForecastRow);

  // 全月モード（month 指定なし）のときだけ予測入力UIを出す
  const forecastMode = !month;
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

  const cellComparisons = useMemo(
    () =>
      monthColumns.map((m) => {
        const cell = cashflow.cells[subjectId]?.[m] ?? 0;
        return { month: m, cell, diff: cell - (columnTotals[m] ?? 0) };
      }),
    [monthColumns, columnTotals, cashflow.cells, subjectId]
  );

  const forecastTotal = useMemo(
    () => computeForecastTotal(filteredRows.length, forecastValues, addedRows),
    [filteredRows.length, forecastValues, addedRows]
  );

  const title = month
    ? `${subject?.label ?? subjectId} 明細 (${formatJpMonth(month)})`
    : `${subject?.label ?? subjectId} 明細 (全月)`;

  const totalCols = 1 + monthColumns.length + (forecastMode ? 1 : 0);
  const empty = filteredRows.length === 0 && addedRows.length === 0;

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
          {empty ? (
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
                  {forecastMode && (
                    <th className="border bg-blue-100 px-2 py-1 text-right min-w-[120px]">
                      予測入力
                    </th>
                  )}
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
                    {forecastMode && (
                      <td className="border p-0 bg-blue-50/40">
                        <EditableYenCell
                          value={effectiveForecast(forecastValues, i)}
                          onChange={(v) =>
                            setForecastValue(subjectId, `m${i}`, v)
                          }
                          ariaLabel={`${r.description} 予測入力`}
                        />
                      </td>
                    )}
                  </tr>
                ))}

                {forecastMode && (
                  <AddedRows
                    subjectId={subjectId}
                    monthColumns={monthColumns}
                  />
                )}

                {forecastMode && (
                  <tr>
                    <td
                      className="border px-2 py-1 sticky left-0 z-10 bg-white"
                      colSpan={totalCols}
                    >
                      <button
                        type="button"
                        onClick={() => addRow(subjectId)}
                        className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                      >
                        ＋ 行を追加（まだ発生していない摘要）
                      </button>
                    </td>
                  </tr>
                )}

                <tr className="bg-yellow-50 font-semibold">
                  <td className="border px-2 py-1 sticky left-0 z-10 bg-yellow-50">合計</td>
                  {monthColumns.map((m) => (
                    <td key={m} className="border px-2 py-1 text-right">
                      {formatYen(columnTotals[m] ?? 0)}
                    </td>
                  ))}
                  {forecastMode && (
                    <td className="border px-2 py-1 text-right bg-blue-100">
                      {formatYen(forecastTotal)}
                    </td>
                  )}
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
                  {forecastMode && <td className="border px-2 py-1" />}
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
                  {forecastMode && <td className="border px-2 py-1" />}
                </tr>
              </tbody>
            </table>
          )}
        </div>

        {forecastMode && (
          <ForecastFooter subjectId={subjectId} forecastTotal={forecastTotal} />
        )}

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
