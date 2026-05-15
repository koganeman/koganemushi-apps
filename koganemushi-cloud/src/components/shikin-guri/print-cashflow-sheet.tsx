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

interface Props {
  months: MonthKey[];
  cashflow: CashflowMatrix;
  currentMonth: MonthKey;
  title?: string;
}

export function PrintCashflowSheet({
  months,
  cashflow,
  currentMonth,
  title = "資金繰り表",
}: Props) {
  const derived = deriveCashflow(cashflow, months);

  const periodLabel =
    months.length > 0
      ? `${formatJpMonth(months[0])} 〜 ${formatJpMonth(months[months.length - 1])}`
      : "";

  const monthBgClass = (m: MonthKey) =>
    isForecastMonth(m, currentMonth) ? "forecast-bg" : "actual-bg";

  return (
    <div className="shikin-print-sheet shikin-print-cashflow">
      <h2>
        {title}
        <span className="shikin-print-meta">（対象期間：{periodLabel}）</span>
      </h2>

      <table>
        <colgroup>
          <col className="label" />
          {months.map((m) => (
            <col key={m} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th className="label">科目</th>
            {months.map((m) => (
              <th key={m} className={`num ${monthBgClass(m)}`}>
                {formatShortJpMonth(m)}({isForecastMonth(m, currentMonth) ? "予" : "実"})
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          <tr className="total-bg">
            <td className="label">期首現預金残高</td>
            {months.map((m) => (
              <td key={m} className="num">
                {formatYen(derived.opening[m] ?? 0)}
              </td>
            ))}
          </tr>

          {SECTION_ORDER.map((section) => {
            const subjects = SUBJECTS.filter((s) => s.section === section).sort(
              (a, b) => a.order - b.order
            );
            const incomeSubjects = subjects.filter((s) => s.kind === "income");
            const expenseSubjects = subjects.filter((s) => s.kind === "expense");

            const incomeKey = {
              keijou: derived.keijouIncome,
              keijouGai: derived.keijouGaiIncome,
              zaimu: derived.zaimuIncome,
            }[section];
            const expenseKey = {
              keijou: derived.keijouExpense,
              keijouGai: derived.keijouGaiExpense,
              zaimu: derived.zaimuExpense,
            }[section];
            const netKey = {
              keijou: derived.keijouNet,
              keijouGai: derived.keijouGaiNet,
              zaimu: derived.zaimuNet,
            }[section];

            return (
              <PrintSection
                key={section}
                section={section}
                incomeSubjects={incomeSubjects}
                expenseSubjects={expenseSubjects}
                months={months}
                cashflow={cashflow}
                incomeKey={incomeKey}
                expenseKey={expenseKey}
                netKey={netKey}
              />
            );
          })}

          <tr className="total-bg">
            <td className="label">月次収支計</td>
            {months.map((m) => (
              <td key={m} className="num">
                {formatYen(derived.monthlyNet[m] ?? 0)}
              </td>
            ))}
          </tr>

          <tr className="total-bg">
            <td className="label">期末現預金残高</td>
            {months.map((m) => (
              <td key={m} className="num">
                {formatYen(derived.closing[m] ?? 0)}
              </td>
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
  cashflow: CashflowMatrix;
  incomeKey: Record<MonthKey, number>;
  expenseKey: Record<MonthKey, number>;
  netKey: Record<MonthKey, number>;
}

function PrintSection({
  section,
  incomeSubjects,
  expenseSubjects,
  months,
  cashflow,
  incomeKey,
  expenseKey,
  netKey,
}: PrintSectionProps) {
  return (
    <>
      <tr>
        <td className="label" colSpan={1 + months.length}>
          {SECTION_LABELS[section]}
        </td>
      </tr>

      {incomeSubjects.map((s) => (
        <tr key={s.id}>
          <td className="label">　{s.label}</td>
          {months.map((m) => (
            <td key={m} className="num">
              {formatYen(cashflow.cells[s.id]?.[m] ?? 0)}
            </td>
          ))}
        </tr>
      ))}
      <tr>
        <td className="label">　収入計</td>
        {months.map((m) => (
          <td key={m} className="num">
            {formatYen(incomeKey[m] ?? 0)}
          </td>
        ))}
      </tr>

      {expenseSubjects.map((s) => (
        <tr key={s.id}>
          <td className="label">　{s.label}</td>
          {months.map((m) => (
            <td key={m} className="num">
              {formatYen(cashflow.cells[s.id]?.[m] ?? 0)}
            </td>
          ))}
        </tr>
      ))}
      <tr>
        <td className="label">　支出計</td>
        {months.map((m) => (
          <td key={m} className="num">
            {formatYen(expenseKey[m] ?? 0)}
          </td>
        ))}
      </tr>

      <tr>
        <td className="label">　{SECTION_LABELS[section]}</td>
        {months.map((m) => (
          <td key={m} className="num">
            {formatYen(netKey[m] ?? 0)}
          </td>
        ))}
      </tr>
    </>
  );
}
