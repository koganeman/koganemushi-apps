"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { useShikinGuriStore, PERIOD_LENGTH_MONTHS } from "@/stores/shikin-guri-store";
import {
  enumerateMonths,
  formatJpMonth,
  addMonths,
} from "@/lib/shikin-guri-months";
import { calcBalanceChartReferenceLines } from "@/lib/shikin-guri-calc";
import { formatYen } from "@/lib/format";
import { SUBJECTS } from "@/lib/shikin-guri-subjects";

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
  const chartConfig = useShikinGuriStore((s) => s.chartConfig);
  const setChartConfig = useShikinGuriStore((s) => s.setChartConfig);

  const [showFixedCostPicker, setShowFixedCostPicker] = useState(false);

  const periodLabel = `${formatJpMonth(period.startMonth)} 〜 ${formatJpMonth(addMonths(period.startMonth, PERIOD_LENGTH_MONTHS - 1))}`;

  const months = useMemo(
    () => enumerateMonths(period.startMonth, PERIOD_LENGTH_MONTHS),
    [period.startMonth]
  );

  const refLines = useMemo(
    () =>
      calcBalanceChartReferenceLines(
        cashflow,
        months,
        period.currentMonth,
        chartConfig.fixedCostSubjectIds
      ),
    [cashflow, months, period.currentMonth, chartConfig.fixedCostSubjectIds]
  );

  return (
    <div className="px-4 py-4">
      <div className="mb-2 flex items-baseline gap-3">
        <h2 className="text-base font-semibold">現預金残高 推移グラフ</h2>
        <span className="text-xs text-gray-600">対象期間：{periodLabel}</span>
      </div>
      <div className="text-xs text-gray-700 mb-3 space-y-1">
        <div className="text-gray-500">
          ＊ 青実線=資金繰り表の期末残高（実績）、青点線=同（予測）。
          赤い基準線(0円)を下回ると資金ショート。
        </div>
        <div>
          <span className="inline-block w-3 h-3 rounded-sm bg-green-600 mr-1 align-middle"></span>
          <span className="font-medium">資金余裕残高</span>
          <span className="ml-1">¥{formatYen(Math.round(refLines.adequateCash))}</span>
          <span className="text-gray-500 ml-1">
            = 売上入金 過去{refLines.sampleMonthCount}ヶ月平均 ¥{formatYen(Math.round(refLines.salesMonthlyAvg))} × 2
            {refLines.usedForecastFallback && "（※予測値ベース）"}
          </span>
        </div>
        <div>
          <span className="inline-block w-3 h-3 rounded-sm bg-amber-500 mr-1 align-middle"></span>
          <span className="font-medium">危機対応可能残高</span>
          <span className="ml-1">¥{formatYen(Math.round(refLines.crisisResilientCash))}</span>
          <span className="text-gray-500 ml-1">
            = 固定費 月平均合計 ¥{formatYen(Math.round(refLines.fixedCostMonthlyAvg))} × 3
          </span>
          <button
            type="button"
            onClick={() => setShowFixedCostPicker((v) => !v)}
            className="ml-2 text-blue-600 hover:underline text-xs"
          >
            固定費科目を選択 ({chartConfig.fixedCostSubjectIds.length})
          </button>
        </div>
        {showFixedCostPicker && (
          <FixedCostSubjectPicker
            selected={chartConfig.fixedCostSubjectIds}
            onChange={(ids) => setChartConfig({ fixedCostSubjectIds: ids })}
          />
        )}
      </div>
      <div className="border rounded bg-white p-2">
        <BalanceChart
          startMonth={period.startMonth}
          monthCount={PERIOD_LENGTH_MONTHS}
          currentMonth={period.currentMonth}
          cashflow={cashflow}
          height={520}
          adequateCash={refLines.adequateCash}
          crisisResilientCash={refLines.crisisResilientCash}
        />
      </div>
    </div>
  );
}

function FixedCostSubjectPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const candidates = SUBJECTS.filter(
    (s) =>
      (s.section === "keijou" && s.kind === "expense") ||
      s.id === "shiharaiRisokuHoshou"
  );
  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((x) => x !== id));
    } else {
      onChange([...selected, id]);
    }
  };
  return (
    <div className="border rounded p-2 mt-1 bg-gray-50 grid grid-cols-2 md:grid-cols-3 gap-1">
      {candidates.map((s) => (
        <label key={s.id} className="flex items-center gap-1 text-xs">
          <input
            type="checkbox"
            checked={selected.includes(s.id)}
            onChange={() => toggle(s.id)}
          />
          {s.label}
        </label>
      ))}
    </div>
  );
}
