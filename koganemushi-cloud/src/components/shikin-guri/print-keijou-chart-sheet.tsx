import { formatJpMonth } from "@/lib/shikin-guri-months";
import { KeijouChart } from "./keijou-chart";
import type {
  CashflowMatrix,
  MonthKey,
} from "@/types/shikin-guri";

interface Props {
  months: MonthKey[];
  cashflow: CashflowMatrix;
  currentMonth: MonthKey;
  title?: string;
}

export function PrintKeijouChartSheet({
  months,
  cashflow,
  currentMonth,
  title = "経常収支 推移グラフ",
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
        <KeijouChart
          startMonth={months[0]}
          monthCount={months.length}
          currentMonth={currentMonth}
          cashflow={cashflow}
          responsive={false}
          width={1080}
          height={680}
        />
      </div>
      <div className="shikin-print-chart-legend-note">
        ＊ 紫実線=経常収支（実績）／紫点線=同（予測）／赤=0円基準線
      </div>
    </div>
  );
}
