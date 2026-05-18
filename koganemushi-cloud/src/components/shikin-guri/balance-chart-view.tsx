"use client";

import dynamic from "next/dynamic";
import { useShikinGuriStore, PERIOD_LENGTH_MONTHS } from "@/stores/shikin-guri-store";
import { formatJpMonth, addMonths } from "@/lib/shikin-guri-months";

// recharts は重いため、グラフタブを開いたときだけ読み込む（初期バンドルから除外）
const BalanceChart = dynamic(
  () => import("./balance-chart").then((m) => m.BalanceChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-[520px] flex items-center justify-center text-sm text-gray-400">
        グラフを読み込み中…
      </div>
    ),
  }
);

export function BalanceChartView() {
  const period = useShikinGuriStore((s) => s.period);
  const cashflow = useShikinGuriStore((s) => s.cashflow);

  const periodLabel = `${formatJpMonth(period.startMonth)} 〜 ${formatJpMonth(addMonths(period.startMonth, PERIOD_LENGTH_MONTHS - 1))}`;

  return (
    <div className="px-4 py-4">
      <div className="mb-2 flex items-baseline gap-3">
        <h2 className="text-base font-semibold">現預金残高 推移グラフ</h2>
        <span className="text-xs text-gray-600">対象期間：{periodLabel}</span>
      </div>
      <div className="text-xs text-gray-500 mb-3">
        ＊ 青実線=資金繰り表の期末残高（実績）、青点線=同（予測）。
        赤い基準線(0円)を下回ると資金ショート。
      </div>
      <div className="border rounded bg-white p-2">
        <BalanceChart
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
