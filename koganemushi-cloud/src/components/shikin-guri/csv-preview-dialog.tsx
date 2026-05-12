"use client";

import { useMemo, useState } from "react";
import { useShikinGuriStore, PERIOD_LENGTH_MONTHS } from "@/stores/shikin-guri-store";
import { enumerateMonths, formatJpMonth } from "@/lib/shikin-guri-months";
import {
  importCashflowCsv,
  importAccountsCsv,
} from "@/lib/shikin-guri-csv";

export type PreviewMode = "cashflow" | "accounts";

interface Props {
  csvText: string;
  mode: PreviewMode;
  onClose: () => void;
}

export function CsvPreviewDialog({ csvText, mode, onClose }: Props) {
  const period = useShikinGuriStore((s) => s.period);
  const importCashflow = useShikinGuriStore((s) => s.importCashflowCsv);
  const importAccounts = useShikinGuriStore((s) => s.importAccountsCsv);

  const [accountsMode, setAccountsMode] = useState<"replace" | "merge" | "append">(
    "replace"
  );

  const periodMonths = useMemo(
    () => new Set(enumerateMonths(period.startMonth, PERIOD_LENGTH_MONTHS)),
    [period.startMonth]
  );

  const parsed = useMemo(() => {
    if (mode === "cashflow") { return { kind: "cashflow" as const, result: importCashflowCsv(csvText) }; }
    return { kind: "accounts" as const, result: importAccountsCsv(csvText) };
  }, [csvText, mode]);

  const inPeriodMonths = parsed.result.months.filter((m) => periodMonths.has(m));
  const outOfPeriodMonths = parsed.result.months.filter((m) => !periodMonths.has(m));

  const handleApply = () => {
    if (parsed.kind === "cashflow") {
      // 期間内の月だけに絞ってインポート
      const filtered: typeof parsed.result.cellsBySubject = {};
      for (const [subjectId, row] of Object.entries(parsed.result.cellsBySubject)) {
        const inRow: Record<string, number> = {};
        for (const [m, v] of Object.entries(row)) {
          if (periodMonths.has(m)) { inRow[m] = v; }
        }
        if (Object.keys(inRow).length > 0) { filtered[subjectId] = inRow; }
      }
      importCashflow(
        { ...parsed.result, cellsBySubject: filtered },
        { applyOpeningBalance: parsed.result.openingBalanceCandidate !== null }
      );
    } else {
      const filteredAccounts = parsed.result.accounts.map((a) => {
        const inBal: Record<string, number> = {};
        for (const [m, v] of Object.entries(a.balances)) {
          if (periodMonths.has(m)) { inBal[m] = v; }
        }
        return { name: a.name, balances: inBal };
      });
      importAccounts({ ...parsed.result, accounts: filteredAccounts }, accountsMode);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
        <div className="px-6 py-3 border-b flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            {mode === "cashflow" ? "資金繰り表 CSV取込プレビュー" : "口座残高 CSV取込プレビュー"}
          </h3>
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
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 border rounded p-3">
              <div className="text-gray-600 text-xs">取り込み対象月数</div>
              <div className="text-xl font-semibold">
                {inPeriodMonths.length}
                <span className="text-sm font-normal text-gray-500"> / {parsed.result.months.length}</span>
              </div>
              {outOfPeriodMonths.length > 0 && (
                <div className="text-xs text-amber-700 mt-1">
                  期間外で無視: {outOfPeriodMonths.map(formatJpMonth).join(", ")}
                </div>
              )}
            </div>
            {parsed.kind === "cashflow" ? (
              <div className="bg-gray-50 border rounded p-3">
                <div className="text-gray-600 text-xs">マッチした科目数</div>
                <div className="text-xl font-semibold">
                  {Object.keys(parsed.result.cellsBySubject).length}
                </div>
                {parsed.result.unknownLabels.length > 0 && (
                  <div className="text-xs text-amber-700 mt-1">
                    未マッチ: {parsed.result.unknownLabels.slice(0, 5).join(", ")}
                    {parsed.result.unknownLabels.length > 5 && " ..."}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-gray-50 border rounded p-3">
                <div className="text-gray-600 text-xs">読み取った口座数</div>
                <div className="text-xl font-semibold">{parsed.result.accounts.length}</div>
              </div>
            )}
          </div>

          {parsed.kind === "cashflow" && parsed.result.openingBalanceCandidate !== null && (
            <div className="border border-blue-300 bg-blue-50 rounded p-3">
              <div className="text-blue-900">
                期首現預金残高（先頭月）に
                <span className="font-semibold mx-1">
                  {parsed.result.openingBalanceCandidate.toLocaleString("ja-JP")} 円
                </span>
                を反映します
              </div>
              <div className="text-xs text-blue-700 mt-1">
                CSVの「期首・期末現預金残高」行の値を使用
              </div>
            </div>
          )}

          {parsed.kind === "accounts" && (
            <div className="border rounded p-3">
              <div className="text-gray-700 mb-2">既存口座とのマージ方式:</div>
              <div className="space-y-1">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={accountsMode === "replace"}
                    onChange={() => setAccountsMode("replace")}
                  />
                  <span>全置換（既存口座を削除して新規作成）</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={accountsMode === "merge"}
                    onChange={() => setAccountsMode("merge")}
                  />
                  <span>名前一致でマージ（未一致は追加）</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={accountsMode === "append"}
                    onChange={() => setAccountsMode("append")}
                  />
                  <span>追加（全て新規口座として末尾に追加）</span>
                </label>
              </div>
            </div>
          )}

          {parsed.kind === "cashflow" && parsed.result.unknownLabels.length > 0 && (
            <details className="text-xs text-gray-600">
              <summary className="cursor-pointer">
                未マッチ行 ({parsed.result.unknownLabels.length}件)
              </summary>
              <ul className="list-disc pl-5 mt-1">
                {parsed.result.unknownLabels.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            </details>
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
