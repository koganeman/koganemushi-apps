"use client";

import { SUBJECT_BY_ID } from "@/lib/shikin-guri-subjects";
import { formatYen } from "@/lib/format";
import type { OffsetCandidate, OffsetKeys } from "@/types/general-ledger";

interface Props {
  candidates: OffsetCandidate[];
  offsetKeys: OffsetKeys;
  /** 消込確定/解除（confirmed=true で資金移動同様に集計除外） */
  onOffsetChange: (key: string, confirmed: boolean) => void;
}

function OffsetRow({
  c,
  onOffsetChange,
}: {
  c: OffsetCandidate;
  onOffsetChange: Props["onOffsetChange"];
}) {
  const label = SUBJECT_BY_ID[c.subjectId]?.label ?? c.subjectId;
  return (
    <tr className={`border-t ${c.confirmed ? "bg-green-50" : "bg-white"}`}>
      <td className="px-3 py-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={c.confirmed}
            onChange={(e) => onOffsetChange(c.key, e.target.checked)}
          />
          <span className="text-xs">
            {c.confirmed ? "消込済" : "消込する"}
          </span>
        </label>
      </td>
      <td className="px-3 py-2 whitespace-nowrap">{label}</td>
      <td className="px-3 py-2 text-right tabular-nums">
        {formatYen(c.amount)}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {c.pairCount}
        <span className="text-xs text-gray-500">
          {" "}
          (入{c.inflowCount}/出{c.outflowCount})
        </span>
      </td>
      <td className="px-3 py-2 text-right tabular-nums font-medium">
        {formatYen(c.offsetTotal)}
      </td>
      <td
        className="px-3 py-2 max-w-xs truncate text-gray-600"
        title={`入: ${c.inflowSamples.join(" / ")}　出: ${c.outflowSamples.join(" / ")}`}
      >
        入: {c.inflowSamples.join(" / ") || "—"} ／ 出:{" "}
        {c.outflowSamples.join(" / ") || "—"}
      </td>
    </tr>
  );
}

/**
 * 消込候補一覧。資金繰り科目＋同額の入金/出金ペアを検出。
 * チェックで消込確定すると、そのペアは資金移動と同様に集計から除外される（純額0）。
 */
export function LedgerOffsetPanel({
  candidates,
  offsetKeys,
  onOffsetChange,
}: Props) {
  if (candidates.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        消込候補（科目＋同額の入金/出金ペア）はありません。
      </p>
    );
  }
  const confirmedTotal = candidates
    .filter((c) => offsetKeys[c.key] === true)
    .reduce((s, c) => s + c.offsetTotal, 0);
  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500">
        同一の資金繰り科目で金額が一致する入金と出金のペアです（摘要は不問）。
        内容を確認のうえ「消込する」をチェックすると、そのペアは資金移動と同様に
        資金繰り表・差異から除外されます（純額0）。確認するまで集計には従来通り反映されます。
        {confirmedTotal > 0 && (
          <span className="ml-1 text-green-700 font-medium">
            消込確定 合計 {formatYen(confirmedTotal)} 円
          </span>
        )}
      </p>
      <div className="overflow-x-auto border rounded max-h-[60vh]">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left font-medium">消込</th>
              <th className="px-3 py-2 text-left font-medium">資金繰り科目</th>
              <th className="px-3 py-2 text-right font-medium">金額</th>
              <th className="px-3 py-2 text-right font-medium">ペア数</th>
              <th className="px-3 py-2 text-right font-medium">消込総額</th>
              <th className="px-3 py-2 text-left font-medium">摘要サンプル</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((c) => (
              <OffsetRow
                key={c.key}
                c={c}
                onOffsetChange={onOffsetChange}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
