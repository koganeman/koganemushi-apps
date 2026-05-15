import { deriveAccounts, deriveCashflow, isForecastMonth } from "@/lib/shikin-guri-calc";
import { formatJpMonth, formatShortJpMonth } from "@/lib/shikin-guri-months";
import { formatYen } from "@/lib/format";
import type {
  AccountRow,
  CashflowMatrix,
  MonthKey,
} from "@/types/shikin-guri";

interface Props {
  months: MonthKey[];
  accounts: AccountRow[];
  cashflow: CashflowMatrix;
  currentMonth: MonthKey;
  title?: string;
}

export function PrintAccountsSheet({
  months,
  accounts,
  cashflow,
  currentMonth,
  title = "口座残高明細表",
}: Props) {
  const derivedAccounts = deriveAccounts(accounts, months);
  const derivedCashflow = deriveCashflow(cashflow, months);

  const periodLabel =
    months.length > 0
      ? `${formatJpMonth(months[0])} 〜 ${formatJpMonth(months[months.length - 1])}`
      : "";

  const monthBgClass = (m: MonthKey) =>
    isForecastMonth(m, currentMonth) ? "forecast-bg" : "actual-bg";

  return (
    <div className="shikin-print-sheet shikin-print-accounts">
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
            <th className="label">金融機関名</th>
            {months.map((m) => (
              <th key={m} className={`num ${monthBgClass(m)}`}>
                {formatShortJpMonth(m)}({isForecastMonth(m, currentMonth) ? "予" : "実"})
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {accounts.map((a) => (
            <tr key={a.id}>
              <td className="label">{a.name || "(無題)"}</td>
              {months.map((m) => (
                <td key={m} className="num">
                  {formatYen(a.balances[m] ?? 0)}
                </td>
              ))}
            </tr>
          ))}

          <tr className="total-bg">
            <td className="label">残高合計</td>
            {months.map((m) => (
              <td key={m} className="num">
                {formatYen(derivedAccounts.total[m] ?? 0)}
              </td>
            ))}
          </tr>

          <tr>
            <td className="label">前月増減</td>
            {months.map((m, i) => (
              <td key={m} className="num">
                {formatYen(i === 0 ? 0 : derivedAccounts.momDelta[m] ?? 0)}
              </td>
            ))}
          </tr>

          <tr>
            <td className="label">資金繰り表 期末残高</td>
            {months.map((m) => (
              <td key={m} className="num">
                {formatYen(derivedCashflow.closing[m] ?? 0)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
