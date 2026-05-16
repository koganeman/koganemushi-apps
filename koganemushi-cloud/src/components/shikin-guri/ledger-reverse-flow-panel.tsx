"use client";

import {
  SUBJECTS,
  SUBJECT_BY_ID,
  SECTION_LABELS,
} from "@/lib/shikin-guri-subjects";
import { formatYen } from "@/lib/format";
import { cpDescKey } from "@/lib/general-ledger-pipeline";
import type {
  CpDescAssignments,
  ReverseFlowRow,
} from "@/types/general-ledger";

const DEFAULT_VALUE = "__DEFAULT__";
const EXCLUDE_VALUE = "__EXCLUDE__";

interface Props {
  rows: ReverseFlowRow[];
  cpDescAssignments: CpDescAssignments;
  /**
   * 相手勘定科目＋摘要単位で上書き（最優先・相手勘定科目で分離されるため
   * 基底科目衝突が起きない）。value: subjectId / null=除外 / undefined=既定。
   */
  onCpDescChange: (
    counterpartyAccount: string,
    description: string,
    value: string | null | undefined,
  ) => void;
}

function parseChoice(v: string): string | null | undefined {
  if (v === DEFAULT_VALUE) {
    return undefined;
  }
  return v === EXCLUDE_VALUE ? null : v;
}

function selectValue(
  row: ReverseFlowRow,
  assignments: CpDescAssignments,
): string {
  const key = cpDescKey(row.counterpartyAccount, row.description);
  if (!Object.prototype.hasOwnProperty.call(assignments, key)) {
    return DEFAULT_VALUE;
  }
  const v = assignments[key];
  return v === null ? EXCLUDE_VALUE : v;
}

function ReverseFlowRowView({
  row,
  assignments,
  onCpDescChange,
}: {
  row: ReverseFlowRow;
  assignments: CpDescAssignments;
  onCpDescChange: Props["onCpDescChange"];
}) {
  const subjLabel = SUBJECT_BY_ID[row.subjectId]?.label ?? row.subjectId;
  const flowDir = row.kind === "income" ? "出金" : "入金";
  return (
    <tr className="border-t bg-white">
      <td className="px-3 py-2 whitespace-nowrap">
        {row.counterpartyAccount}
      </td>
      <td
        className="px-3 py-2 max-w-xs truncate"
        title={row.description}
      >
        {row.description || "（摘要なし）"}
      </td>
      <td className="px-3 py-2 whitespace-nowrap text-gray-600">
        {subjLabel}
        <span className="ml-1 text-xs text-red-600">
          ({row.kind === "income" ? "収入" : "支出"}科目に{flowDir})
        </span>
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{row.txnCount}</td>
      <td className="px-3 py-2 text-right tabular-nums text-red-700 font-medium">
        {formatYen(row.leakedAmount)}
      </td>
      <td className="px-3 py-2">
        <select
          value={selectValue(row, assignments)}
          onChange={(e) =>
            onCpDescChange(
              row.counterpartyAccount,
              row.description,
              parseChoice(e.target.value),
            )
          }
          className="border border-amber-400 rounded px-2 py-1 text-sm"
        >
          <option value={DEFAULT_VALUE}>（既定: マッピングに従う）</option>
          <option value={EXCLUDE_VALUE}>（除外 / 資金移動）</option>
          {SUBJECTS.map((s) => (
            <option key={s.id} value={s.id}>
              {SECTION_LABELS[s.section]}：{s.label}
            </option>
          ))}
        </select>
      </td>
    </tr>
  );
}

/**
 * 逆方向フロー検出。科目の収支区分と逆向きの取引（集計0計上で残高に漏れる）を
 * 一覧表示し、相手勘定科目＋摘要単位で正しい科目へ上書きできる。
 */
export function LedgerReverseFlowPanel({
  rows,
  cpDescAssignments,
  onCpDescChange,
}: Props) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-green-700">
        逆方向フローは検出されませんでした。
      </p>
    );
  }
  const total = rows.reduce((s, r) => s + r.leakedAmount, 0);
  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500">
        割り当てた科目の収支区分と実際の入出金が逆のため、集計で金額0計上となり
        残高チェックに漏れている明細です（合計{" "}
        <span className="text-red-700 font-medium">{formatYen(total)}</span>{" "}
        円）。相手勘定科目＋摘要単位で正しい科目へ上書きすると差異が縮小します。
      </p>
      <div className="overflow-x-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left font-medium">
                相手勘定科目
              </th>
              <th className="px-3 py-2 text-left font-medium">摘要</th>
              <th className="px-3 py-2 text-left font-medium">
                現在科目（不一致）
              </th>
              <th className="px-3 py-2 text-right font-medium">件数</th>
              <th className="px-3 py-2 text-right font-medium">漏れ金額</th>
              <th className="px-3 py-2 text-left font-medium">
                科目を上書き
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <ReverseFlowRowView
                key={`${row.counterpartyAccount}${row.description}`}
                row={row}
                assignments={cpDescAssignments}
                onCpDescChange={onCpDescChange}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
