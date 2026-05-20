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
  closingActual: number | null;
  closingForecast: number | null;
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
  /** 資金余裕残高（緑の水平点線）。0/未指定なら描画しない */
  adequateCash?: number;
  /** 危機対応可能残高（アンバーの水平点線）。0/未指定なら描画しない */
  crisisResilientCash?: number;
}

export function BalanceChart({
  startMonth,
  monthCount,
  currentMonth,
  cashflow,
  responsive = true,
  width = 1080,
  height = 600,
  adequateCash,
  crisisResilientCash,
}: Props) {
  const data = useMemo<ChartPoint[]>(() => {
    const months = enumerateMonths(startMonth, monthCount);
    const derivedC = deriveCashflow(cashflow, months);

    return months.map((m) => {
      const isForecast = isForecastMonth(m, currentMonth);
      const closing = derivedC.closing[m] ?? 0;
      // 境界月(=currentMonth)は実績側に値、かつ予測側にも値を入れて線を繋ぐ
      const isBoundary = m === currentMonth;
      const closingActual = !isForecast ? closing : null;
      const closingForecast = isForecast || isBoundary ? closing : null;
      return {
        month: m,
        monthLabel: formatShortJpMonth(m),
        closingActual,
        closingForecast,
      };
    });
  }, [startMonth, monthCount, currentMonth, cashflow]);

  // Y軸上限: 残高データ・基準線2本のうち最大値に 10% パディング。
  // これがないと 基準線(緑/オレンジ)が auto domain の外に出て見えなくなる。
  const yDomainMax = useMemo(() => {
    let maxVal = 0;
    for (const d of data) {
      if (d.closingActual !== null && d.closingActual > maxVal) {
        maxVal = d.closingActual;
      }
      if (d.closingForecast !== null && d.closingForecast > maxVal) {
        maxVal = d.closingForecast;
      }
    }
    if (adequateCash != null && adequateCash > maxVal) {
      maxVal = adequateCash;
    }
    if (crisisResilientCash != null && crisisResilientCash > maxVal) {
      maxVal = crisisResilientCash;
    }
    return Math.ceil(Math.max(maxVal * 1.1, 1_000_000));
  }, [data, adequateCash, crisisResilientCash]);

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
        domain={[
          (dataMin: number) => (dataMin < 0 ? Math.floor(dataMin * 1.05) : 0),
          yDomainMax,
        ]}
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
      {crisisResilientCash != null && crisisResilientCash > 0 && (
        <ReferenceLine
          y={crisisResilientCash}
          stroke="#f59e0b"
          strokeDasharray="4 4"
          strokeWidth={1.5}
          label={{
            value: `危機対応 ¥${formatYen(Math.round(crisisResilientCash))}`,
            position: "insideTopRight",
            fontSize: 11,
            fill: "#b45309",
          }}
        />
      )}
      {adequateCash != null && adequateCash > 0 && (
        <ReferenceLine
          y={adequateCash}
          stroke="#16a34a"
          strokeDasharray="4 4"
          strokeWidth={1.5}
          label={{
            value: `余裕 ¥${formatYen(Math.round(adequateCash))}`,
            position: "insideTopRight",
            fontSize: 11,
            fill: "#15803d",
          }}
        />
      )}
      <Line
        type="monotone"
        dataKey="closingActual"
        name="期末残高（実績）"
        stroke="#1d4ed8"
        strokeWidth={2.5}
        dot={{ r: 2.5 }}
        connectNulls={false}
        isAnimationActive={false}
      />
      <Line
        type="monotone"
        dataKey="closingForecast"
        name="期末残高（予測）"
        stroke="#1d4ed8"
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
      <YAxis
        tickFormatter={formatYenAxis}
        tick={{ fontSize: 10 }}
        width={70}
        domain={[
          (dataMin: number) => (dataMin < 0 ? Math.floor(dataMin * 1.05) : 0),
          yDomainMax,
        ]}
      />
      <Legend wrapperStyle={{ fontSize: 11 }} />
      <ReferenceLine y={0} stroke="#dc2626" strokeWidth={1} />
      {crisisResilientCash != null && crisisResilientCash > 0 && (
        <ReferenceLine
          y={crisisResilientCash}
          stroke="#f59e0b"
          strokeDasharray="4 4"
          strokeWidth={1.5}
          label={{
            value: `危機対応 ¥${formatYen(Math.round(crisisResilientCash))}`,
            position: "insideTopRight",
            fontSize: 10,
            fill: "#b45309",
          }}
        />
      )}
      {adequateCash != null && adequateCash > 0 && (
        <ReferenceLine
          y={adequateCash}
          stroke="#16a34a"
          strokeDasharray="4 4"
          strokeWidth={1.5}
          label={{
            value: `余裕 ¥${formatYen(Math.round(adequateCash))}`,
            position: "insideTopRight",
            fontSize: 10,
            fill: "#15803d",
          }}
        />
      )}
      <Line
        type="monotone"
        dataKey="closingActual"
        name="期末残高（実績）"
        stroke="#1d4ed8"
        strokeWidth={2.5}
        dot={{ r: 2.5 }}
        connectNulls={false}
        isAnimationActive={false}
      />
      <Line
        type="monotone"
        dataKey="closingForecast"
        name="期末残高（予測）"
        stroke="#1d4ed8"
        strokeWidth={2.5}
        strokeDasharray="6 4"
        dot={{ r: 2.5 }}
        connectNulls={false}
        isAnimationActive={false}
      />
    </LineChart>
  );
}
