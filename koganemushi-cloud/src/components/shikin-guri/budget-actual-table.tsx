"use client";

import { useMemo } from "react";
import { useShikinGuriStore, PERIOD_LENGTH_MONTHS } from "@/stores/shikin-guri-store";
import {
  enumerateMonths,
  formatJpMonth,
  formatShortJpMonth,
} from "@/lib/shikin-guri-months";
import { deriveCashflow, isForecastMonth } from "@/lib/shikin-guri-calc";
import { SECTION_LABELS, SUBJECTS } from "@/lib/shikin-guri-subjects";
import { formatYen } from "@/lib/format";
import type { SubjectSection, MonthKey, CashflowMatrix } from "@/types/shikin-guri";

const SECTION_ORDER: SubjectSection[] = ["keijou", "keijouGai", "zaimu"];

const SECTION_BG: Record<SubjectSection, string> = {
  keijou: "",
  keijouGai: "bg-blue-50/30",
  zaimu: "bg-green-50/30",
};
const SECTION_HEADER_BG: Record<SubjectSection, string> = {
  keijou: "bg-gray-100",
  keijouGai: "bg-blue-100",
  zaimu: "bg-green-100",
};

/** サブ列幅（予定/実績/差異 各列） */
const SUB_COL_WIDTH = 72;

const EMPTY_ROW: Record<MonthKey, number> = {};

function snapshotLabel(iso: string | null): string {
  if (!iso) { return ""; }
  const d = new Date(iso);
  if (isNaN(d.getTime())) { return ""; }
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function BudgetActualTable() {
  const period = useShikinGuriStore((s) => s.period);
  const cashflow = useShikinGuriStore((s) => s.cashflow);
  const budget = useShikinGuriStore((s) => s.budget);
  const budgetSnapshotAt = useShikinGuriStore((s) => s.budgetSnapshotAt);
  const captureBudgetSnapshot = useShikinGuriStore((s) => s.captureBudgetSnapshot);

  const months = useMemo(
    () => enumerateMonths(period.startMonth, PERIOD_LENGTH_MONTHS),
    [period.startMonth]
  );

  const actualDerived = useMemo(
    () => deriveCashflow(cashflow, months),
    [cashflow, months]
  );
  const budgetDerived = useMemo(
    () => deriveCashflow(budget ?? { openingBalance: 0, cells: {} }, months),
    [budget, months]
  );

  const handleCapture = (isRecapture: boolean) => {
    if (
      isRecapture &&
      !window.confirm(
        "現在の資金繰り表の数値で予算（予定）を取り直します。既存の予算スナップショットは上書きされます。よろしいですか？"
      )
    ) {
      return;
    }
    captureBudgetSnapshot();
  };

  // 未スナップショット: 空状態
  if (!budget) {
    return (
      <div className="px-4 py-10">
        <div className="max-w-xl mx-auto text-center border rounded bg-white p-8">
          <h2 className="text-lg font-semibold mb-2">予実対比表</h2>
          <p className="text-sm text-gray-600 mb-1">
            予実対比表は「予定（＝確定時点の予測）」と「実績」を対比する表です。
          </p>
          <p className="text-sm text-gray-600 mb-6">
            まず「資金繰り表」タブで予測を入力し、下のボタンで現在の数値を予算として確定してください。
            以降に実績を入力しても、確定した予定は保持されます。
          </p>
          <button
            type="button"
            onClick={() => handleCapture(false)}
            className="text-sm border border-indigo-500 bg-indigo-600 text-white rounded px-5 py-2 hover:bg-indigo-700 transition-colors"
          >
            予算として確定（現在の数値を予定として保存）
          </button>
        </div>
      </div>
    );
  }

  const headerCellClass = (m: MonthKey) =>
    isForecastMonth(m, period.currentMonth) ? "bg-amber-100" : "bg-blue-100";
  const cellBg = (m: MonthKey) =>
    isForecastMonth(m, period.currentMonth) ? "bg-amber-50/40" : "";

  return (
    <div className="px-4 py-4">
      {/* ツールバー */}
      <div className="flex items-center gap-3 mb-2 flex-wrap">
        <button
          type="button"
          onClick={() => handleCapture(true)}
          className="text-xs border border-indigo-500 text-indigo-700 rounded px-3 py-1 hover:bg-indigo-50 transition-colors"
          title="現在の資金繰り表の数値で予算スナップショットを取り直します"
        >
          予算を再取得（現在の数値で取り直す）
        </button>
        <span className="text-xs text-gray-600">
          予算スナップショット：{snapshotLabel(budgetSnapshotAt) || "—"} 時点
        </span>
        <span className="text-xs text-gray-500 ml-auto">
          ＊ 各月＝予定／実績／差異（差異＝実績−予定）。予測月は実績・差異が空欄。青ヘッダ=実績月、橙ヘッダ=予測月。
        </span>
      </div>

      <div className="overflow-x-auto border rounded">
        <table className="border-collapse text-sm">
          <thead className="sticky top-0 z-20">
            <tr>
              <th
                className="border bg-gray-100 px-2 py-1 text-left sticky left-0 z-30 min-w-[220px]"
                rowSpan={2}
              >
                科目
              </th>
              {months.map((m) => (
                <th
                  key={m}
                  className={`border px-1 py-1 text-center ${headerCellClass(m)}`}
                  colSpan={3}
                >
                  {formatShortJpMonth(m)}（
                  {isForecastMonth(m, period.currentMonth) ? "予測" : "実績"}）
                </th>
              ))}
            </tr>
            <tr>
              {months.map((m) => (
                <SubHeader key={m} bg={headerCellClass(m)} />
              ))}
            </tr>
          </thead>

          <tbody>
            {/* 期首現預金残高 */}
            <MonthRow
              label="期首現預金残高"
              labelClass="bg-gray-200/60 font-semibold"
              rowClass="bg-gray-200/60"
              months={months}
              currentMonth={period.currentMonth}
              cellBg={cellBg}
              plan={budgetDerived.opening}
              actual={actualDerived.opening}
              bold
            />

            {SECTION_ORDER.map((section) => {
              const subjects = SUBJECTS.filter((s) => s.section === section).sort(
                (a, b) => a.order - b.order
              );
              const incomeSubjects = subjects.filter((s) => s.kind === "income");
              const expenseSubjects = subjects.filter((s) => s.kind === "expense");
              const pick = (
                d: ReturnType<typeof deriveCashflow>,
                kind: "income" | "expense" | "net"
              ) =>
                section === "keijou"
                  ? kind === "income"
                    ? d.keijouIncome
                    : kind === "expense"
                    ? d.keijouExpense
                    : d.keijouNet
                  : section === "keijouGai"
                  ? kind === "income"
                    ? d.keijouGaiIncome
                    : kind === "expense"
                    ? d.keijouGaiExpense
                    : d.keijouGaiNet
                  : kind === "income"
                  ? d.zaimuIncome
                  : kind === "expense"
                  ? d.zaimuExpense
                  : d.zaimuNet;

              return (
                <Section
                  key={section}
                  section={section}
                  incomeSubjects={incomeSubjects}
                  expenseSubjects={expenseSubjects}
                  months={months}
                  currentMonth={period.currentMonth}
                  cellBg={cellBg}
                  budgetCells={budget.cells}
                  actualCells={cashflow.cells}
                  planIncome={pick(budgetDerived, "income")}
                  actualIncome={pick(actualDerived, "income")}
                  planExpense={pick(budgetDerived, "expense")}
                  actualExpense={pick(actualDerived, "expense")}
                  planNet={pick(budgetDerived, "net")}
                  actualNet={pick(actualDerived, "net")}
                />
              );
            })}

            {/* 月次収支計 */}
            <MonthRow
              label="月次収支計"
              labelClass="bg-yellow-50"
              rowClass="bg-yellow-50 font-semibold"
              months={months}
              currentMonth={period.currentMonth}
              cellBg={cellBg}
              plan={budgetDerived.monthlyNet}
              actual={actualDerived.monthlyNet}
              bold
            />

            {/* 期末現預金残高 */}
            <MonthRow
              label="期末現預金残高"
              labelClass="bg-gray-200/80"
              rowClass="bg-gray-200/80 font-semibold"
              months={months}
              currentMonth={period.currentMonth}
              cellBg={cellBg}
              plan={budgetDerived.closing}
              actual={actualDerived.closing}
              bold
            />
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SubHeader({ bg }: { bg: string }) {
  return (
    <>
      <th
        className={`border px-1 py-0.5 text-[10px] text-center ${bg}`}
        style={{ minWidth: SUB_COL_WIDTH }}
      >
        予定
      </th>
      <th
        className={`border px-1 py-0.5 text-[10px] text-center ${bg}`}
        style={{ minWidth: SUB_COL_WIDTH }}
      >
        実績
      </th>
      <th
        className={`border px-1 py-0.5 text-[10px] text-center ${bg}`}
        style={{ minWidth: SUB_COL_WIDTH }}
      >
        差異
      </th>
    </>
  );
}

interface TripletProps {
  m: MonthKey;
  currentMonth: MonthKey;
  planValue: number;
  actualValue: number;
  cellBg: (m: MonthKey) => string;
  bold?: boolean;
}

/** 1ヶ月分の 予定/実績/差異 セル（予測月は実績・差異を空欄） */
function Triplet({
  m,
  currentMonth,
  planValue,
  actualValue,
  cellBg,
  bold,
}: TripletProps) {
  const isForecast = isForecastMonth(m, currentMonth);
  const bg = cellBg(m);
  const weight = bold ? "font-semibold" : "";
  const diff = actualValue - planValue;
  const numCls = "border px-2 py-1 text-right truncate";
  return (
    <>
      <td className={`${numCls} ${bg} ${weight} ${planValue < 0 ? "text-red-600" : ""}`}>
        {formatYen(planValue)}
      </td>
      <td className={`${numCls} ${bg} ${weight} ${actualValue < 0 ? "text-red-600" : ""}`}>
        {isForecast ? "" : formatYen(actualValue)}
      </td>
      <td
        className={`${numCls} ${bg} ${weight} ${
          !isForecast && diff < 0 ? "text-red-600" : "text-gray-500"
        }`}
      >
        {isForecast ? "" : formatYen(diff)}
      </td>
    </>
  );
}

interface MonthRowProps {
  label: string;
  labelClass: string;
  rowClass: string;
  months: MonthKey[];
  currentMonth: MonthKey;
  cellBg: (m: MonthKey) => string;
  plan: Record<MonthKey, number>;
  actual: Record<MonthKey, number>;
  bold?: boolean;
}

function MonthRow({
  label,
  labelClass,
  rowClass,
  months,
  currentMonth,
  cellBg,
  plan,
  actual,
  bold,
}: MonthRowProps) {
  return (
    <tr className={rowClass}>
      <td className={`border px-2 py-1 sticky left-0 z-10 ${labelClass}`}>{label}</td>
      {months.map((m) => (
        <Triplet
          key={m}
          m={m}
          currentMonth={currentMonth}
          planValue={plan[m] ?? 0}
          actualValue={actual[m] ?? 0}
          cellBg={cellBg}
          bold={bold}
        />
      ))}
    </tr>
  );
}

interface SectionProps {
  section: SubjectSection;
  incomeSubjects: { id: string; label: string }[];
  expenseSubjects: { id: string; label: string }[];
  months: MonthKey[];
  currentMonth: MonthKey;
  cellBg: (m: MonthKey) => string;
  budgetCells: CashflowMatrix["cells"];
  actualCells: CashflowMatrix["cells"];
  planIncome: Record<MonthKey, number>;
  actualIncome: Record<MonthKey, number>;
  planExpense: Record<MonthKey, number>;
  actualExpense: Record<MonthKey, number>;
  planNet: Record<MonthKey, number>;
  actualNet: Record<MonthKey, number>;
}

function Section({
  section,
  incomeSubjects,
  expenseSubjects,
  months,
  currentMonth,
  cellBg,
  budgetCells,
  actualCells,
  planIncome,
  actualIncome,
  planExpense,
  actualExpense,
  planNet,
  actualNet,
}: SectionProps) {
  const sectionBg = SECTION_BG[section];
  const headerBg = SECTION_HEADER_BG[section];

  return (
    <>
      <tr className={headerBg}>
        <td
          className={`border px-2 py-1 sticky left-0 z-10 ${headerBg} font-semibold`}
        >
          {SECTION_LABELS[section]}
        </td>
        <td className={`border px-2 py-1 ${headerBg}`} colSpan={months.length * 3}></td>
      </tr>

      {incomeSubjects.map((s) => (
        <tr key={s.id} className={sectionBg}>
          <td className="border px-2 py-1 sticky left-0 z-10 bg-white text-gray-700">
            　{s.label}
          </td>
          {months.map((m) => (
            <Triplet
              key={m}
              m={m}
              currentMonth={currentMonth}
              planValue={(budgetCells[s.id] ?? EMPTY_ROW)[m] ?? 0}
              actualValue={(actualCells[s.id] ?? EMPTY_ROW)[m] ?? 0}
              cellBg={cellBg}
            />
          ))}
        </tr>
      ))}
      <tr className={`${sectionBg} font-medium`}>
        <td className="border px-2 py-1 sticky left-0 z-10 bg-gray-50">　収入計</td>
        {months.map((m) => (
          <Triplet
            key={m}
            m={m}
            currentMonth={currentMonth}
            planValue={planIncome[m] ?? 0}
            actualValue={actualIncome[m] ?? 0}
            cellBg={cellBg}
          />
        ))}
      </tr>

      {expenseSubjects.map((s) => (
        <tr key={s.id} className={sectionBg}>
          <td className="border px-2 py-1 sticky left-0 z-10 bg-white text-gray-700">
            　{s.label}
          </td>
          {months.map((m) => (
            <Triplet
              key={m}
              m={m}
              currentMonth={currentMonth}
              planValue={(budgetCells[s.id] ?? EMPTY_ROW)[m] ?? 0}
              actualValue={(actualCells[s.id] ?? EMPTY_ROW)[m] ?? 0}
              cellBg={cellBg}
            />
          ))}
        </tr>
      ))}
      <tr className={`${sectionBg} font-medium`}>
        <td className="border px-2 py-1 sticky left-0 z-10 bg-gray-50">　支出計</td>
        {months.map((m) => (
          <Triplet
            key={m}
            m={m}
            currentMonth={currentMonth}
            planValue={planExpense[m] ?? 0}
            actualValue={actualExpense[m] ?? 0}
            cellBg={cellBg}
          />
        ))}
      </tr>

      <tr className={`${sectionBg} font-semibold`}>
        <td className="border px-2 py-1 sticky left-0 z-10 bg-gray-100">
          　{SECTION_LABELS[section]}
        </td>
        {months.map((m) => (
          <Triplet
            key={m}
            m={m}
            currentMonth={currentMonth}
            planValue={planNet[m] ?? 0}
            actualValue={actualNet[m] ?? 0}
            cellBg={cellBg}
            bold
          />
        ))}
      </tr>
    </>
  );
}
