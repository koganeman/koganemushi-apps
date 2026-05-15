"use client";

import { useShikinGuriStore, PERIOD_LENGTH_MONTHS } from "@/stores/shikin-guri-store";
import { formatJpMonth, addMonths } from "@/lib/shikin-guri-months";
import { KeijouChart } from "./keijou-chart";

export function KeijouChartView() {
  const period = useShikinGuriStore((s) => s.period);
  const cashflow = useShikinGuriStore((s) => s.cashflow);

  const periodLabel = `${formatJpMonth(period.startMonth)} 〜 ${formatJpMonth(addMonths(period.startMonth, PERIOD_LENGTH_MONTHS - 1))}`;

  return (
    <div className="px-4 pb-6">
      <div className="mb-2 flex items-baseline gap-3">
        <h2 className="text-base font-semibold">経常収支 推移グラフ</h2>
        <span className="text-xs text-gray-600">対象期間：{periodLabel}</span>
      </div>
      <div className="text-xs text-gray-500 mb-3">
        ＊ 紫実線=経常収支（実績）、紫点線=同（予測）。経常収入−経常支出の月次収支。
        赤い基準線(0円)を下回るとその月の経常収支がマイナス。
      </div>
      <div className="border rounded bg-white p-2">
        <KeijouChart
          startMonth={period.startMonth}
          monthCount={PERIOD_LENGTH_MONTHS}
          currentMonth={period.currentMonth}
          cashflow={cashflow}
          height={520}
        />
      </div>
    </div>
  );
}
