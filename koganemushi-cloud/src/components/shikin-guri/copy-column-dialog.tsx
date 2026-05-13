"use client";

import { useMemo, useState } from "react";
import { useShikinGuriStore, PERIOD_LENGTH_MONTHS } from "@/stores/shikin-guri-store";
import {
  enumerateMonths,
  formatJpMonth,
  monthBeforeOrEqual,
} from "@/lib/shikin-guri-months";
import { SECTION_LABELS, SUBJECTS } from "@/lib/shikin-guri-subjects";
import { formatYen } from "@/lib/format";
import type { MonthKey, SubjectSection } from "@/types/shikin-guri";

interface Props {
  onClose: () => void;
}

type Scope = "all" | "section" | "subjects";

export function CopyColumnDialog({ onClose }: Props) {
  const period = useShikinGuriStore((s) => s.period);
  const cashflow = useShikinGuriStore((s) => s.cashflow);
  const applyCopyColumn = useShikinGuriStore((s) => s.applyCopyColumn);

  const [scope, setScope] = useState<Scope>("all");
  const [selectedSections, setSelectedSections] = useState<SubjectSection[]>([
    "keijou",
    "keijouGai",
    "zaimu",
  ]);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [overwriteExisting, setOverwriteExisting] = useState(false);

  const allMonths = useMemo(
    () => enumerateMonths(period.startMonth, PERIOD_LENGTH_MONTHS),
    [period.startMonth]
  );
  const sourceCandidateMonths = useMemo(
    () => allMonths.filter((m) => monthBeforeOrEqual(m, period.currentMonth)),
    [allMonths, period.currentMonth]
  );

  const [sourceMonth, setSourceMonth] = useState<MonthKey>(period.currentMonth);

  const targetMonths = useMemo(
    () => allMonths.filter((m) => m > sourceMonth),
    [allMonths, sourceMonth]
  );

  const targetSubjectIds = useMemo(() => {
    if (scope === "all") { return SUBJECTS.map((s) => s.id); }
    if (scope === "section") {
      return SUBJECTS.filter((s) => selectedSections.includes(s.section)).map((s) => s.id);
    }
    return selectedSubjectIds;
  }, [scope, selectedSections, selectedSubjectIds]);

  const previewRows = useMemo(() => {
    return targetSubjectIds.slice(0, 5).map((id) => {
      const subject = SUBJECTS.find((s) => s.id === id)!;
      const value = cashflow.cells[id]?.[sourceMonth] ?? 0;
      return { id, label: subject.label, value };
    });
  }, [targetSubjectIds, cashflow, sourceMonth]);

  const handleApply = () => {
    if (targetMonths.length === 0 || targetSubjectIds.length === 0) {
      alert("対象月または対象科目がありません。");
      return;
    }
    applyCopyColumn({
      subjectIds: targetSubjectIds,
      sourceMonth,
      targetMonths,
      overwriteExisting,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="px-6 py-3 border-b flex items-center justify-between">
          <h3 className="text-lg font-semibold">列の値を予測月にコピー</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-4 overflow-y-auto flex-1 space-y-4 text-sm">
          <div>
            <div className="text-gray-700 mb-1">コピー元の月:</div>
            <select
              value={sourceMonth}
              onChange={(e) => setSourceMonth(e.target.value)}
              className="border rounded px-2 py-1"
            >
              {sourceCandidateMonths.map((m) => (
                <option key={m} value={m}>
                  {formatJpMonth(m)}
                </option>
              ))}
            </select>
            <span className="text-xs text-gray-500 ml-2">
              （実績月から選択。デフォルトは現在月）
            </span>
          </div>

          <div>
            <div className="text-gray-700 mb-1">対象科目:</div>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={scope === "all"}
                  onChange={() => setScope("all")}
                />
                <span>全科目（{SUBJECTS.length}科目）</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={scope === "section"}
                  onChange={() => setScope("section")}
                />
                <span>セクション選択:</span>
              </label>
              {scope === "section" && (
                <div className="pl-6 flex gap-3">
                  {(["keijou", "keijouGai", "zaimu"] as SubjectSection[]).map((sec) => (
                    <label key={sec} className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={selectedSections.includes(sec)}
                        onChange={(e) => {
                          if (e.target.checked) { setSelectedSections([...selectedSections, sec]); }
                          else { setSelectedSections(selectedSections.filter((s) => s !== sec)); }
                        }}
                      />
                      <span>{SECTION_LABELS[sec]}</span>
                    </label>
                  ))}
                </div>
              )}
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={scope === "subjects"}
                  onChange={() => setScope("subjects")}
                />
                <span>個別選択:</span>
              </label>
              {scope === "subjects" && (
                <div className="pl-6 max-h-40 overflow-y-auto border rounded p-2 grid grid-cols-2 gap-x-4">
                  {SUBJECTS.map((s) => (
                    <label key={s.id} className="flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={selectedSubjectIds.includes(s.id)}
                        onChange={(e) => {
                          if (e.target.checked) { setSelectedSubjectIds([...selectedSubjectIds, s.id]); }
                          else { setSelectedSubjectIds(selectedSubjectIds.filter((x) => x !== s.id)); }
                        }}
                      />
                      <span>{s.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="text-gray-700 mb-1">
              対象月: コピー元の翌月以降
              <span className="text-xs text-gray-500 ml-2">
                {targetMonths.length}ヶ月 (
                {targetMonths.length > 0
                  ? `${formatJpMonth(targetMonths[0])} 〜 ${formatJpMonth(
                      targetMonths[targetMonths.length - 1]
                    )}`
                  : "なし"}
                )
              </span>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={overwriteExisting}
                onChange={(e) => setOverwriteExisting(e.target.checked)}
              />
              <span>既存の値も上書きする（チェックしない場合は0または空欄のみ埋める）</span>
            </label>
          </div>

          {previewRows.length > 0 && (
            <div className="border rounded p-3 bg-gray-50">
              <div className="text-xs text-gray-600 mb-1">
                プレビュー（{formatJpMonth(sourceMonth)} の値・先頭5科目）
              </div>
              <table className="text-xs border-collapse w-full">
                <thead>
                  <tr className="bg-white">
                    <th className="border px-2 py-1 text-left">科目</th>
                    <th className="border px-2 py-1 text-right">コピー値</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((r) => (
                    <tr key={r.id} className="bg-white">
                      <td className="border px-2 py-0.5">{r.label}</td>
                      <td className="border px-2 py-0.5 text-right">{formatYen(r.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="border border-gray-400 text-gray-700 rounded px-4 py-1.5 text-sm hover:bg-gray-50"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="bg-blue-600 text-white rounded px-4 py-1.5 text-sm hover:bg-blue-700"
          >
            適用
          </button>
        </div>
      </div>
    </div>
  );
}
