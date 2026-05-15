import { formatJpMonth } from "@/lib/shikin-guri-months";
import { BalanceChart } from "./balance-chart";
import type {
  AccountRow,
  CashflowMatrix,
  MonthKey,
} from "@/types/shikin-guri";

interface Props {
  months: MonthKey[];
  cashflow: CashflowMatrix;
  accounts: AccountRow[];
  currentMonth: MonthKey;
  title?: string;
}

export function PrintBalanceChartSheet({
  months,
  cashflow,
  accounts,
  currentMonth,
  title = "現預金残高 推移グラフ",
}: Props) {
  const periodLabel =
    months.length > 0
      ? `${formatJpMonth(months[0])} 〜 ${formatJpMonth(months[months.length - 1])}`
      : "";

  return (
    <div className="shikin-print-sheet shikin-print-chart">
      <h2>
        {title}
        <span className="shikin-print-meta">（対象期間：{periodLabel}）</span>
      </h2>
      <div className="shikin-print-chart-area">
        <BalanceChart
          startMonth={months[0]}
          monthCount={months.length}
          currentMonth={currentMonth}
          cashflow={cashflow}
          accounts={accounts}
          responsive={false}
          width={1080}
          height={680}
        />
      </div>
      <div className="shikin-print-chart-legend-note">
        ＊ 青実線=期末現預金残高（実績）／青点線=同（予測）／緑線=口座残高合計（実績入力月のみ）／赤=0円基準線
      </div>
    </div>
  );
}
