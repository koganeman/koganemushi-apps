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
import type {
  LoanRepaymentMethod,
  LoanRow,
  LoanType,
  MonthKey,
} from "@/types/shikin-guri";

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
  const fillLoanMonthValueFrom = useShikinGuriStore(
    (s) => s.fillLoanMonthValueFrom
  );

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
  const onRepaymentMethodChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateLoanRow(row.id, {
        repaymentMethod: e.target.value as LoanRepaymentMethod,
      });
    },
    [row.id, updateLoanRow]
  );
  const onMonthlyPaymentChange = useCallback(
    (v: number) => updateLoanRow(row.id, { monthlyPayment: v }),
    [row.id, updateLoanRow]
  );
  const onTermMonthsChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const n = parseInt(e.target.value, 10);
      updateLoanRow(row.id, {
        amortizationTermMonths: Number.isFinite(n) && n > 0 ? n : 0,
      });
    },
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
  const fillRepaymentRight = useCallback(
    (fromMonth: MonthKey, value: number) => {
      if (value === 0) {
        return;
      }
      fillLoanMonthValueFrom(row.id, "repayment", fromMonth, value);
    },
    [row.id, fillLoanMonthValueFrom]
  );
  const setInterestOverride = useCallback(
    (month: MonthKey, value: number) =>
      setLoanMonthValue(row.id, "interestOverride", month, value),
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
        <td className="border px-1 py-0.5 text-center" rowSpan={3}>
          <select
            value={row.repaymentMethod ?? "equal-principal"}
            onChange={onRepaymentMethodChange}
            className="px-1 py-0.5 outline-none focus:ring-1 focus:ring-blue-400"
            aria-label={`返済方式 ${rowIndex + 1}`}
          >
            <option value="equal-principal">元金均等</option>
            <option value="equal-installment">元利均等</option>
          </select>
        </td>
        <td className="border px-1 py-0.5" rowSpan={3}>
          <EditableYenCell
            value={row.monthlyPayment ?? 0}
            onChange={onMonthlyPaymentChange}
            readOnly={
              (row.repaymentMethod ?? "equal-principal") !== "equal-installment"
            }
            bg={
              (row.repaymentMethod ?? "equal-principal") !== "equal-installment"
                ? "bg-gray-50"
                : ""
            }
            ariaLabel={`月次返済額 ${rowIndex + 1}`}
          />
        </td>
        <td className="border px-1 py-0.5" rowSpan={3}>
          <input
            type="number"
            min={0}
            value={row.amortizationTermMonths || ""}
            onChange={onTermMonthsChange}
            disabled={
              (row.repaymentMethod ?? "equal-principal") !== "equal-installment"
            }
            className="w-full px-1 py-0.5 text-right outline-none focus:bg-white focus:ring-1 focus:ring-blue-400 disabled:bg-gray-50 disabled:text-gray-400"
            aria-label={`返済期間(月) ${rowIndex + 1}`}
            placeholder="60"
          />
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
        {months.map((m) => {
          const isInstallment =
            (row.repaymentMethod ?? "equal-principal") === "equal-installment";
          const displayValue = isInstallment
            ? Math.round(perMonth[m]?.repayment ?? 0)
            : row.repayment[m] ?? 0;
          return (
            <td
              key={m}
              className={`border ${cellBg(m)} relative group/repay`}
            >
              <EditableYenCell
                value={displayValue}
                onChange={(v) => setRepayment(m, v)}
                bg={cellBg(m)}
                ariaLabel={`${rowIndex + 1}行 ${m} 返済`}
              />
              {!isInstallment && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => fillRepaymentRight(m, row.repayment[m] ?? 0)}
                  className="absolute right-0 top-1/2 -translate-y-1/2 hidden group-hover/repay:flex w-4 h-5 items-center justify-center text-[10px] text-blue-700 bg-white border border-blue-300 rounded hover:bg-blue-100"
                  title="この月以降の返済をこの値で埋める（元金均等用）"
                  aria-label={`${rowIndex + 1}行 ${m} 返済を右へコピー`}
                >
                  →
                </button>
              )}
            </td>
          );
        })}
      </tr>
      <tr className="bg-gray-50/30">
        <td className="border px-1 py-0.5 bg-gray-100 text-xs text-gray-600 text-right">
          月末残 / 利息
        </td>
        {months.map((m) => {
          const r = perMonth[m];
          const isInterestOverridden = (row.interestOverride?.[m] ?? 0) > 0;
          return (
            <td key={m} className={`border px-1 py-0.5 ${cellBg(m)} text-right text-xs`}>
              <div className="text-gray-700">{formatYen(r?.balance ?? 0)}</div>
              <div
                className="text-blue-700"
                title={
                  isInterestOverridden
                    ? undefined
                    : "自動算出値（概算）。直接入力で上書きできます"
                }
              >
                <EditableYenCell
                  value={Math.round(r?.interest ?? 0)}
                  onChange={(v) => setInterestOverride(m, v)}
                  bg={cellBg(m)}
                  ariaLabel={`${rowIndex + 1}行 ${m} 利息`}
                />
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
          ＊ 20行固定。年利率は％で入力（例: 1.70）。
          元金均等＝返済額を直接入力（「→」で右コピー可）。
          元利均等＝月次返済額か返済期間のどちらかを入力（両方入力時は月次返済額を優先）。
          返済・利息セルは直接入力で上書き可能（0 のとき自動算出を使用）。
          ※自動算出される利息は概算です（=月末残×年利率×当月日数÷365）。銀行の返済予定表と差異がある場合は直接入力で上書きしてください。
          青ヘッダ=実績月、橙ヘッダ=予測月。
        </div>
        <div className="overflow-x-auto border rounded">
          <table className="border-collapse text-sm">
            <thead className="sticky top-0 z-20">
              <tr>
                <th className="border bg-gray-100 px-1 py-1 sticky left-0 z-30 w-8" rowSpan={2}>
                  #
                </th>
                <th className="border bg-gray-100 px-2 py-1 min-w-[180px]" rowSpan={2}>
                  金融機関名
                </th>
                <th className="border bg-gray-100 px-2 py-1 min-w-[140px]" rowSpan={2}>
                  摘要
                </th>
                <th className="border bg-gray-100 px-2 py-1 min-w-[70px]" rowSpan={2}>
                  種別
                </th>
                <th className="border bg-gray-100 px-2 py-1 min-w-[110px]" rowSpan={2}>
                  当初借入額
                </th>
                <th className="border bg-gray-100 px-2 py-1 min-w-[110px]" rowSpan={2}>
                  期首残高
                </th>
                <th className="border bg-gray-100 px-2 py-1 min-w-[80px]" rowSpan={2}>
                  年利率(%)
                </th>
                <th className="border bg-gray-100 px-2 py-1 min-w-[90px]" rowSpan={2}>
                  返済方式
                </th>
                <th className="border bg-gray-100 px-2 py-1 min-w-[110px]" rowSpan={2}>
                  月次返済額
                </th>
                <th className="border bg-gray-100 px-2 py-1 min-w-[80px]" rowSpan={2}>
                  返済期間(月)
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
                    style={{ minWidth: COL_WIDTH, width: COL_WIDTH }}
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
                <td className="border px-1 py-1 sticky left-0 bg-gray-100 z-10 w-8 text-center">
                  合計
                </td>
                <td className="border px-1 py-1 bg-gray-100" colSpan={9}></td>
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
                <td className="border px-1 py-1 sticky left-0 bg-gray-100 z-10 w-8"></td>
                <td className="border px-1 py-1 bg-gray-100" colSpan={9}></td>
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
                <td className="border px-1 py-1 sticky left-0 bg-gray-100 z-10 w-8"></td>
                <td className="border px-1 py-1 bg-gray-100" colSpan={9}></td>
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
                <td className="border px-1 py-1 sticky left-0 bg-gray-100 z-10 w-8"></td>
                <td className="border px-1 py-1 bg-gray-100" colSpan={9}></td>
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
                <td className="border px-1 py-1 sticky left-0 bg-gray-100 z-10 w-8"></td>
                <td className="border px-1 py-1 bg-gray-100" colSpan={9}></td>
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
                <td className="border px-1 py-1 sticky left-0 bg-gray-200 z-10 w-8"></td>
                <td className="border px-1 py-1 bg-gray-200" colSpan={9}></td>
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
