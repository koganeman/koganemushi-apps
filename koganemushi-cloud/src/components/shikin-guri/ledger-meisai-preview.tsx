"use client";

import { SUBJECTS, SUBJECT_BY_ID, SECTION_LABELS } from "@/lib/shikin-guri-subjects";
import { formatJpMonth } from "@/lib/shikin-guri-months";
import { formatYen } from "@/lib/format";
import type {
  DescriptionOverrides,
  MeisaiPreviewRow,
} from "@/types/general-ledger";
import type { MonthKey } from "@/types/shikin-guri";

const DEFAULT_VALUE = "__DEFAULT__";
const EXCLUDE_VALUE = "__EXCLUDE__";

interface Props {
  rows: MeisaiPreviewRow[];
  months: MonthKey[];
  overrides: DescriptionOverrides;
  /** value: subjectId / null=除外 / undefined=マッピング既定に戻す */
  onOverride: (
    overrideKey: string,
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
  row: MeisaiPreviewRow,
  overrides: DescriptionOverrides,
): string {
  if (!Object.prototype.hasOwnProperty.call(overrides, row.overrideKey)) {
    return DEFAULT_VALUE;
  }
  const v = overrides[row.overrideKey];
  return v === null ? EXCLUDE_VALUE : v;
}

function MeisaiPreviewRowView({
  row,
  months,
  overrides,
  onOverride,
}: {
  row: MeisaiPreviewRow;
  months: MonthKey[];
  overrides: DescriptionOverrides;
  onOverride: Props["onOverride"];
}) {
  const overridden = Object.prototype.hasOwnProperty.call(
    overrides,
    row.overrideKey,
  );
  const baseLabel = SUBJECT_BY_ID[row.baseSubjectId]?.label ?? row.baseSubjectId;
  return (
    <tr className={`border-t ${overridden ? "bg-blue-50" : "bg-white"}`}>
      <td className="px-3 py-2 sticky left-0 bg-inherit z-10">
        <select
          value={selectValue(row, overrides)}
          onChange={(e) =>
            onOverride(row.overrideKey, parseChoice(e.target.value))
          }
          className="border border-gray-300 rounded px-2 py-1 text-sm"
        >
          <option value={DEFAULT_VALUE}>（既定: {baseLabel}）</option>
          <option value={EXCLUDE_VALUE}>（除外 / 資金移動）</option>
          {SUBJECTS.map((s) => (
            <option key={s.id} value={s.id}>
              {SECTION_LABELS[s.section]}：{s.label}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2 max-w-xs truncate" title={row.description}>
        {row.description}
      </td>
      {months.map((m) => (
        <td
          key={m}
          className="px-3 py-2 text-right tabular-nums whitespace-nowrap"
        >
          {formatYen(row.amounts[m] ?? 0) || "0"}
        </td>
      ))}
    </tr>
  );
}

/** 生成された明細表（科目×摘要×月）プレビュー＋明細行単位の科目上書き */
export function LedgerMeisaiPreview({
  rows,
  months,
  overrides,
  onOverride,
}: Props) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500">
        各明細行の科目を個別に上書きできます（マッピング既定より優先）。「除外」は資金移動等として集計対象外にします。
      </p>
      <div className="overflow-x-auto border rounded max-h-[60vh]">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 sticky top-0 z-20">
            <tr>
              <th className="px-3 py-2 text-left font-medium">科目</th>
              <th className="px-3 py-2 text-left font-medium">摘要</th>
              {months.map((m) => (
                <th
                  key={m}
                  className="px-3 py-2 text-right font-medium whitespace-nowrap"
                >
                  {formatJpMonth(m)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <MeisaiPreviewRowView
                key={row.overrideKey}
                row={row}
                months={months}
                overrides={overrides}
                onOverride={onOverride}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
