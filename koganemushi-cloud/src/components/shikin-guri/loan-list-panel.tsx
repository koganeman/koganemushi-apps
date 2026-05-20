"use client";

import { memo, useCallback, useMemo, useState } from "react";
import {
  PERIOD_LENGTH_MONTHS,
  useShikinGuriStore,
} from "@/stores/shikin-guri-store";
import {
  enumerateMonths,
  formatJpMonth,
  formatShortJpMonth,
} from "@/lib/shikin-guri-months";
import { isForecastMonth } from "@/lib/shikin-guri-calc";
import { calcLoanSchedule } from "@/lib/loan-forecast-calc";
import type { LoanRowMonthResult } from "@/lib/loan-forecast-calc";
import { formatPercent, formatYen, parsePercent } from "@/lib/format";
import { EditableYenCell } from "./editable-yen-cell";
import type { LoanRow, LoanType, MonthKey } from "@/types/shikin-guri";

const COL_WIDTH = 90;
const FIELD_LABEL_WIDTH = 80;

function LoanTranscriptionFooter() {
  const currentMonth = useShikinGuriStore((s) => s.period.currentMonth);
  const appliedAt = useShikinGuriStore(
    (s) => s.appliedLoanTranscription.appliedAt
  );
  const applyLoanTranscription = useShikinGuriStore(
    (s) => s.applyLoanTranscription
  );
  const clearLoanTranscription = useShikinGuriStore(
    (s) => s.clearLoanTranscription
  );

  const [excludeActuals, setExcludeActuals] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const handleApply = () => {
    if (appliedAt) {
      const ok = window.confirm(
        `前回転記（${new Date(appliedAt).toLocaleString()}）の内容を` +
          `差し替えます。よろしいですか？`
      );
      if (!ok) {
        return;
      }
    }
    applyLoanTranscription(excludeActuals ? currentMonth : null);
    setMessage("資金繰り予定表へ転記しました。");
  };

  const handleClear = () => {
    if (!window.confirm("転記を取消し、加算分を資金繰り表から差し戻します。")) {
      return;
    }
    clearLoanTranscription();
    setMessage("転記を取消しました。");
  };

  return (
    <div className="border-t bg-blue-50/40 px-6 py-3 flex flex-wrap items-center gap-3 text-sm">
      <label className="flex items-center gap-1">
        <input
          type="checkbox"
          checked={excludeActuals}
          onChange={(e) => {
            setExcludeActuals(e.target.checked);
            setMessage(null);
          }}
        />
        実績月（{formatJpMonth(currentMonth)} 以前）を除外
      </label>
      <button
        type="button"
        onClick={handleApply}
        className="bg-blue-600 text-white rounded px-3 py-1.5 hover:bg-blue-700"
      >
        資金繰り予定表に加算転記
      </button>
      <button
        type="button"
        onClick={handleClear}
        disabled={!appliedAt}
        className="border border-gray-400 text-gray-700 rounded px-3 py-1.5 hover:bg-gray-50 disabled:opacity-40"
      >
        転記を取消
      </button>
      {appliedAt && (
        <span className="text-xs text-gray-500">
          前回転記: {new Date(appliedAt).toLocaleString()}
        </span>
      )}
      {message && (
        <span className="text-green-700 text-xs font-medium">{message}</span>
      )}
    </div>
  );
}

interface RateInputProps {
  value: number;
  onChange: (next: number) => void;
}

const formatRateForInput = (v: number): string =>
  v === 0 ? "" : formatPercent(v);

const RateInput = memo(function RateInput({ value, onChange }: RateInputProps) {
  const [text, setText] = useState(formatRateForInput(value));
  const [focused, setFocused] = useState(false);

  return (
    <input
      type="text"
      inputMode="decimal"
      value={focused ? text : formatRateForInput(value)}
      onFocus={(e) => {
        setFocused(true);
        setText(formatRateForInput(value));
        e.target.select();
      }}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        setFocused(false);
        const next = parsePercent(text);
        if (next !== value) {
          onChange(next);
        }
      }}
      className="w-full px-2 py-1 text-right outline-none focus:bg-white focus:ring-1 focus:ring-blue-400"
      aria-label="年利率（％）"
      placeholder="例: 1.70"
    />
  );
});

interface LoanRowProps {
  row: LoanRow;
  rowIndex: number;
  months: MonthKey[];
  perMonth: Record<MonthKey, LoanRowMonthResult>;
  cellBg: (m: MonthKey) => string;
}

const LoanRowComponent = memo(function LoanRowComponent({
  row,
  rowIndex,
  months,
  perMonth,
  cellBg,
}: LoanRowProps) {
  const updateLoanRow = useShikinGuriStore((s) => s.updateLoanRow);
  const setLoanMonthValue = useShikinGuriStore((s) => s.setLoanMonthValue);

  const onLenderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateLoanRow(row.id, { lender: e.target.value });
    },
    [row.id, updateLoanRow]
  );
  const onDescriptionChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateLoanRow(row.id, { description: e.target.value });
    },
    [row.id, updateLoanRow]
  );
  const onLoanTypeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateLoanRow(row.id, { loanType: e.target.value as LoanType });
    },
    [row.id, updateLoanRow]
  );
  const onOriginalAmountChange = useCallback(
    (v: number) => updateLoanRow(row.id, { originalAmount: v }),
    [row.id, updateLoanRow]
  );
  const onOpeningBalanceChange = useCallback(
    (v: number) => updateLoanRow(row.id, { openingBalance: v }),
    [row.id, updateLoanRow]
  );
  const onAnnualRateChange = useCallback(
    (v: number) => updateLoanRow(row.id, { annualRate: v }),
    [row.id, updateLoanRow]
  );

  // 月別セルの onChange を行ごとに1つ生成（month は引数で受け取る）
  const setNewBorrowing = useCallback(
    (month: MonthKey, value: number) =>
      setLoanMonthValue(row.id, "newBorrowing", month, value),
    [row.id, setLoanMonthValue]
  );
  const setRepayment = useCallback(
    (month: MonthKey, value: number) =>
      setLoanMonthValue(row.id, "repayment", month, value),
    [row.id, setLoanMonthValue]
  );

  return (
    <>
      {/* 入力 + 月別新規/返済 + 利息 */}
      <tr className="hover:bg-gray-50/50">
        <td
          className="border px-1 py-0.5 sticky left-0 bg-white z-10 text-center text-xs text-gray-500"
          rowSpan={3}
        >
          {rowIndex + 1}
        </td>
        <td className="border px-1 py-0.5" rowSpan={3}>
          <input
            type="text"
            value={row.lender}
            onChange={onLenderChange}
            className="w-full px-1 py-0.5 outline-none focus:bg-white focus:ring-1 focus:ring-blue-400"
            aria-label={`金融機関名 ${rowIndex + 1}`}
          />
        </td>
        <td className="border px-1 py-0.5" rowSpan={3}>
          <input
            type="text"
            value={row.description}
            onChange={onDescriptionChange}
            className="w-full px-1 py-0.5 outline-none focus:bg-white focus:ring-1 focus:ring-blue-400"
            aria-label={`摘要 ${rowIndex + 1}`}
          />
        </td>
        <td className="border px-1 py-0.5 text-center" rowSpan={3}>
          <select
            value={row.loanType}
            onChange={onLoanTypeChange}
            className="px-1 py-0.5 outline-none focus:ring-1 focus:ring-blue-400"
            aria-label={`借入種別 ${rowIndex + 1}`}
          >
            <option value="long">長期</option>
            <option value="short">短期</option>
          </select>
        </td>
        <td className="border px-1 py-0.5" rowSpan={3}>
          <EditableYenCell
            value={row.originalAmount}
            onChange={onOriginalAmountChange}
            ariaLabel={`当初借入額 ${rowIndex + 1}`}
          />
        </td>
        <td className="border px-1 py-0.5" rowSpan={3}>
          <EditableYenCell
            value={row.openingBalance}
            onChange={onOpeningBalanceChange}
            ariaLabel={`期首残高 ${rowIndex + 1}`}
          />
        </td>
        <td className="border px-1 py-0.5" rowSpan={3}>
          <RateInput value={row.annualRate} onChange={onAnnualRateChange} />
        </td>
        <td className="border px-1 py-0.5 bg-gray-50 text-xs text-gray-600 text-right">
          新規借入
        </td>
        {months.map((m) => (
          <td key={m} className={`border ${cellBg(m)}`}>
            <EditableYenCell
              value={row.newBorrowing[m] ?? 0}
              onChange={(v) => setNewBorrowing(m, v)}
              bg={cellBg(m)}
              ariaLabel={`${rowIndex + 1}行 ${m} 新規借入`}
            />
          </td>
        ))}
      </tr>
      <tr className="hover:bg-gray-50/50">
        <td className="border px-1 py-0.5 bg-gray-50 text-xs text-gray-600 text-right">
          返済
        </td>
        {months.map((m) => (
          <td key={m} className={`border ${cellBg(m)}`}>
            <EditableYenCell
              value={row.repayment[m] ?? 0}
              onChange={(v) => setRepayment(m, v)}
              bg={cellBg(m)}
              ariaLabel={`${rowIndex + 1}行 ${m} 返済`}
            />
          </td>
        ))}
      </tr>
      <tr className="bg-gray-50/30">
        <td className="border px-1 py-0.5 bg-gray-100 text-xs text-gray-600 text-right">
          月末残 / 利息
        </td>
        {months.map((m) => {
          const r = perMonth[m];
          return (
            <td key={m} className={`border px-1 py-0.5 ${cellBg(m)} text-right text-xs`}>
              <div className="text-gray-700">{formatYen(r?.balance ?? 0)}</div>
              <div className="text-blue-700">
                {formatYen(Math.round(r?.interest ?? 0))}
              </div>
            </td>
          );
        })}
      </tr>
    </>
  );
});

export function LoanListPanel() {
  const period = useShikinGuriStore((s) => s.period);
  const loanForecast = useShikinGuriStore((s) => s.loanForecast);

  const months = useMemo(
    () => enumerateMonths(period.startMonth, PERIOD_LENGTH_MONTHS),
    [period.startMonth]
  );
  const result = useMemo(
    () => calcLoanSchedule(loanForecast, months),
    [loanForecast, months]
  );

  const cellBg = useCallback(
    (m: MonthKey) =>
      isForecastMonth(m, period.currentMonth) ? "bg-amber-50/40" : "",
    [period.currentMonth]
  );
  const headerBg = useCallback(
    (m: MonthKey) =>
      isForecastMonth(m, period.currentMonth) ? "bg-amber-100" : "bg-blue-100",
    [period.currentMonth]
  );

  // rowId → perMonth マップ（メモ化で各行 props 安定化）
  const perMonthByRowId = useMemo(() => {
    const out: Record<string, Record<MonthKey, LoanRowMonthResult>> = {};
    for (const r of result.rows) {
      out[r.rowId] = r.perMonth;
    }
    return out;
  }, [result]);

  return (
    <div className="pb-10">
      <div className="px-4 py-4">
        <div className="text-xs text-gray-500 mb-2">
          ＊ 20行固定。年利率は％で入力（例: 1.70）。利息は月末残×年利率×当月日数÷365。
          青ヘッダ=実績月、橙ヘッダ=予測月。
        </div>
        <div className="overflow-x-auto border rounded">
          <table className="border-collapse text-sm">
            <thead className="sticky top-0 z-20">
              <tr>
                <th className="border bg-gray-100 px-1 py-1 sticky left-0 z-30 w-8" rowSpan={2}>
                  #
                </th>
                <th className="border bg-gray-100 px-2 py-1" rowSpan={2}>
                  金融機関名
                </th>
                <th className="border bg-gray-100 px-2 py-1" rowSpan={2}>
                  摘要
                </th>
                <th className="border bg-gray-100 px-2 py-1" rowSpan={2}>
                  種別
                </th>
                <th className="border bg-gray-100 px-2 py-1" rowSpan={2}>
                  当初借入額
                </th>
                <th className="border bg-gray-100 px-2 py-1" rowSpan={2}>
                  期首残高
                </th>
                <th className="border bg-gray-100 px-2 py-1" rowSpan={2}>
                  年利率(%)
                </th>
                <th
                  className="border bg-gray-100 px-1 py-1"
                  rowSpan={2}
                  style={{ minWidth: FIELD_LABEL_WIDTH }}
                >
                  項目
                </th>
                {months.map((m) => (
                  <th
                    key={m}
                    className={`border px-1 py-1 text-center ${headerBg(m)}`}
                    style={{ minWidth: COL_WIDTH }}
                  >
                    {formatShortJpMonth(m)}
                  </th>
                ))}
              </tr>
              <tr>
                {months.map((m) => (
                  <th
                    key={m}
                    className={`border px-1 py-0.5 text-[10px] text-center ${headerBg(m)}`}
                  >
                    {isForecastMonth(m, period.currentMonth) ? "予測" : "実績"}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loanForecast.rows.map((row, idx) => (
                <LoanRowComponent
                  key={row.id}
                  row={row}
                  rowIndex={idx}
                  months={months}
                  perMonth={perMonthByRowId[row.id] ?? {}}
                  cellBg={cellBg}
                />
              ))}

              {/* 合計行 */}
              <tr className="bg-gray-100 font-semibold">
                <td className="border px-1 py-1 sticky left-0 bg-gray-100 z-10" colSpan={7}>
                  合計
                </td>
                <td className="border px-1 py-1 text-xs text-gray-600 text-right">
                  新規借入(短期)
                </td>
                {months.map((m) => (
                  <td key={m} className={`border px-2 py-1 ${cellBg(m)} text-right text-xs`}>
                    {formatYen(result.totals[m]?.newBorrowingShort ?? 0)}
                  </td>
                ))}
              </tr>
              <tr className="bg-gray-100 font-semibold">
                <td className="border px-1 py-1 sticky left-0 bg-gray-100 z-10" colSpan={7}></td>
                <td className="border px-1 py-1 text-xs text-gray-600 text-right">
                  新規借入(長期)
                </td>
                {months.map((m) => (
                  <td key={m} className={`border px-2 py-1 ${cellBg(m)} text-right text-xs`}>
                    {formatYen(result.totals[m]?.newBorrowingLong ?? 0)}
                  </td>
                ))}
              </tr>
              <tr className="bg-gray-100 font-semibold">
                <td className="border px-1 py-1 sticky left-0 bg-gray-100 z-10" colSpan={7}></td>
                <td className="border px-1 py-1 text-xs text-gray-600 text-right">
                  返済(短期)
                </td>
                {months.map((m) => (
                  <td key={m} className={`border px-2 py-1 ${cellBg(m)} text-right text-xs`}>
                    {formatYen(result.totals[m]?.repaymentShort ?? 0)}
                  </td>
                ))}
              </tr>
              <tr className="bg-gray-100 font-semibold">
                <td className="border px-1 py-1 sticky left-0 bg-gray-100 z-10" colSpan={7}></td>
                <td className="border px-1 py-1 text-xs text-gray-600 text-right">
                  返済(長期)
                </td>
                {months.map((m) => (
                  <td key={m} className={`border px-2 py-1 ${cellBg(m)} text-right text-xs`}>
                    {formatYen(result.totals[m]?.repaymentLong ?? 0)}
                  </td>
                ))}
              </tr>
              <tr className="bg-gray-100 font-semibold">
                <td className="border px-1 py-1 sticky left-0 bg-gray-100 z-10" colSpan={7}></td>
                <td className="border px-1 py-1 text-xs text-gray-600 text-right">
                  支払利息
                </td>
                {months.map((m) => (
                  <td
                    key={m}
                    className={`border px-2 py-1 ${cellBg(m)} text-right text-xs text-blue-700`}
                  >
                    {formatYen(Math.round(result.totals[m]?.interest ?? 0))}
                  </td>
                ))}
              </tr>
              <tr className="bg-gray-200 font-semibold">
                <td className="border px-1 py-1 sticky left-0 bg-gray-200 z-10" colSpan={7}></td>
                <td className="border px-1 py-1 text-xs text-gray-700 text-right">
                  月末残合計
                </td>
                {months.map((m) => (
                  <td key={m} className={`border px-2 py-1 ${cellBg(m)} text-right text-xs`}>
                    {formatYen(result.totals[m]?.balance ?? 0)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <LoanTranscriptionFooter />
    </div>
  );
}
