"use client";

import { formatJpMonth } from "@/lib/shikin-guri-months";
import { formatYen } from "@/lib/format";
import type { BalanceCheckRow } from "@/types/general-ledger";

interface Props {
  rows: BalanceCheckRow[];
}

function rowClass(r: BalanceCheckRow): string {
  if (r.uploadedBalance === null) {
    return "bg-white text-gray-400";
  }
  return r.matched ? "bg-white" : "bg-red-50";
}

function diffText(r: BalanceCheckRow): string {
  if (r.diff === null) {
    return "—";
  }
  return r.diff === 0 ? "0" : formatYen(r.diff);
}

export function LedgerBalanceCheckPanel({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        突合対象がありません（口座残高一覧表の口座名と元帳の台帳名が一致しているか確認してください）。
      </p>
    );
  }
  const checked = rows.filter((r) => r.uploadedBalance !== null);
  const mismatches = checked.filter((r) => !r.matched);

  return (
    <div className="space-y-3">
      <div className="flex gap-3 text-sm">
        <div className="bg-gray-50 border rounded px-3 py-2">
          突合件数{" "}
          <span className="font-semibold">{checked.length}</span>
        </div>
        <div
          className={`border rounded px-3 py-2 ${
            mismatches.length > 0
              ? "bg-red-50 text-red-700"
              : "bg-green-50 text-green-700"
          }`}
        >
          不一致{" "}
          <span className="font-semibold">{mismatches.length}</span> 件
        </div>
      </div>
      <div className="overflow-x-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left font-medium">台帳（口座）</th>
              <th className="px-3 py-2 text-left font-medium">月</th>
              <th className="px-3 py-2 text-right font-medium">
                元帳算出残高
              </th>
              <th className="px-3 py-2 text-right font-medium">
                一覧表残高
              </th>
              <th className="px-3 py-2 text-right font-medium">差異</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={`${r.accountLedger}-${r.monthKey}-${i}`}
                className={`border-t ${rowClass(r)}`}
              >
                <td className="px-3 py-2 whitespace-nowrap">
                  {r.accountLedger}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {formatJpMonth(r.monthKey)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatYen(r.ledgerBalance)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {r.uploadedBalance === null
                    ? "—"
                    : formatYen(r.uploadedBalance)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-medium">
                  {diffText(r)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
