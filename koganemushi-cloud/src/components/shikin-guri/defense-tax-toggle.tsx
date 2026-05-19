"use client";

import { useShikinGuriStore } from "@/stores/shikin-guri-store";
import type { DefenseTaxMode } from "@/types/shikin-guri";

const OPTIONS: { value: DefenseTaxMode; label: string }[] = [
  { value: "auto", label: "自動（事業年度開始 2026/4 以降で適用）" },
  { value: "on", label: "常に適用（防衛特別法人税あり）" },
  { value: "off", label: "適用しない（現行）" },
];

/** 防衛特別法人税の auto/on/off 切替。各期の auto 解決結果を併記。 */
export function DefenseTaxToggle({
  periodApplied,
}: {
  periodApplied: boolean[];
}) {
  const mode = useShikinGuriStore((s) => s.taxForecast.defenseTaxMode);
  const setMode = useShikinGuriStore((s) => s.setDefenseTaxMode);

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span className="font-medium">防衛特別法人税</span>
      <select
        value={mode}
        onChange={(e) => setMode(e.target.value as DefenseTaxMode)}
        className="border border-gray-300 rounded px-2 py-1 text-sm"
        aria-label="防衛特別法人税モード"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <span className="text-xs text-gray-500">
        適用判定: {periodApplied.map((a, i) => `第${i + 1}期=${a ? "あり" : "なし"}`).join(" / ")}
      </span>
    </div>
  );
}
