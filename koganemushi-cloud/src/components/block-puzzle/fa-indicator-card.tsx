"use client";

import type { AnalysisResult, IndicatorKey } from "@/types/financial-analysis";
import { INDICATOR_META } from "@/lib/financial-analysis-calc";

interface Props {
  /** 直近3期分（左ほど最新） */
  results: AnalysisResult[];
}

export function FAIndicatorCards({ results }: Props) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-bold text-gray-700">6指標の評価（直近3期）</h3>
      <div className="space-y-2">
        {INDICATOR_META.map((meta) => (
          <IndicatorRow
            key={meta.key}
            label={meta.label}
            category={meta.category}
            formula={meta.formula}
            indicatorKey={meta.key}
            results={results}
            format={meta.format}
          />
        ))}
      </div>
    </section>
  );
}

interface RowProps {
  label: string;
  category: string;
  formula: string;
  indicatorKey: IndicatorKey;
  results: AnalysisResult[];
  format: (v: number) => string;
}

const CATEGORY_COLOR: Record<string, string> = {
  "売上持続性": "bg-blue-100 text-blue-800 border-blue-300",
  "収益性":     "bg-emerald-100 text-emerald-800 border-emerald-300",
  "生産性":     "bg-purple-100 text-purple-800 border-purple-300",
  "健全性":     "bg-amber-100 text-amber-800 border-amber-300",
  "効率性":     "bg-cyan-100 text-cyan-800 border-cyan-300",
  "安全性":     "bg-rose-100 text-rose-800 border-rose-300",
};

function pickLatestBench(results: AnalysisResult[], key: IndicatorKey) {
  const latest = results[0]?.[key];
  return {
    median: latest?.benchMedian ?? null,
    thresholds: latest?.benchThresholds ?? null,
  };
}

function IndicatorRow({ label, category, formula, indicatorKey, results, format }: RowProps) {
  const { median, thresholds } = pickLatestBench(results, indicatorKey);
  const catColor = CATEGORY_COLOR[category] ?? "bg-gray-100 text-gray-700 border-gray-300";

  return (
    <div className="bg-white border rounded p-3">
      <RowHeader label={label} category={category} catColor={catColor} median={median} format={format} />
      <div className="text-[11px] text-gray-600 mb-2">
        <span className="font-medium text-gray-700">算式: </span>
        {formula}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {results.map((r, i) => {
          const ind = r[indicatorKey];
          return (
            <PeriodCell
              key={i}
              periodLabel={r.periodLabel}
              value={ind.value}
              score={ind.score}
              format={format}
            />
          );
        })}
      </div>
      {thresholds && (
        <div className="text-[10px] text-gray-500 mt-1">
          閾値: {thresholds.map((t) => format(t)).join(" / ")}
        </div>
      )}
    </div>
  );
}

interface HeaderProps {
  label: string;
  category: string;
  catColor: string;
  median: number | null;
  format: (v: number) => string;
}

function RowHeader({ label, category, catColor, median, format }: HeaderProps) {
  return (
    <div className="flex items-start justify-between mb-2 gap-3 flex-wrap">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="font-semibold text-sm">{label}</div>
        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${catColor}`}>
          {category}
        </span>
      </div>
      {median !== null && (
        <div className="text-xs text-gray-500">
          業界中央値: <span className="font-medium">{format(median)}</span>
        </div>
      )}
    </div>
  );
}

interface PeriodCellProps {
  periodLabel: string;
  value: number | null;
  score: 1 | 2 | 3 | 4 | 5 | null;
  format: (v: number) => string;
}

function PeriodCell({ periodLabel, value, score, format }: PeriodCellProps) {
  return (
    <div className="border rounded p-2">
      <div className="text-[10px] text-gray-500">{periodLabel || "-"}</div>
      <div className="text-base font-bold tabular-nums">
        {value === null ? <span className="text-gray-400">-</span> : format(value)}
      </div>
      <ScoreBar score={score} />
    </div>
  );
}

function ScoreBar({ score }: { score: 1 | 2 | 3 | 4 | 5 | null }) {
  if (score === null) {
    return <div className="text-[10px] text-gray-400 mt-1">スコア: -</div>;
  }
  const colorByScore: Record<1 | 2 | 3 | 4 | 5, string> = {
    1: "bg-red-500",
    2: "bg-orange-400",
    3: "bg-yellow-400",
    4: "bg-emerald-400",
    5: "bg-emerald-600",
  };
  return (
    <div className="mt-1">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((s) => (
          <div
            key={s}
            className={`flex-1 h-2 rounded-sm ${s <= score ? colorByScore[score] : "bg-gray-200"}`}
          />
        ))}
      </div>
      <div className="text-[10px] text-gray-700 mt-0.5">スコア: {score}/5</div>
    </div>
  );
}
