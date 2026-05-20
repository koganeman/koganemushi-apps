import {
  BANK_FORMAT_SECTIONS,
  calcBankFormat,
  isForecastMonth,
} from "@/lib/shikin-guri-calc";
import { formatJpMonth, formatShortJpMonth } from "@/lib/shikin-guri-months";
import { formatYen } from "@/lib/format";
import type {
  BankFormatManualInput,
  CashflowMatrix,
  MonthKey,
} from "@/types/shikin-guri";

interface Props {
  months: MonthKey[];
  cashflow: CashflowMatrix;
  currentMonth: MonthKey;
  /** 発生主義の手入力値（売上高・仕入外注費）。showAccrual=false なら無視 */
  manualInput?: BankFormatManualInput;
  /** 発生主義行を印刷に含めるか */
  showAccrual?: boolean;
  title?: string;
}

export function PrintBankFormatSheet({
  months,
  cashflow,
  currentMonth,
  manualInput,
  showAccrual = false,
  title = "資金繰り表（金融機関提出用）",
}: Props) {
  const result = calcBankFormat(cashflow, months, manualInput);

  const periodLabel =
    months.length > 0
      ? `${formatJpMonth(months[0])} 〜 ${formatJpMonth(months[months.length - 1])}`
      : "";

  const monthBgClass = (m: MonthKey) =>
    isForecastMonth(m, currentMonth) ? "forecast-bg" : "actual-bg";

  const sumRow = (values: Record<MonthKey, number>) =>
    months.reduce((acc, m) => acc + (values[m] ?? 0), 0);

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
          <col />
        </colgroup>
        <thead>
          <tr>
            <th className="label">科目</th>
            {months.map((m) => (
              <th key={m} className={`num ${monthBgClass(m)}`}>
                {formatShortJpMonth(m)}({isForecastMonth(m, currentMonth) ? "予" : "実"})
              </th>
            ))}
            <th className="num">合計</th>
          </tr>
        </thead>

        <tbody>
          {/* 情報行（発生主義） — showAccrual=true のときのみ表示 */}
          {showAccrual && (
            <>
              <tr>
                <td className="label">売上高</td>
                {months.map((m) => (
                  <td key={m} className="num">
                    {formatYen(result.uriageDaka[m] ?? 0)}
                  </td>
                ))}
                <td className="num">{formatYen(sumRow(result.uriageDaka))}</td>
              </tr>
              <tr>
                <td className="label">仕入・外注費</td>
                {months.map((m) => (
                  <td key={m} className="num">
                    {formatYen(result.shiireGaichuu[m] ?? 0)}
                  </td>
                ))}
                <td className="num">{formatYen(sumRow(result.shiireGaichuu))}</td>
              </tr>
            </>
          )}

          {/* 前期繰越 */}
          <tr className="total-bg">
            <td className="label">前期繰越現金・当座預金</td>
            {months.map((m) => (
              <td key={m} className="num">
                {formatYen(result.opening[m] ?? 0)}
              </td>
            ))}
            <td className="num">—</td>
          </tr>

          {BANK_FORMAT_SECTIONS.map((sec) => {
            const r = result.sections[sec.id];
            return (
              <PrintBankSection
                key={sec.id}
                label={sec.label}
                incomeRows={sec.incomeRows}
                expenseRows={sec.expenseRows}
                rowValues={r.rowValues}
                incomeTotal={r.incomeTotal}
                expenseTotal={r.expenseTotal}
                net={r.net}
                months={months}
                sumRow={sumRow}
              />
            );
          })}

          {/* 総合収支 */}
          <tr className="total-bg">
            <td className="label">総合収支</td>
            {months.map((m) => (
              <td key={m} className="num">
                {formatYen(result.totalNet[m] ?? 0)}
              </td>
            ))}
            <td className="num">{formatYen(sumRow(result.totalNet))}</td>
          </tr>

          {/* 翌月繰越 */}
          <tr className="total-bg">
            <td className="label">翌月繰越現金・当座預金</td>
            {months.map((m) => (
              <td key={m} className="num">
                {formatYen(result.closing[m] ?? 0)}
              </td>
            ))}
            <td className="num">—</td>
          </tr>
        </tbody>
      </table>

      <p className="shikin-print-footer-note">※当社内部の資金繰り表（経常/経常外/財務）から自動集計</p>
    </div>
  );
}

interface PrintBankSectionProps {
  label: string;
  incomeRows: { id: string; label: string }[];
  expenseRows: { id: string; label: string }[];
  rowValues: Record<string, Record<MonthKey, number>>;
  incomeTotal: Record<MonthKey, number>;
  expenseTotal: Record<MonthKey, number>;
  net: Record<MonthKey, number>;
  months: MonthKey[];
  sumRow: (values: Record<MonthKey, number>) => number;
}

function PrintBankSection({
  label,
  incomeRows,
  expenseRows,
  rowValues,
  incomeTotal,
  expenseTotal,
  net,
  months,
  sumRow,
}: PrintBankSectionProps) {
  return (
    <>
      <tr>
        <td className="label" colSpan={2 + months.length}>
          {label}
        </td>
      </tr>
      {incomeRows.map((r) => (
        <tr key={r.id}>
          <td className="label">　{r.label}</td>
          {months.map((m) => (
            <td key={m} className="num">
              {formatYen(rowValues[r.id]?.[m] ?? 0)}
            </td>
          ))}
          <td className="num">{formatYen(sumRow(rowValues[r.id] ?? {}))}</td>
        </tr>
      ))}
      <tr>
        <td className="label">　収入合計</td>
        {months.map((m) => (
          <td key={m} className="num">
            {formatYen(incomeTotal[m] ?? 0)}
          </td>
        ))}
        <td className="num">{formatYen(sumRow(incomeTotal))}</td>
      </tr>
      {expenseRows.map((r) => (
        <tr key={r.id}>
          <td className="label">　{r.label}</td>
          {months.map((m) => (
            <td key={m} className="num">
              {formatYen(rowValues[r.id]?.[m] ?? 0)}
            </td>
          ))}
          <td className="num">{formatYen(sumRow(rowValues[r.id] ?? {}))}</td>
        </tr>
      ))}
      <tr>
        <td className="label">　支出合計</td>
        {months.map((m) => (
          <td key={m} className="num">
            {formatYen(expenseTotal[m] ?? 0)}
          </td>
        ))}
        <td className="num">{formatYen(sumRow(expenseTotal))}</td>
      </tr>
      <tr>
        <td className="label">　{label}</td>
        {months.map((m) => (
          <td key={m} className="num">
            {formatYen(net[m] ?? 0)}
          </td>
        ))}
        <td className="num">{formatYen(sumRow(net))}</td>
      </tr>
    </>
  );
}
