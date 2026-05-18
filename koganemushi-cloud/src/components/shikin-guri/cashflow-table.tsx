"use client";

import { memo, useCallback, useMemo, useState } from "react";
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
import { CopyColumnDialog } from "./copy-column-dialog";
import { MeisaiPopup } from "./meisai-popup";
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

/** readOnly セル用の安定参照（毎レンダーで新規関数を作らずmemoを効かせる） */
const NOOP = (): void => {};

/** SUBJECTS はモジュール定数。セクション別の収入/支出リストを一度だけ算出。 */
const SECTION_SUBJECTS: Record<
  SubjectSection,
  { income: { id: string; label: string }[]; expense: { id: string; label: string }[] }
> = (() => {
  const out = {} as Record<
    SubjectSection,
    { income: { id: string; label: string }[]; expense: { id: string; label: string }[] }
  >;
  for (const section of SECTION_ORDER) {
    const subjects = SUBJECTS.filter((s) => s.section === section).sort(
      (a, b) => a.order - b.order
    );
    out[section] = {
      income: subjects.filter((s) => s.kind === "income"),
      expense: subjects.filter((s) => s.kind === "expense"),
    };
  }
  return out;
})();

export function CashflowTable() {
  const period = useShikinGuriStore((s) => s.period);
  const cashflow = useShikinGuriStore((s) => s.cashflow);
  const meisai = useShikinGuriStore((s) => s.meisai);
  const setCell = useShikinGuriStore((s) => s.setCashflowCell);
  const setOpening = useShikinGuriStore((s) => s.setOpeningBalance);
  const setPeriod = useShikinGuriStore((s) => s.setPeriod);

  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [meisaiPopup, setMeisaiPopup] = useState<{ subjectId: string; month?: MonthKey } | null>(null);

  const months = useMemo(
    () => enumerateMonths(period.startMonth, PERIOD_LENGTH_MONTHS),
    [period.startMonth]
  );

  const derived = useMemo(() => deriveCashflow(cashflow, months), [cashflow, months]);

  /** 明細データがある (subjectId, month) のキーセット ＋ 科目だけのセット */
  const { meisaiSubjects, meisaiSubjectMonth } = useMemo(() => {
    const subjects = new Set<string>();
    const cells = new Set<string>();
    for (const row of meisai) {
      subjects.add(row.subjectId);
      for (const [m, v] of Object.entries(row.amounts)) {
        if (v !== 0) { cells.add(`${row.subjectId}|${m}`); }
      }
    }
    return { meisaiSubjects: subjects, meisaiSubjectMonth: cells };
  }, [meisai]);

  const headerCellClass = useCallback(
    (m: MonthKey) =>
      isForecastMonth(m, period.currentMonth) ? "bg-amber-100" : "bg-blue-100",
    [period.currentMonth]
  );
  const cellBg = useCallback(
    (m: MonthKey) =>
      isForecastMonth(m, period.currentMonth) ? "bg-amber-50/40" : "",
    [period.currentMonth]
  );
  const onOpenMeisai = useCallback(
    (subjectId: string, month?: MonthKey) =>
      setMeisaiPopup({ subjectId, month }),
    []
  );

  return (
    <div className="px-4 py-4">
      {/* ツールバー */}
      <div className="flex items-center gap-2 mb-2">
        <CsvImportButton label="CSV取込（資金繰り表）" mode="cashflow" title="資金繰り実績表CSVを取り込む" />
        <CsvImportButton label="CSV取込（明細表）" mode="meisai" title="明細表CSVを取り込む" />
        <button
          type="button"
          onClick={() => setShowCopyDialog(true)}
          className="text-xs border border-green-500 text-green-700 rounded px-3 py-1 hover:bg-green-50 transition-colors"
        >
          列の値を予測月にコピー…
        </button>
        <span className="text-xs text-gray-500 ml-2">
          ＊ 青ヘッダ=実績月、橙ヘッダ=予測月。月ヘッダ右の ▸ ボタンで「現在月」を変更可能。科目名 / セルクリックで明細表示。
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
                      onChange={NOOP}
                      readOnly
                      bg="bg-gray-100/50"
                    />
                  )}
                </td>
              ))}
            </tr>

            {/* セクションごと */}
            {SECTION_ORDER.map((section) => (
              <SectionGroup
                key={section}
                section={section}
                incomeSubjects={SECTION_SUBJECTS[section].income}
                expenseSubjects={SECTION_SUBJECTS[section].expense}
                months={months}
                derived={derived}
                cellBg={cellBg}
                setCell={setCell}
                cashflow={cashflow}
                meisaiSubjects={meisaiSubjects}
                meisaiSubjectMonth={meisaiSubjectMonth}
                onOpenMeisai={onOpenMeisai}
              />
            ))}

            {/* 月次収支計 */}
            <tr className="bg-yellow-50 font-semibold">
              <td className="border px-2 py-1 sticky left-0 z-10 bg-yellow-50">月次収支計</td>
              {months.map((m) => (
                <td key={m} className={`border p-0 ${cellBg(m)}`}>
                  <EditableYenCell
                    value={derived.monthlyNet[m] ?? 0}
                    onChange={NOOP}
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
                    onChange={NOOP}
                    readOnly
                    bold
                  />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {showCopyDialog && <CopyColumnDialog onClose={() => setShowCopyDialog(false)} />}
      {meisaiPopup && (
        <MeisaiPopup
          subjectId={meisaiPopup.subjectId}
          month={meisaiPopup.month}
          onClose={() => setMeisaiPopup(null)}
        />
      )}
    </div>
  );
}

interface SectionGroupProps {
  section: SubjectSection;
  incomeSubjects: { id: string; label: string }[];
  expenseSubjects: { id: string; label: string }[];
  months: MonthKey[];
  derived: ReturnType<typeof deriveCashflow>;
  cellBg: (m: MonthKey) => string;
  setCell: (subjectId: string, m: MonthKey, value: number) => void;
  cashflow: { cells: Record<string, Record<MonthKey, number>> };
  meisaiSubjects: Set<string>;
  meisaiSubjectMonth: Set<string>;
  onOpenMeisai: (subjectId: string, month?: MonthKey) => void;
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
  meisaiSubjects,
  meisaiSubjectMonth,
  onOpenMeisai,
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
        <SubjectRow
          key={s.id}
          subject={s}
          months={months}
          sectionBg={sectionBg}
          cellBg={cellBg}
          row={cashflow.cells[s.id]}
          setCell={setCell}
          meisaiSubjects={meisaiSubjects}
          meisaiSubjectMonth={meisaiSubjectMonth}
          onOpenMeisai={onOpenMeisai}
        />
      ))}
      <tr className={`${sectionBg} font-medium`}>
        <td className="border px-2 py-1 sticky left-0 z-10 bg-gray-50">　収入計</td>
        {months.map((m) => (
          <td key={m} className={`border p-0 ${cellBg(m)} bg-gray-50/80`}>
            <EditableYenCell value={incomeKey[m] ?? 0} onChange={NOOP} readOnly />
          </td>
        ))}
      </tr>

      {/* 支出科目 */}
      {expenseSubjects.map((s) => (
        <SubjectRow
          key={s.id}
          subject={s}
          months={months}
          sectionBg={sectionBg}
          cellBg={cellBg}
          row={cashflow.cells[s.id]}
          setCell={setCell}
          meisaiSubjects={meisaiSubjects}
          meisaiSubjectMonth={meisaiSubjectMonth}
          onOpenMeisai={onOpenMeisai}
        />
      ))}
      <tr className={`${sectionBg} font-medium`}>
        <td className="border px-2 py-1 sticky left-0 z-10 bg-gray-50">　支出計</td>
        {months.map((m) => (
          <td key={m} className={`border p-0 ${cellBg(m)} bg-gray-50/80`}>
            <EditableYenCell value={expenseKey[m] ?? 0} onChange={NOOP} readOnly />
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
            <EditableYenCell value={netKey[m] ?? 0} onChange={NOOP} readOnly bold />
          </td>
        ))}
      </tr>
    </>
  );
}

interface SubjectRowProps {
  subject: { id: string; label: string };
  months: MonthKey[];
  sectionBg: string;
  cellBg: (m: MonthKey) => string;
  /** この科目の月→金額（ストアが科目単位で不変更新するため、編集科目のみ参照が変わる） */
  row: Record<MonthKey, number> | undefined;
  setCell: (subjectId: string, m: MonthKey, value: number) => void;
  meisaiSubjects: Set<string>;
  meisaiSubjectMonth: Set<string>;
  onOpenMeisai: (subjectId: string, month?: MonthKey) => void;
}

/**
 * memo化により、setCashflowCell が編集科目の row 参照のみ更新する性質を
 * 利用して「編集した科目の行だけ」再描画する（他科目の36セルは据え置き）。
 */
const SubjectRow = memo(function SubjectRow({
  subject: s,
  months,
  sectionBg,
  cellBg,
  row,
  setCell,
  meisaiSubjects,
  meisaiSubjectMonth,
  onOpenMeisai,
}: SubjectRowProps) {
  const labelClickable = meisaiSubjects.has(s.id);
  return (
    <tr className={sectionBg}>
      <td className="border px-2 py-1 sticky left-0 z-10 bg-white">
        {labelClickable ? (
          <button
            type="button"
            onClick={() => onOpenMeisai(s.id)}
            className="text-left w-full text-blue-700 hover:underline"
            title={`${s.label} の明細を表示`}
          >
            　{s.label}
          </button>
        ) : (
          <span className="text-gray-700" title="明細表CSVを取込むと内訳表示が利用できます">
            　{s.label}
          </span>
        )}
      </td>
      {months.map((m) => {
        const hasMeisai = meisaiSubjectMonth.has(`${s.id}|${m}`);
        return (
          <td key={m} className={`border p-0 ${cellBg(m)} relative group`}>
            <EditableYenCell
              value={row?.[m] ?? 0}
              onChange={(v) => setCell(s.id, m, v)}
              ariaLabel={`${s.label} ${m}`}
            />
            {hasMeisai && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenMeisai(s.id, m);
                }}
                title={`${s.label} ${m} の明細を表示`}
                className="absolute top-0 right-0 text-[10px] leading-none px-1 py-0.5 text-blue-600 bg-white/70 rounded-bl opacity-0 group-hover:opacity-100 hover:bg-blue-100"
              >
                🔍
              </button>
            )}
          </td>
        );
      })}
    </tr>
  );
});

