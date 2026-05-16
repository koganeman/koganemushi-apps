"use client";

import { formatJpMonth } from "@/lib/shikin-guri-months";
import { formatYen } from "@/lib/format";
import type { ReconcileRow } from "@/types/general-ledger";

interface Props {
  rows: ReconcileRow[];
  /** 口座残高一覧表がアップロード済みか */
  hasUploaded: boolean;
}

function diffCell(diff: number | null): string {
  if (diff === null) {
    return "—";
  }
  return diff === 0 ? "0" : formatYen(diff);
}

function diffClass(diff: number | null): string {
  if (diff === null) {
    return "text-gray-400";
  }
  return diff === 0 ? "text-green-700" : "text-red-700 font-semibold";
}

/** 期首+収支累計=期末 を元帳合計・一覧表合計と突合（収支もれ検出） */
export function LedgerReconcilePanel({ rows, hasUploaded }: Props) {
  if (rows.length === 0) {
    return <p className="text-sm text-gray-500">対象データがありません。</p>;
  }
  const ledgerMismatch = rows.filter((r) => r.diffLedger !== 0).length;
  const uploadedMismatch = rows.filter(
    (r) => r.diffUploaded !== null && r.diffUploaded !== 0,
  ).length;

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        「前月末＋当月収支＝算出期末」が元帳の月末残高合計（全口座）と一致しない場合、収支もれ・二重計上・除外誤りの可能性があります。
      </p>
      <div className="flex flex-wrap gap-3 text-sm">
        <div
          className={`border rounded px-3 py-2 ${
            ledgerMismatch > 0
              ? "bg-red-50 text-red-700"
              : "bg-green-50 text-green-700"
          }`}
        >
          元帳と不一致{" "}
          <span className="font-semibold">{ledgerMismatch}</span> ヶ月
        </div>
        {hasUploaded && (
          <div
            className={`border rounded px-3 py-2 ${
              uploadedMismatch > 0
                ? "bg-red-50 text-red-700"
                : "bg-green-50 text-green-700"
            }`}
          >
            一覧表と不一致{" "}
            <span className="font-semibold">{uploadedMismatch}</span> ヶ月
          </div>
        )}
      </div>
      <div className="overflow-x-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left font-medium">月</th>
              <th className="px-3 py-2 text-right font-medium">前月末</th>
              <th className="px-3 py-2 text-right font-medium">当月収支</th>
              <th className="px-3 py-2 text-right font-medium">算出期末</th>
              <th className="px-3 py-2 text-right font-medium">
                元帳期末合計
              </th>
              <th className="px-3 py-2 text-right font-medium">差異(元帳)</th>
              {hasUploaded && (
                <>
                  <th className="px-3 py-2 text-right font-medium">
                    一覧表期末合計
                  </th>
                  <th className="px-3 py-2 text-right font-medium">
                    差異(一覧表)
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.monthKey} className="border-t bg-white">
                <td className="px-3 py-2 whitespace-nowrap">
                  {formatJpMonth(r.monthKey)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatYen(r.openingOrPrev) || "0"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatYen(r.net) || "0"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatYen(r.derivedClosing) || "0"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatYen(r.ledgerClosingTotal) || "0"}
                </td>
                <td
                  className={`px-3 py-2 text-right tabular-nums ${diffClass(
                    r.diffLedger,
                  )}`}
                >
                  {diffCell(r.diffLedger)}
                </td>
                {hasUploaded && (
                  <>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.uploadedClosingTotal === null
                        ? "—"
                        : formatYen(r.uploadedClosingTotal) || "0"}
                    </td>
                    <td
                      className={`px-3 py-2 text-right tabular-nums ${diffClass(
                        r.diffUploaded,
                      )}`}
                    >
                      {diffCell(r.diffUploaded)}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
