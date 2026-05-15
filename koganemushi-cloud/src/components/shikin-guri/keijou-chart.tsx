"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { deriveCashflow, isForecastMonth } from "@/lib/shikin-guri-calc";
import { enumerateMonths, formatJpMonth, formatShortJpMonth } from "@/lib/shikin-guri-months";
import { formatYen, formatYenAxis } from "@/lib/format";
import type {
  CashflowMatrix,
  MonthKey,
} from "@/types/shikin-guri";

interface ChartPoint {
  month: MonthKey;
  monthLabel: string;
  keijouActual: number | null;
  keijouForecast: number | null;
}

interface Props {
  startMonth: MonthKey;
  monthCount: number;
  currentMonth: MonthKey;
  cashflow: CashflowMatrix;
  /** 描画方式：レスポンシブか固定サイズか */
  responsive?: boolean;
  width?: number;
  height?: number;
}

export function KeijouChart({
  startMonth,
  monthCount,
  currentMonth,
  cashflow,
  responsive = true,
  width = 1080,
  height = 600,
}: Props) {
  const data = useMemo<ChartPoint[]>(() => {
    const months = enumerateMonths(startMonth, monthCount);
    const derivedC = deriveCashflow(cashflow, months);

    return months.map((m) => {
      const isForecast = isForecastMonth(m, currentMonth);
      const keijou = derivedC.keijouNet[m] ?? 0;
      // 境界月(=currentMonth)は実績側に値、かつ予測側にも値を入れて線を繋ぐ
      const isBoundary = m === currentMonth;
      const keijouActual = !isForecast ? keijou : null;
      const keijouForecast = isForecast || isBoundary ? keijou : null;
      return {
        month: m,
        monthLabel: formatShortJpMonth(m),
        keijouActual,
        keijouForecast,
      };
    });
  }, [startMonth, monthCount, currentMonth, cashflow]);

  const chart = (
    <LineChart data={data} margin={{ top: 16, right: 24, left: 8, bottom: 8 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
      <XAxis
        dataKey="monthLabel"
        tick={{ fontSize: 11 }}
        interval={1}
      />
      <YAxis
        tickFormatter={formatYenAxis}
        tick={{ fontSize: 11 }}
        width={70}
      />
      <Tooltip
        formatter={(value, name) => {
          const num = typeof value === "number" ? value : null;
          return [num === null ? "-" : `${formatYen(num)} 円`, String(name)];
        }}
        labelFormatter={(label, payload) => {
          const first = Array.isArray(payload) ? payload[0] : undefined;
          const p = first?.payload as ChartPoint | undefined;
          return p ? formatJpMonth(p.month) : String(label ?? "");
        }}
        contentStyle={{ fontSize: 12 }}
      />
      <Legend wrapperStyle={{ fontSize: 12 }} />
      <ReferenceLine y={0} stroke="#dc2626" strokeWidth={1} />
      <Line
        type="monotone"
        dataKey="keijouActual"
        name="経常収支（実績）"
        stroke="#7c3aed"
        strokeWidth={2.5}
        dot={{ r: 2.5 }}
        connectNulls={false}
        isAnimationActive={false}
      />
      <Line
        type="monotone"
        dataKey="keijouForecast"
        name="経常収支（予測）"
        stroke="#7c3aed"
        strokeWidth={2.5}
        strokeDasharray="6 4"
        dot={{ r: 2.5 }}
        connectNulls={false}
        isAnimationActive={false}
      />
    </LineChart>
  );

  if (responsive) {
    return (
      <ResponsiveContainer width="100%" height={height}>
        {chart}
      </ResponsiveContainer>
    );
  }
  return (
    <LineChart data={data} width={width} height={height} margin={{ top: 16, right: 24, left: 8, bottom: 8 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
      <XAxis dataKey="monthLabel" tick={{ fontSize: 10 }} interval={1} />
      <YAxis tickFormatter={formatYenAxis} tick={{ fontSize: 10 }} width={70} />
      <Legend wrapperStyle={{ fontSize: 11 }} />
      <ReferenceLine y={0} stroke="#dc2626" strokeWidth={1} />
      <Line
        type="monotone"
        dataKey="keijouActual"
        name="経常収支（実績）"
        stroke="#7c3aed"
        strokeWidth={2.5}
        dot={{ r: 2.5 }}
        connectNulls={false}
        isAnimationActive={false}
      />
      <Line
        type="monotone"
        dataKey="keijouForecast"
        name="経常収支（予測）"
        stroke="#7c3aed"
        strokeWidth={2.5}
        strokeDasharray="6 4"
        dot={{ r: 2.5 }}
        connectNulls={false}
        isAnimationActive={false}
      />
    </LineChart>
  );
}
