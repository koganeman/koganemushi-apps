"use client";

import type { AnalysisResult } from "@/types/financial-analysis";

interface Props {
  /** 直近最大3期（左ほど最新）。長さ1〜3を想定 */
  recent: AnalysisResult[];
}

const GRADE_COLOR: Record<"A" | "B" | "C" | "D", string> = {
  A: "bg-emerald-100 text-emerald-800 border-emerald-300",
  B: "bg-blue-100 text-blue-800 border-blue-300",
  C: "bg-yellow-100 text-yellow-800 border-yellow-300",
  D: "bg-red-100 text-red-800 border-red-300",
};

const GRADE_DESC: Record<"A" | "B" | "C" | "D", string> = {
  A: "優良 (24点以上)",
  B: "良好 (18〜23点)",
  C: "標準 (12〜17点)",
  D: "要改善 (12点未満)",
};

export function FAGradeSummary({ recent }: Props) {
  if (recent.length === 0) {
    return (
      <section className="bg-white border rounded-lg p-4 text-sm text-gray-500">
        データを入力すると総合グレードが表示されます。
      </section>
    );
  }

  // 表示順: 左=最新（既存タブと統一）。recent は既に左ほど最新で渡される。
  const latest = recent[0];
  const oldest = recent[recent.length - 1];
  const trend = computeTrend(oldest, latest);

  return (
    <section className="bg-white border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm font-semibold text-gray-700">
          総合評価の推移（直近{recent.length}期、左ほど最新）
        </div>
        {trend && <TrendBadge trend={trend} />}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {recent.map((r, i) => (
          <PeriodGradeCell
            key={i}
            result={r}
            isLatest={i === 0}
          />
        ))}
        {/* 3期分に満たない場合は右側に空セル */}
        {recent.length < 3 &&
          Array.from({ length: 3 - recent.length }).map((_, i) => (
            <EmptyCell key={`empty-${i}`} />
          ))}
      </div>

      {latest.grade && (
        <div className="text-xs text-gray-600">
          ※最新期の評価: {GRADE_DESC[latest.grade]}
        </div>
      )}
    </section>
  );
}

interface CellProps {
  result: AnalysisResult;
  isLatest: boolean;
}

function PeriodGradeCell({ result, isLatest }: CellProps) {
  const labelStyle = isLatest
    ? "text-blue-700 font-bold"
    : "text-gray-600";
  return (
    <div className={`border rounded p-3 ${isLatest ? "border-blue-400 bg-blue-50/30" : "border-gray-200"}`}>
      <div className={`text-xs ${labelStyle}`}>
        {isLatest && "★ 最新期 "}
        {result.periodLabel || "-"}
      </div>
      <div className="flex items-center gap-2 mt-1">
        {result.grade ? (
          <div
            className={`text-3xl font-bold border-2 rounded-md w-12 h-12 flex items-center justify-center shrink-0 ${GRADE_COLOR[result.grade]}`}
          >
            {result.grade}
          </div>
        ) : (
          <div className="text-3xl font-bold border-2 rounded-md w-12 h-12 flex items-center justify-center shrink-0 bg-gray-100 text-gray-400 border-gray-300">
            -
          </div>
        )}
        <div>
          <div className="text-base font-semibold tabular-nums">
            {result.totalScore !== null ? result.totalScore : "-"}
            <span className="text-xs text-gray-500"> / 30 点</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyCell() {
  return (
    <div className="border border-dashed border-gray-200 rounded p-3 text-xs text-gray-400 flex items-center justify-center">
      （データなし）
    </div>
  );
}

interface TrendInfo {
  direction: "improved" | "declined" | "flat";
  delta: number;
  fromLabel: string;
  toLabel: string;
}

function computeTrend(oldest: AnalysisResult, latest: AnalysisResult): TrendInfo | null {
  if (oldest.totalScore === null || latest.totalScore === null) { return null; }
  if (oldest.periodLabel === latest.periodLabel) { return null; }
  const delta = latest.totalScore - oldest.totalScore;
  let direction: "improved" | "declined" | "flat";
  if (delta >= 2) { direction = "improved"; }
  else if (delta <= -2) { direction = "declined"; }
  else { direction = "flat"; }
  return {
    direction,
    delta,
    fromLabel: oldest.periodLabel || "古い期",
    toLabel: latest.periodLabel || "最新期",
  };
}

function TrendBadge({ trend }: { trend: TrendInfo }) {
  const sign = trend.delta > 0 ? "+" : "";
  const styles = {
    improved: { bg: "bg-emerald-50 text-emerald-700 border-emerald-300", icon: "📈", label: "改善傾向" },
    declined: { bg: "bg-red-50 text-red-700 border-red-300", icon: "📉", label: "悪化傾向" },
    flat: { bg: "bg-gray-50 text-gray-700 border-gray-300", icon: "➡️", label: "横ばい" },
  }[trend.direction];

  return (
    <div className={`text-xs px-2 py-1 rounded border ${styles.bg} flex items-center gap-1`}>
      <span>{styles.icon}</span>
      <span className="font-semibold">{styles.label}</span>
      <span className="tabular-nums">
        ({trend.fromLabel} → {trend.toLabel}: {sign}{trend.delta} 点)
      </span>
    </div>
  );
}
