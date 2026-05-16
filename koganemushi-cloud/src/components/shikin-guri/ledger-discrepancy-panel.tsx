"use client";

import {
  SUBJECTS,
  SECTION_LABELS,
} from "@/lib/shikin-guri-subjects";
import { formatYen } from "@/lib/format";
import { cpDescKey } from "@/lib/general-ledger-pipeline";
import type {
  CpDescAssignments,
  DiscrepancyCategory,
  DiscrepancyDiagnosis,
  DiscrepancyGroup,
} from "@/types/general-ledger";

const DEFAULT_VALUE = "__DEFAULT__";
const EXCLUDE_VALUE = "__EXCLUDE__";

const CATEGORY_META: Record<
  DiscrepancyCategory,
  { label: string; cls: string; hint: string }
> = {
  transfer: {
    label: "資金移動除外",
    cls: "bg-gray-100 text-gray-700",
    hint: "自社口座間でなければ実体科目へ。真の振替なら除外のまま。",
  },
  excluded: {
    label: "未割当除外",
    cls: "bg-red-100 text-red-700",
    hint: "マッピング/摘要分解で資金繰り科目を割り当てる。",
  },
  reverse: {
    label: "逆方向フロー",
    cls: "bg-amber-100 text-amber-700",
    hint: "実際の入出金に合う収支区分の科目へ上書きする。",
  },
};

function parseChoice(v: string): string | null | undefined {
  if (v === DEFAULT_VALUE) {
    return undefined;
  }
  return v === EXCLUDE_VALUE ? null : v;
}

function selectValue(
  row: DiscrepancyGroup,
  assignments: CpDescAssignments,
): string {
  const key = cpDescKey(row.counterpartyAccount, row.description);
  if (!Object.prototype.hasOwnProperty.call(assignments, key)) {
    return DEFAULT_VALUE;
  }
  const v = assignments[key];
  return v === null ? EXCLUDE_VALUE : v;
}

interface Props {
  diagnosis: DiscrepancyDiagnosis;
  cpDescAssignments: CpDescAssignments;
  onCpDescChange: (
    counterpartyAccount: string,
    description: string,
    value: string | null | undefined,
  ) => void;
}

function Card({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-gray-50 border rounded p-3">
      <div className="text-gray-600 text-xs">{label}</div>
      <div
        className={`text-lg font-semibold tabular-nums ${
          value === 0 ? "text-gray-700" : "text-red-700"
        }`}
      >
        {formatYen(value) || "0"}
      </div>
    </div>
  );
}

function GroupRow({
  g,
  assignments,
  onCpDescChange,
}: {
  g: DiscrepancyGroup;
  assignments: CpDescAssignments;
  onCpDescChange: Props["onCpDescChange"];
}) {
  const meta = CATEGORY_META[g.category];
  return (
    <tr className="border-t bg-white">
      <td className="px-3 py-2 whitespace-nowrap">
        <span
          className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${meta.cls}`}
        >
          {meta.label}
        </span>
      </td>
      <td className="px-3 py-2 whitespace-nowrap">
        {g.counterpartyAccount}
      </td>
      <td className="px-3 py-2 max-w-xs truncate" title={g.description}>
        {g.description || "（摘要なし）"}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{g.txnCount}</td>
      <td className="px-3 py-2 text-right tabular-nums text-red-700 font-medium">
        {formatYen(g.diffContribution)}
      </td>
      <td className="px-3 py-2">
        <select
          value={selectValue(g, assignments)}
          onChange={(e) =>
            onCpDescChange(
              g.counterpartyAccount,
              g.description,
              parseChoice(e.target.value),
            )
          }
          className="border border-gray-300 rounded px-2 py-1 text-sm"
          title={meta.hint}
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

/** 残高不一致の原因を自動分解して提示し、その場で上書き修正できる */
export function LedgerDiscrepancyPanel({
  diagnosis,
  cpDescAssignments,
  onCpDescChange,
}: Props) {
  const integrityOk = diagnosis.ledgerIntegrityDiff === 0;
  return (
    <div className="space-y-3">
      <div
        className={`rounded p-3 text-sm ${
          integrityOk
            ? "bg-green-50 text-green-800"
            : "bg-red-50 text-red-800"
        }`}
      >
        元帳整合チェック（期首＋Σ署名フロー − 台帳最終残高）:{" "}
        <span className="font-semibold">
          {integrityOk
            ? "健全（差0）"
            : `${formatYen(diagnosis.ledgerIntegrityDiff)} 円ズレ（元帳/取込データに不整合）`}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card label="最終差異(算出−元帳)" value={diagnosis.finalDiff} />
        <Card label="資金移動の寄与" value={diagnosis.transferContribution} />
        <Card label="未割当の寄与" value={diagnosis.excludedContribution} />
        <Card label="逆方向の寄与" value={diagnosis.reverseContribution} />
        <Card label="未説明の残差" value={diagnosis.residual} />
      </div>

      <p className="text-xs text-gray-500">
        各行の「差異寄与」は算出期末が元帳期末を上回らせている金額（符号付き）。
        相手勘定科目＋摘要単位で正しい科目へ上書きすると差異が縮小します。
        「資金移動除外」で相手が自社口座間の真の振替なら対応不要です。
      </p>

      {diagnosis.groups.length === 0 ? (
        <p className="text-sm text-green-700">
          差異の要因となる取引は検出されませんでした。
        </p>
      ) : (
        <div className="overflow-x-auto border rounded max-h-[60vh]">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left font-medium">分類</th>
                <th className="px-3 py-2 text-left font-medium">
                  相手勘定科目
                </th>
                <th className="px-3 py-2 text-left font-medium">摘要</th>
                <th className="px-3 py-2 text-right font-medium">件数</th>
                <th className="px-3 py-2 text-right font-medium">
                  差異寄与
                </th>
                <th className="px-3 py-2 text-left font-medium">
                  科目を上書き
                </th>
              </tr>
            </thead>
            <tbody>
              {diagnosis.groups.map((g) => (
                <GroupRow
                  key={`${g.category}${g.cpDescKey}`}
                  g={g}
                  assignments={cpDescAssignments}
                  onCpDescChange={onCpDescChange}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
