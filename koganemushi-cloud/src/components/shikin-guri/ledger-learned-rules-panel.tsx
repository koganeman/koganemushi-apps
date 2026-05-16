"use client";

import { SUBJECT_BY_ID } from "@/lib/shikin-guri-subjects";
import type { LearnedRules } from "@/types/general-ledger";

/** cpDescKey の区切り文字（U+0001） */
const CP_DESC_SEP = String.fromCharCode(1);

interface Props {
  learnedRules: LearnedRules;
  onUnlearnCp: (counterpartyAccount: string) => void;
  onUnlearnCpDesc: (key: string) => void;
  onClear: () => void;
}

function subjectLabel(subjectId: string | null): string {
  if (subjectId === null) {
    return "（除外 / 資金移動）";
  }
  return SUBJECT_BY_ID[subjectId]?.label ?? subjectId;
}

/** cpDescKey（相手勘定科目 + 区切り + 摘要）を分解 */
function splitCpDescKey(key: string): { cp: string; desc: string } {
  const i = key.indexOf(CP_DESC_SEP);
  if (i < 0) {
    return { cp: key, desc: "" };
  }
  return { cp: key.slice(0, i), desc: key.slice(i + 1) };
}

export function LedgerLearnedRulesPanel({
  learnedRules,
  onUnlearnCp,
  onUnlearnCpDesc,
  onClear,
}: Props) {
  const cpEntries = Object.entries(learnedRules.cp);
  const cpDescEntries = Object.entries(learnedRules.cpDesc);
  const total = cpEntries.length + cpDescEntries.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          手動・AIで修正した科目割当を学習しています（次回の元帳取込時に自動適用）。
          不要なルールは削除できます。学習件数: {total}
        </p>
        {total > 0 && (
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm("学習ルールを全て削除します。よろしいですか？")
              ) {
                onClear();
              }
            }}
            className="text-xs border border-red-400 text-red-700 rounded px-3 py-1 hover:bg-red-50"
          >
            全削除
          </button>
        )}
      </div>

      {total === 0 ? (
        <p className="text-sm text-gray-500">学習ルールはまだありません。</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <h4 className="text-xs font-bold text-gray-600 mb-1">
              摘要単位（相手勘定科目＋摘要） {cpDescEntries.length}件
            </h4>
            <div className="overflow-x-auto border rounded max-h-[40vh]">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 sticky top-0">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-medium">
                      相手勘定科目
                    </th>
                    <th className="px-2 py-1.5 text-left font-medium">摘要</th>
                    <th className="px-2 py-1.5 text-left font-medium">科目</th>
                    <th className="px-2 py-1.5" />
                  </tr>
                </thead>
                <tbody>
                  {cpDescEntries.map(([key, sid]) => {
                    const { cp, desc } = splitCpDescKey(key);
                    return (
                      <tr key={key} className="border-t bg-white">
                        <td className="px-2 py-1.5 whitespace-nowrap">{cp}</td>
                        <td
                          className="px-2 py-1.5 max-w-[12rem] truncate"
                          title={desc}
                        >
                          {desc || "（摘要なし）"}
                        </td>
                        <td className="px-2 py-1.5 whitespace-nowrap">
                          {subjectLabel(sid)}
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          <button
                            type="button"
                            onClick={() => onUnlearnCpDesc(key)}
                            className="text-gray-400 hover:text-red-600"
                            title="この学習を削除"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold text-gray-600 mb-1">
              相手勘定科目単位 {cpEntries.length}件
            </h4>
            <div className="overflow-x-auto border rounded max-h-[40vh]">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 sticky top-0">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-medium">
                      相手勘定科目
                    </th>
                    <th className="px-2 py-1.5 text-left font-medium">科目</th>
                    <th className="px-2 py-1.5" />
                  </tr>
                </thead>
                <tbody>
                  {cpEntries.map(([cp, sid]) => (
                    <tr key={cp} className="border-t bg-white">
                      <td className="px-2 py-1.5 whitespace-nowrap">{cp}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        {subjectLabel(sid)}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <button
                          type="button"
                          onClick={() => onUnlearnCp(cp)}
                          className="text-gray-400 hover:text-red-600"
                          title="この学習を削除"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
