"use client";

import { useMemo, useState } from "react";
import { useShikinGuriStore, PERIOD_LENGTH_MONTHS } from "@/stores/shikin-guri-store";
import { enumerateMonths, formatJpMonth, addMonths } from "@/lib/shikin-guri-months";
import type { MonthKey } from "@/types/shikin-guri";

interface Props {
  onCancel: () => void;
  onConfirm: (selectedStart: MonthKey) => void;
}

const CHUNK = 12;

export function PrintMonthPickerDialog({ onCancel, onConfirm }: Props) {
  const period = useShikinGuriStore((s) => s.period);

  // 12ヶ月分が期間内に収まる開始月の候補（i=0..24 の25個）
  const candidates = useMemo(
    () => enumerateMonths(period.startMonth, PERIOD_LENGTH_MONTHS - CHUNK + 1),
    [period.startMonth]
  );

  // デフォルトは現在月を含む位置（現在月から12ヶ月さかのぼった月、ただし候補内に収める）
  const defaultStart = useMemo(() => {
    const tryStart = addMonths(period.currentMonth, -(CHUNK - 1));
    if (candidates.includes(tryStart)) { return tryStart; }
    if (tryStart < candidates[0]) { return candidates[0]; }
    return candidates[candidates.length - 1];
  }, [candidates, period.currentMonth]);

  const [selected, setSelected] = useState<MonthKey>(defaultStart);

  const endMonth = addMonths(selected, CHUNK - 1);

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="px-6 py-3 border-b flex items-center justify-between">
          <h3 className="text-lg font-semibold">12ヶ月分を印刷</h3>
          <button
            type="button"
            onClick={onCancel}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-4 space-y-3 text-sm">
          <div>
            <div className="text-gray-700 mb-1">開始月：</div>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="border rounded px-2 py-1 w-full"
            >
              {candidates.map((m) => (
                <option key={m} value={m}>
                  {formatJpMonth(m)} 〜 {formatJpMonth(addMonths(m, CHUNK - 1))}
                </option>
              ))}
            </select>
          </div>
          <div className="text-xs text-gray-500">
            選択期間：{formatJpMonth(selected)} 〜 {formatJpMonth(endMonth)}（12ヶ月）
          </div>
        </div>

        <div className="px-6 py-3 border-t flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="border border-gray-400 text-gray-700 rounded px-4 py-1.5 text-sm hover:bg-gray-50"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={() => onConfirm(selected)}
            className="bg-blue-600 text-white rounded px-4 py-1.5 text-sm hover:bg-blue-700"
          >
            印刷
          </button>
        </div>
      </div>
    </div>
  );
}
