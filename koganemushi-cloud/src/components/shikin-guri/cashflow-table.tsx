"use client";

import { useMemo, useState } from "react";
import { useShikinGuriStore, PERIOD_LENGTH_MONTHS } from "@/stores/shikin-guri-store";
import {
  enumerateMonths,
  formatJpMonth,
  formatShortJpMonth,
} from "@/lib/shikin-guri-months";
import { deriveCashflow, isForecastMonth } from "@/lib/shikin-guri-calc";
import {
  SECTION_LABELS,
  SUBJECTS,
} from "@/lib/shikin-guri-subjects";
import { EditableYenCell } from "./editable-yen-cell";
import { CsvImportButton } from "./csv-import-button";
import { PastAverageDialog } from "./past-average-dialog";
import type { SubjectSection, MonthKey } from "@/types/shikin-guri";

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

const COL_WIDTH = 110;

export function CashflowTable() {
  const period = useShikinGuriStore((s) => s.period);
  const cashflow = useShikinGuriStore((s) => s.cashflow);
  const setCell = useShikinGuriStore((s) => s.setCashflowCell);
  const setOpening = useShikinGuriStore((s) => s.setOpeningBalance);
  const setPeriod = useShikinGuriStore((s) => s.setPeriod);

  const [showAvgDialog, setShowAvgDialog] = useState(false);

  const months = useMemo(
    () => enumerateMonths(period.startMonth, PERIOD_LENGTH_MONTHS),
    [period.startMonth]
  );

  const derived = useMemo(() => deriveCashflow(cashflow, months), [cashflow, months]);

  const headerCellClass = (m: MonthKey) =>
    isForecastMonth(m, period.currentMonth) ? "bg-amber-100" : "bg-blue-100";
  const cellBg = (m: MonthKey) =>
    isForecastMonth(m, period.currentMonth) ? "bg-amber-50/40" : "";

  return (
    <div className="px-4 py-4">
      {/* ツールバー */}
      <div className="flex items-center gap-2 mb-2">
        <CsvImportButton label="CSV取込（資金繰り表）" mode="cashflow" title="資金繰り実績表CSVを取り込む" />
        <button
          type="button"
          onClick={() => setShowAvgDialog(true)}
          className="text-xs border border-green-500 text-green-700 rounded px-3 py-1 hover:bg-green-50 transition-colors"
        >
          過去平均で予測月を埋める…
        </button>
        <span className="text-xs text-gray-500 ml-2">
          ＊ 青ヘッダ=実績月、橙ヘッダ=予測月。月ヘッダ右の ▸ ボタンで「現在月」を変更可能。
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
                  style={{ minWidth: COL_WIDTH }}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>{formatShortJpMonth(m)}</span>
                    <button
                      type="button"
                      onClick={() => setPeriod({ currentMonth: m })}
                      title={`${formatJpMonth(m)} を現在月に設定`}
                      className="text-[10px] text-gray-500 hover:text-blue-600"
                    >
                      ▸
                    </button>
                  </div>
                </th>
              ))}
            </tr>
            <tr>
              {months.map((m) => (
                <th
                  key={m}
                  className={`border px-1 py-0.5 text-[10px] text-center ${headerCellClass(m)}`}
                >
                  {isForecastMonth(m, period.currentMonth) ? "予測" : "実績"}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {/* 期首現預金（先頭月のみ入力可） */}
            <tr className="bg-gray-200/60">
              <td className="border px-2 py-1 sticky left-0 z-10 bg-gray-200/60 font-semibold">
                期首現預金残高
              </td>
              {months.map((m, idx) => (
                <td key={m} className={`border p-0 ${cellBg(m)}`}>
                  {idx === 0 ? (
                    <EditableYenCell
                      value={cashflow.openingBalance}
                      onChange={setOpening}
                      bold
                      ariaLabel="期首現預金残高"
                    />
                  ) : (
                    <EditableYenCell
                      value={derived.opening[m] ?? 0}
                      onChange={() => {}}
                      readOnly
                      bg="bg-gray-100/50"
                    />
                  )}
                </td>
              ))}
            </tr>

            {/* セクションごと */}
            {SECTION_ORDER.map((section) => {
              const subjects = SUBJECTS.filter((s) => s.section === section).sort(
                (a, b) => a.order - b.order
              );
              const incomeSubjects = subjects.filter((s) => s.kind === "income");
              const expenseSubjects = subjects.filter((s) => s.kind === "expense");
              return (
                <SectionGroup
                  key={section}
                  section={section}
                  incomeSubjects={incomeSubjects}
                  expenseSubjects={expenseSubjects}
                  months={months}
                  derived={derived}
                  cellBg={cellBg}
                  setCell={setCell}
                  cashflow={cashflow}
                />
              );
            })}

            {/* 月次収支計 */}
            <tr className="bg-yellow-50 font-semibold">
              <td className="border px-2 py-1 sticky left-0 z-10 bg-yellow-50">月次収支計</td>
              {months.map((m) => (
                <td key={m} className={`border p-0 ${cellBg(m)}`}>
                  <EditableYenCell
                    value={derived.monthlyNet[m] ?? 0}
                    onChange={() => {}}
                    readOnly
                    bold
                  />
                </td>
              ))}
            </tr>

            {/* 期末現預金残高 */}
            <tr className="bg-gray-200/80 font-semibold">
              <td className="border px-2 py-1 sticky left-0 z-10 bg-gray-200/80">
                期末現預金残高
              </td>
              {months.map((m) => (
                <td key={m} className={`border p-0 ${cellBg(m)}`}>
                  <EditableYenCell
                    value={derived.closing[m] ?? 0}
                    onChange={() => {}}
                    readOnly
                    bold
                  />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {showAvgDialog && <PastAverageDialog onClose={() => setShowAvgDialog(false)} />}
    </div>
  );
}

// 二重 EditableYenCell 行（収入/支出の見出し）
interface SectionGroupProps {
  section: SubjectSection;
  incomeSubjects: { id: string; label: string }[];
  expenseSubjects: { id: string; label: string }[];
  months: MonthKey[];
  derived: ReturnType<typeof deriveCashflow>;
  cellBg: (m: MonthKey) => string;
  setCell: (subjectId: string, m: MonthKey, value: number) => void;
  cashflow: { cells: Record<string, Record<MonthKey, number>> };
}

function SectionGroup({
  section,
  incomeSubjects,
  expenseSubjects,
  months,
  derived,
  cellBg,
  setCell,
  cashflow,
}: SectionGroupProps) {
  const sectionBg = SECTION_BG[section];
  const headerBg = SECTION_HEADER_BG[section];

  const incomeKey =
    section === "keijou"
      ? derived.keijouIncome
      : section === "keijouGai"
      ? derived.keijouGaiIncome
      : derived.zaimuIncome;
  const expenseKey =
    section === "keijou"
      ? derived.keijouExpense
      : section === "keijouGai"
      ? derived.keijouGaiExpense
      : derived.zaimuExpense;
  const netKey =
    section === "keijou"
      ? derived.keijouNet
      : section === "keijouGai"
      ? derived.keijouGaiNet
      : derived.zaimuNet;

  return (
    <>
      <tr className={headerBg}>
        <td
          className={`border px-2 py-1 sticky left-0 z-10 ${headerBg} font-semibold`}
          colSpan={1}
        >
          {SECTION_LABELS[section]}
        </td>
        <td className={`border px-2 py-1 ${headerBg}`} colSpan={months.length}></td>
      </tr>

      {/* 収入科目 */}
      {incomeSubjects.map((s) => (
        <tr key={s.id} className={sectionBg}>
          <td className="border px-2 py-1 sticky left-0 z-10 bg-white">
            　{s.label}
          </td>
          {months.map((m) => (
            <td key={m} className={`border p-0 ${cellBg(m)}`}>
              <EditableYenCell
                value={cashflow.cells[s.id]?.[m] ?? 0}
                onChange={(v) => setCell(s.id, m, v)}
                ariaLabel={`${s.label} ${m}`}
              />
            </td>
          ))}
        </tr>
      ))}
      <tr className={`${sectionBg} font-medium`}>
        <td className="border px-2 py-1 sticky left-0 z-10 bg-gray-50">　収入計</td>
        {months.map((m) => (
          <td key={m} className={`border p-0 ${cellBg(m)} bg-gray-50/80`}>
            <EditableYenCell value={incomeKey[m] ?? 0} onChange={() => {}} readOnly />
          </td>
        ))}
      </tr>

      {/* 支出科目 */}
      {expenseSubjects.map((s) => (
        <tr key={s.id} className={sectionBg}>
          <td className="border px-2 py-1 sticky left-0 z-10 bg-white">
            　{s.label}
          </td>
          {months.map((m) => (
            <td key={m} className={`border p-0 ${cellBg(m)}`}>
              <EditableYenCell
                value={cashflow.cells[s.id]?.[m] ?? 0}
                onChange={(v) => setCell(s.id, m, v)}
                ariaLabel={`${s.label} ${m}`}
              />
            </td>
          ))}
        </tr>
      ))}
      <tr className={`${sectionBg} font-medium`}>
        <td className="border px-2 py-1 sticky left-0 z-10 bg-gray-50">　支出計</td>
        {months.map((m) => (
          <td key={m} className={`border p-0 ${cellBg(m)} bg-gray-50/80`}>
            <EditableYenCell value={expenseKey[m] ?? 0} onChange={() => {}} readOnly />
          </td>
        ))}
      </tr>

      {/* セクション収支 */}
      <tr className={`${sectionBg} font-semibold`}>
        <td className="border px-2 py-1 sticky left-0 z-10 bg-gray-100">
          　{SECTION_LABELS[section]}
        </td>
        {months.map((m) => (
          <td key={m} className={`border p-0 ${cellBg(m)} bg-gray-100/80`}>
            <EditableYenCell value={netKey[m] ?? 0} onChange={() => {}} readOnly bold />
          </td>
        ))}
      </tr>
    </>
  );
}

