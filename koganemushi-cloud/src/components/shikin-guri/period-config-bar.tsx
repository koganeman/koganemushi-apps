"use client";

import { useShikinGuriStore, PERIOD_LENGTH_MONTHS } from "@/stores/shikin-guri-store";
import { addMonths, currentMonthKey, formatJpMonth } from "@/lib/shikin-guri-months";

function toMonthInputValue(key: string): string {
  // "YYYY-MM" 形式そのまま。<input type="month"> も同じ形式
  return key;
}

export function PeriodConfigBar() {
  const period = useShikinGuriStore((s) => s.period);
  const setPeriod = useShikinGuriStore((s) => s.setPeriod);

  const endMonth = addMonths(period.startMonth, PERIOD_LENGTH_MONTHS - 1);

  return (
    <div className="bg-white border-b px-6 py-2 flex items-center gap-4 text-sm">
      <div className="flex items-center gap-2">
        <label className="text-gray-600">開始月:</label>
        <input
          type="month"
          value={toMonthInputValue(period.startMonth)}
          onChange={(e) => {
            if (e.target.value) { setPeriod({ startMonth: e.target.value }); }
          }}
          className="border rounded px-2 py-1 text-sm"
        />
        <span className="text-gray-500 text-xs">
          〜 {formatJpMonth(endMonth)}（{PERIOD_LENGTH_MONTHS}ヶ月）
        </span>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-gray-600">現在月（実績/予測の境界）:</label>
        <input
          type="month"
          value={toMonthInputValue(period.currentMonth)}
          onChange={(e) => {
            if (e.target.value) { setPeriod({ currentMonth: e.target.value }); }
          }}
          className="border rounded px-2 py-1 text-sm"
        />
        <button
          type="button"
          onClick={() => setPeriod({ currentMonth: currentMonthKey() })}
          className="text-xs border border-gray-400 rounded px-2 py-0.5 hover:bg-gray-100"
          title="今月に設定"
        >
          本日
        </button>
      </div>
      <span className="text-xs text-gray-500">
        実績 = 現在月以前 / 予測 = 現在月より後
      </span>
    </div>
  );
}
