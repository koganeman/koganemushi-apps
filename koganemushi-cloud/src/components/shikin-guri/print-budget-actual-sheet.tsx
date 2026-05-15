import { Fragment } from "react";
import { deriveCashflow, isForecastMonth } from "@/lib/shikin-guri-calc";
import { formatJpMonth, formatShortJpMonth } from "@/lib/shikin-guri-months";
import { SECTION_LABELS, SUBJECTS } from "@/lib/shikin-guri-subjects";
import { formatYen } from "@/lib/format";
import type {
  CashflowMatrix,
  MonthKey,
  SubjectSection,
} from "@/types/shikin-guri";

const SECTION_ORDER: SubjectSection[] = ["keijou", "keijouGai", "zaimu"];
const EMPTY_ROW: Record<MonthKey, number> = {};

interface Props {
  months: MonthKey[];
  budget: CashflowMatrix;
  cashflow: CashflowMatrix;
  currentMonth: MonthKey;
  title?: string;
}

function Triplet({
  m,
  currentMonth,
  planValue,
  actualValue,
}: {
  m: MonthKey;
  currentMonth: MonthKey;
  planValue: number;
  actualValue: number;
}) {
  const isForecast = isForecastMonth(m, currentMonth);
  return (
    <>
      <td className="num">{formatYen(planValue)}</td>
      <td className="num">{isForecast ? "" : formatYen(actualValue)}</td>
      <td className="num">{isForecast ? "" : formatYen(actualValue - planValue)}</td>
    </>
  );
}

export function PrintBudgetActualSheet({
  months,
  budget,
  cashflow,
  currentMonth,
  title = "予実対比表",
}: Props) {
  const planD = deriveCashflow(budget, months);
  const actD = deriveCashflow(cashflow, months);

  const periodLabel =
    months.length > 0
      ? `${formatJpMonth(months[0])} 〜 ${formatJpMonth(months[months.length - 1])}`
      : "";

  const monthBgClass = (m: MonthKey) =>
    isForecastMonth(m, currentMonth) ? "forecast-bg" : "actual-bg";

  return (
    <div className="shikin-print-sheet shikin-print-cashflow shikin-print-budget">
      <h2>
        {title}
        <span className="shikin-print-meta">
          （対象期間：{periodLabel} ／ 各月＝予定・実績・差異）
        </span>
      </h2>

      <table>
        <colgroup>
          <col className="label" />
          {months.map((m) => (
            <Fragment key={m}>
              <col />
              <col />
              <col />
            </Fragment>
          ))}
        </colgroup>
        <thead>
          <tr>
            <th className="label" rowSpan={2}>
              科目
            </th>
            {months.map((m) => (
              <th key={m} className={`num ${monthBgClass(m)}`} colSpan={3}>
                {formatShortJpMonth(m)}({isForecastMonth(m, currentMonth) ? "予" : "実"})
              </th>
            ))}
          </tr>
          <tr>
            {months.map((m) => (
              <Fragment key={m}>
                <th className={`num ${monthBgClass(m)}`}>予定</th>
                <th className={`num ${monthBgClass(m)}`}>実績</th>
                <th className={`num ${monthBgClass(m)}`}>差異</th>
              </Fragment>
            ))}
          </tr>
        </thead>

        <tbody>
          <tr className="total-bg">
            <td className="label">期首現預金残高</td>
            {months.map((m) => (
              <Triplet
                key={m}
                m={m}
                currentMonth={currentMonth}
                planValue={planD.opening[m] ?? 0}
                actualValue={actD.opening[m] ?? 0}
              />
            ))}
          </tr>

          {SECTION_ORDER.map((section) => {
            const subjects = SUBJECTS.filter((s) => s.section === section).sort(
              (a, b) => a.order - b.order
            );
            const incomeSubjects = subjects.filter((s) => s.kind === "income");
            const expenseSubjects = subjects.filter((s) => s.kind === "expense");

            const inc = {
              keijou: [planD.keijouIncome, actD.keijouIncome],
              keijouGai: [planD.keijouGaiIncome, actD.keijouGaiIncome],
              zaimu: [planD.zaimuIncome, actD.zaimuIncome],
            }[section];
            const exp = {
              keijou: [planD.keijouExpense, actD.keijouExpense],
              keijouGai: [planD.keijouGaiExpense, actD.keijouGaiExpense],
              zaimu: [planD.zaimuExpense, actD.zaimuExpense],
            }[section];
            const net = {
              keijou: [planD.keijouNet, actD.keijouNet],
              keijouGai: [planD.keijouGaiNet, actD.keijouGaiNet],
              zaimu: [planD.zaimuNet, actD.zaimuNet],
            }[section];

            return (
              <PrintSection
                key={section}
                section={section}
                incomeSubjects={incomeSubjects}
                expenseSubjects={expenseSubjects}
                months={months}
                currentMonth={currentMonth}
                budgetCells={budget.cells}
                actualCells={cashflow.cells}
                planIncome={inc[0]}
                actualIncome={inc[1]}
                planExpense={exp[0]}
                actualExpense={exp[1]}
                planNet={net[0]}
                actualNet={net[1]}
              />
            );
          })}

          <tr className="total-bg">
            <td className="label">月次収支計</td>
            {months.map((m) => (
              <Triplet
                key={m}
                m={m}
                currentMonth={currentMonth}
                planValue={planD.monthlyNet[m] ?? 0}
                actualValue={actD.monthlyNet[m] ?? 0}
              />
            ))}
          </tr>

          <tr className="total-bg">
            <td className="label">期末現預金残高</td>
            {months.map((m) => (
              <Triplet
                key={m}
                m={m}
                currentMonth={currentMonth}
                planValue={planD.closing[m] ?? 0}
                actualValue={actD.closing[m] ?? 0}
              />
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

interface PrintSectionProps {
  section: SubjectSection;
  incomeSubjects: { id: string; label: string }[];
  expenseSubjects: { id: string; label: string }[];
  months: MonthKey[];
  currentMonth: MonthKey;
  budgetCells: CashflowMatrix["cells"];
  actualCells: CashflowMatrix["cells"];
  planIncome: Record<MonthKey, number>;
  actualIncome: Record<MonthKey, number>;
  planExpense: Record<MonthKey, number>;
  actualExpense: Record<MonthKey, number>;
  planNet: Record<MonthKey, number>;
  actualNet: Record<MonthKey, number>;
}

function PrintSection({
  section,
  incomeSubjects,
  expenseSubjects,
  months,
  currentMonth,
  budgetCells,
  actualCells,
  planIncome,
  actualIncome,
  planExpense,
  actualExpense,
  planNet,
  actualNet,
}: PrintSectionProps) {
  return (
    <>
      <tr>
        <td className="label" colSpan={1 + months.length * 3}>
          {SECTION_LABELS[section]}
        </td>
      </tr>

      {incomeSubjects.map((s) => (
        <tr key={s.id}>
          <td className="label">　{s.label}</td>
          {months.map((m) => (
            <Triplet
              key={m}
              m={m}
              currentMonth={currentMonth}
              planValue={(budgetCells[s.id] ?? EMPTY_ROW)[m] ?? 0}
              actualValue={(actualCells[s.id] ?? EMPTY_ROW)[m] ?? 0}
            />
          ))}
        </tr>
      ))}
      <tr>
        <td className="label">　収入計</td>
        {months.map((m) => (
          <Triplet
            key={m}
            m={m}
            currentMonth={currentMonth}
            planValue={planIncome[m] ?? 0}
            actualValue={actualIncome[m] ?? 0}
          />
        ))}
      </tr>

      {expenseSubjects.map((s) => (
        <tr key={s.id}>
          <td className="label">　{s.label}</td>
          {months.map((m) => (
            <Triplet
              key={m}
              m={m}
              currentMonth={currentMonth}
              planValue={(budgetCells[s.id] ?? EMPTY_ROW)[m] ?? 0}
              actualValue={(actualCells[s.id] ?? EMPTY_ROW)[m] ?? 0}
            />
          ))}
        </tr>
      ))}
      <tr>
        <td className="label">　支出計</td>
        {months.map((m) => (
          <Triplet
            key={m}
            m={m}
            currentMonth={currentMonth}
            planValue={planExpense[m] ?? 0}
            actualValue={actualExpense[m] ?? 0}
          />
        ))}
      </tr>

      <tr>
        <td className="label">　{SECTION_LABELS[section]}</td>
        {months.map((m) => (
          <Triplet
            key={m}
            m={m}
            currentMonth={currentMonth}
            planValue={planNet[m] ?? 0}
            actualValue={actualNet[m] ?? 0}
          />
        ))}
      </tr>
    </>
  );
}
