"use client";

import { useState } from "react";
import { SUBJECTS, SECTION_LABELS } from "@/lib/shikin-guri-subjects";
import { formatYen } from "@/lib/format";
import { cpDescKey } from "@/lib/general-ledger-pipeline";
import type {
  CpDescAssignments,
  CpDescGroup,
  MappingSource,
  SubjectMappingEntry,
} from "@/types/general-ledger";

const EXCLUDE_VALUE = "__EXCLUDE__";
const DEFAULT_VALUE = "__DEFAULT__";

const SOURCE_BADGE: Record<MappingSource, { label: string; cls: string }> = {
  rule: { label: "ルール", cls: "bg-gray-100 text-gray-700" },
  ai: { label: "AI", cls: "bg-purple-100 text-purple-700" },
  manual: { label: "手動", cls: "bg-blue-100 text-blue-700" },
  excluded: { label: "除外", cls: "bg-amber-100 text-amber-700" },
  unmapped: { label: "未割当", cls: "bg-red-100 text-red-700" },
  learned: { label: "学習", cls: "bg-teal-100 text-teal-700" },
};

interface Props {
  mapping: SubjectMappingEntry[];
  cpDescBreakdown: Map<string, CpDescGroup[]>;
  cpDescAssignments: CpDescAssignments;
  /** 相手勘定科目単位の変更（source は "manual" になる） */
  onChange: (counterpartyAccount: string, subjectId: string | null) => void;
  /** 摘要単位の分解割当。value: subjectId / null=除外 / undefined=既定に戻す */
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

function rowBgClass(needsAttention: boolean, resolved: boolean): string {
  if (needsAttention) {
    return "bg-amber-50";
  }
  return resolved ? "bg-green-50/40" : "bg-white";
}

function needsAttentionOf(m: SubjectMappingEntry): boolean {
  return (
    m.source === "unmapped" ||
    (m.source === "ai" && (m.confidence ?? 1) < 0.7)
  );
}

function SubjectSelect({
  value,
  needsAttention,
  withDefault,
  onChange,
}: {
  value: string;
  needsAttention: boolean;
  withDefault: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`border rounded px-2 py-1 text-sm ${
        needsAttention ? "border-amber-400" : "border-gray-300"
      }`}
    >
      {withDefault && (
        <option value={DEFAULT_VALUE}>（既定: マッピングに従う）</option>
      )}
      <option value={EXCLUDE_VALUE}>（除外 / 資金移動）</option>
      {SUBJECTS.map((s) => (
        <option key={s.id} value={s.id}>
          {SECTION_LABELS[s.section]}：{s.label}
        </option>
      ))}
    </select>
  );
}

function subRowValue(
  has: boolean,
  assigned: string | null | undefined,
): string {
  if (!has) {
    return DEFAULT_VALUE;
  }
  return assigned === null ? EXCLUDE_VALUE : assigned!;
}

function CpDescSubRow({
  cp,
  group,
  assignments,
  onCpDescChange,
}: {
  cp: string;
  group: CpDescGroup;
  assignments: CpDescAssignments;
  onCpDescChange: Props["onCpDescChange"];
}) {
  const key = cpDescKey(cp, group.description);
  const has = Object.prototype.hasOwnProperty.call(assignments, key);
  const value = subRowValue(has, assignments[key]);
  return (
    <tr className={`border-t ${has ? "bg-blue-50" : "bg-gray-50/50"}`}>
      <td className="px-3 py-1.5" />
      <td className="px-3 py-1.5 pl-8 text-gray-700 max-w-xs truncate" title={group.description}>
        ↳ {group.description || "（摘要なし）"}
      </td>
      <td className="px-3 py-1.5 text-right tabular-nums">{group.txnCount}</td>
      <td className="px-3 py-1.5 text-right tabular-nums">
        {formatYen(group.totalAmount)}
      </td>
      <td className="px-3 py-1.5 text-xs text-gray-400">
        {group.dominantDirection === "inflow" ? "入金" : "出金"}
      </td>
      <td className="px-3 py-1.5">
        <SubjectSelect
          value={value}
          needsAttention={!has}
          withDefault
          onChange={(v) =>
            onCpDescChange(cp, group.description, parseChoice(v))
          }
        />
      </td>
    </tr>
  );
}

function countAssigned(
  cp: string,
  groups: CpDescGroup[],
  assignments: CpDescAssignments,
): number {
  return groups.filter((g) =>
    Object.prototype.hasOwnProperty.call(
      assignments,
      cpDescKey(cp, g.description),
    ),
  ).length;
}

function BadgeCell({
  m,
  assignedCount,
  groupCount,
  resolved,
}: {
  m: SubjectMappingEntry;
  assignedCount: number;
  groupCount: number;
  resolved: boolean;
}) {
  const badge = resolved
    ? { label: "割当済", cls: "bg-green-100 text-green-700" }
    : SOURCE_BADGE[m.source];
  return (
    <td className="px-3 py-2 whitespace-nowrap">
      <span
        className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${badge.cls}`}
      >
        {badge.label}
      </span>
      {!resolved && m.source === "ai" && m.confidence !== undefined && (
        <span className="ml-1 text-xs text-gray-500">
          {Math.round(m.confidence * 100)}%
        </span>
      )}
      {assignedCount > 0 && (
        <span
          className={`ml-1 text-xs ${
            resolved ? "text-green-600" : "text-blue-600"
          }`}
        >
          {assignedCount}/{groupCount} 摘要
        </span>
      )}
    </td>
  );
}

function CpNameCell({
  m,
  hasGroups,
  expanded,
  resolved,
  onToggle,
}: {
  m: SubjectMappingEntry;
  hasGroups: boolean;
  expanded: boolean;
  resolved: boolean;
  onToggle: () => void;
}) {
  return (
    <td className="px-3 py-2 font-medium whitespace-nowrap">
      {hasGroups && (
        <button
          type="button"
          onClick={onToggle}
          className="mr-1 text-gray-500 hover:text-gray-800"
          title="摘要ごとに分解して割当"
        >
          {expanded ? "▼" : "▶"}
        </button>
      )}
      {m.counterpartyAccount}
      {resolved && (
        <span className="ml-2 text-xs text-green-600">
          摘要で分解済
        </span>
      )}
      {!resolved && m.source === "unmapped" && (
        <span className="ml-2 text-xs text-red-600">
          摘要ごとに割当が必要
        </span>
      )}
    </td>
  );
}

function MappingRow({
  m,
  cpDescBreakdown,
  cpDescAssignments,
  onChange,
  onCpDescChange,
}: {
  m: SubjectMappingEntry;
  cpDescBreakdown: Props["cpDescBreakdown"];
  cpDescAssignments: CpDescAssignments;
  onChange: Props["onChange"];
  onCpDescChange: Props["onCpDescChange"];
}) {
  const groups = cpDescBreakdown.get(m.counterpartyAccount) ?? [];
  const assignedCount = countAssigned(
    m.counterpartyAccount,
    groups,
    cpDescAssignments,
  );
  const resolved = groups.length > 0 && assignedCount === groups.length;
  const needsAttention = needsAttentionOf(m) && !resolved;
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr className={`border-t ${rowBgClass(needsAttention, resolved)}`}>
        <BadgeCell
          m={m}
          assignedCount={assignedCount}
          groupCount={groups.length}
          resolved={resolved}
        />
        <CpNameCell
          m={m}
          hasGroups={groups.length > 0}
          expanded={expanded}
          resolved={resolved}
          onToggle={() => setExpanded((v) => !v)}
        />
        <td className="px-3 py-2 text-right tabular-nums">{m.txnCount}</td>
        <td className="px-3 py-2 text-right tabular-nums">
          {formatYen(m.totalAmount)}
        </td>
        <td className="px-3 py-2 text-gray-600 max-w-xs truncate">
          {m.sampleDescriptions.join(" / ")}
        </td>
        <td className="px-3 py-2">
          <SubjectSelect
            value={m.subjectId ?? EXCLUDE_VALUE}
            needsAttention={needsAttention}
            withDefault={false}
            onChange={(v) =>
              onChange(
                m.counterpartyAccount,
                v === EXCLUDE_VALUE ? null : v,
              )
            }
          />
        </td>
      </tr>
      {expanded &&
        groups.map((g) => (
          <CpDescSubRow
            key={g.description}
            cp={m.counterpartyAccount}
            group={g}
            assignments={cpDescAssignments}
            onCpDescChange={onCpDescChange}
          />
        ))}
    </>
  );
}

export function LedgerMappingTable({
  mapping,
  cpDescBreakdown,
  cpDescAssignments,
  onChange,
  onCpDescChange,
}: Props) {
  return (
    <div className="overflow-x-auto border rounded">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-gray-600">
          <tr>
            <th className="px-3 py-2 text-left font-medium">由来</th>
            <th className="px-3 py-2 text-left font-medium">相手勘定科目 / 摘要</th>
            <th className="px-3 py-2 text-right font-medium">件数</th>
            <th className="px-3 py-2 text-right font-medium">金額合計</th>
            <th className="px-3 py-2 text-left font-medium">摘要サンプル</th>
            <th className="px-3 py-2 text-left font-medium">資金繰り科目</th>
          </tr>
        </thead>
        <tbody>
          {mapping.map((m) => (
            <MappingRow
              key={m.counterpartyAccount}
              m={m}
              cpDescBreakdown={cpDescBreakdown}
              cpDescAssignments={cpDescAssignments}
              onChange={onChange}
              onCpDescChange={onCpDescChange}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
