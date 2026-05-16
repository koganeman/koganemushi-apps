"use client";

import { useState } from "react";
import { formatJpMonth } from "@/lib/shikin-guri-months";
import type { AccountCsvImportResult } from "@/lib/shikin-guri-csv";
import {
  cashflowResultToCsv,
  meisaiResultToCsv,
  intermediateToCsv,
  type LedgerPipelineResult,
} from "@/lib/general-ledger-pipeline";
import type {
  BalanceCheckRow,
  CpDescAssignments,
  CpDescGroup,
  DescriptionOverrides,
  LearnedRules,
  OffsetKeys,
  ReconcileRow,
} from "@/types/general-ledger";
import { LedgerBalanceCheckPanel } from "./ledger-balance-check-panel";
import { LedgerCashflowPreview } from "./ledger-cashflow-preview";
import { LedgerMeisaiPreview } from "./ledger-meisai-preview";
import { LedgerReconcilePanel } from "./ledger-reconcile-panel";
import { LedgerReverseFlowPanel } from "./ledger-reverse-flow-panel";
import { LedgerDiscrepancyPanel } from "./ledger-discrepancy-panel";
import { LedgerOffsetPanel } from "./ledger-offset-panel";
import { MappingSection } from "./ledger-mapping-section";

type Section = "mapping" | "cashflow" | "meisai" | "balance";

const SECTIONS: { id: Section; label: string }[] = [
  { id: "mapping", label: "科目マッピング" },
  { id: "cashflow", label: "資金繰り実績表" },
  { id: "meisai", label: "明細表" },
  { id: "balance", label: "残高チェック" },
];

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function monthRangeLabel(months: string[]): string {
  if (months.length === 0) {
    return "";
  }
  return `${formatJpMonth(months[0])} 〜 ${formatJpMonth(
    months[months.length - 1],
  )}`;
}

interface Props {
  result: LedgerPipelineResult;
  unmappedCount: number;
  /** AI推定対象（未割当cpを摘要展開した未割当摘要）の件数 */
  aiCount: number;
  aiLoading: boolean;
  accountsCsv: AccountCsvImportResult | null;
  balanceRows: BalanceCheckRow[];
  reconcileRows: ReconcileRow[];
  overrides: DescriptionOverrides;
  cpDescBreakdown: Map<string, CpDescGroup[]>;
  cpDescAssignments: CpDescAssignments;
  offsetKeys: OffsetKeys;
  learnedRules: LearnedRules;
  onMappingChange: (
    counterpartyAccount: string,
    subjectId: string | null,
  ) => void;
  onCpDescChange: (
    counterpartyAccount: string,
    description: string,
    value: string | null | undefined,
  ) => void;
  onOverride: (
    overrideKey: string,
    value: string | null | undefined,
  ) => void;
  onOffsetChange: (key: string, confirmed: boolean) => void;
  onUnlearnCp: (counterpartyAccount: string) => void;
  onUnlearnCpDesc: (key: string) => void;
  onClearLearned: () => void;
  onRequestAi: () => void;
  onAccountsFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onApply: () => void;
}

function SummaryCards({
  result,
  unmappedCount,
}: {
  result: LedgerPipelineResult;
  unmappedCount: number;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div className="bg-gray-50 border rounded p-3">
        <div className="text-gray-600 text-xs">対象月</div>
        <div className="text-xl font-semibold">{result.months.length}</div>
        <div className="text-xs text-gray-500 mt-1">
          {monthRangeLabel(result.months)}
        </div>
      </div>
      <div className="bg-gray-50 border rounded p-3">
        <div className="text-gray-600 text-xs">明細行数</div>
        <div className="text-xl font-semibold">
          {result.meisaiPreview.length}
        </div>
      </div>
      <div className="bg-gray-50 border rounded p-3">
        <div className="text-gray-600 text-xs">資金移動・除外</div>
        <div className="text-xl font-semibold">{result.excludedCount}</div>
      </div>
      <div
        className={`border rounded p-3 ${
          unmappedCount > 0 ? "bg-amber-50" : "bg-green-50"
        }`}
      >
        <div className="text-gray-600 text-xs">未割当</div>
        <div className="text-xl font-semibold">{unmappedCount}</div>
      </div>
    </div>
  );
}

function BalanceSection({
  result,
  accountsCsv,
  balanceRows,
  reconcileRows,
  cpDescAssignments,
  offsetKeys,
  onAccountsFile,
  onCpDescChange,
  onOffsetChange,
}: Pick<
  Props,
  | "result"
  | "accountsCsv"
  | "balanceRows"
  | "reconcileRows"
  | "cpDescAssignments"
  | "offsetKeys"
  | "onAccountsFile"
  | "onCpDescChange"
  | "onOffsetChange"
>) {
  const [showDiag, setShowDiag] = useState(false);
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold">
            ① 収支整合性チェック（期首＋収支累計＝期末）
          </h3>
          <button
            type="button"
            onClick={() => setShowDiag((v) => !v)}
            className="text-xs border border-indigo-500 text-indigo-700 rounded px-3 py-1 hover:bg-indigo-50"
          >
            {showDiag ? "差異の原因を閉じる" : "差異の原因を調べる"}
          </button>
        </div>
        <LedgerReconcilePanel
          rows={reconcileRows}
          hasUploaded={accountsCsv !== null}
        />
        {showDiag && (
          <div className="border rounded p-3 bg-indigo-50/30">
            <LedgerDiscrepancyPanel
              diagnosis={result.discrepancy}
              cpDescAssignments={cpDescAssignments}
              onCpDescChange={onCpDescChange}
            />
          </div>
        )}
      </div>
      <div className="space-y-2">
        <h3 className="text-sm font-bold">
          ② 逆方向フロー検出（科目種別と逆向きの取引）
        </h3>
        <LedgerReverseFlowPanel
          rows={result.reverseFlows}
          cpDescAssignments={cpDescAssignments}
          onCpDescChange={onCpDescChange}
        />
      </div>
      <div className="space-y-2">
        <h3 className="text-sm font-bold">
          ③ 消込（科目＋同額の入金/出金ペア）
        </h3>
        <LedgerOffsetPanel
          candidates={result.offsetCandidates}
          offsetKeys={offsetKeys}
          onOffsetChange={onOffsetChange}
        />
      </div>
      <div className="space-y-2">
        <h3 className="text-sm font-bold">
          ④ 元帳残高 vs 口座残高一覧表（任意）
        </h3>
        <label className="inline-block text-xs border border-gray-400 text-gray-700 rounded px-3 py-1 hover:bg-gray-50 cursor-pointer">
          口座残高一覧表CSVを選択
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={onAccountsFile}
            className="hidden"
          />
        </label>
        {accountsCsv && <LedgerBalanceCheckPanel rows={balanceRows} />}
      </div>
    </div>
  );
}

export function LedgerResultView(props: Props) {
  const {
    result,
    unmappedCount,
    accountsCsv,
    balanceRows,
    reconcileRows,
    overrides,
    onOverride,
    onApply,
  } = props;
  const [section, setSection] = useState<Section>("mapping");

  return (
    <>
      <SummaryCards result={result} unmappedCount={unmappedCount} />

      <div className="flex flex-wrap gap-1 border-b">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSection(s.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              section === s.id
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === "mapping" && (
        <MappingSection
          result={result}
          aiCount={props.aiCount}
          aiLoading={props.aiLoading}
          cpDescBreakdown={props.cpDescBreakdown}
          cpDescAssignments={props.cpDescAssignments}
          learnedRules={props.learnedRules}
          onMappingChange={props.onMappingChange}
          onCpDescChange={props.onCpDescChange}
          onRequestAi={props.onRequestAi}
          onUnlearnCp={props.onUnlearnCp}
          onUnlearnCpDesc={props.onUnlearnCpDesc}
          onClearLearned={props.onClearLearned}
        />
      )}
      {section === "cashflow" && (
        <LedgerCashflowPreview cashflow={result.cashflow} />
      )}
      {section === "meisai" && (
        <LedgerMeisaiPreview
          rows={result.meisaiPreview}
          months={result.months}
          overrides={overrides}
          onOverride={onOverride}
        />
      )}
      {section === "balance" && (
        <BalanceSection
          result={result}
          accountsCsv={accountsCsv}
          balanceRows={balanceRows}
          reconcileRows={reconcileRows}
          cpDescAssignments={props.cpDescAssignments}
          offsetKeys={props.offsetKeys}
          onAccountsFile={props.onAccountsFile}
          onCpDescChange={props.onCpDescChange}
          onOffsetChange={props.onOffsetChange}
        />
      )}

      <div className="flex flex-wrap items-center gap-2 border-t pt-4">
        <button
          type="button"
          onClick={() =>
            downloadCsv(
              "総勘定元帳_アップロード用.csv",
              intermediateToCsv(result.intermediateRows),
            )
          }
          className="text-sm border border-gray-400 text-gray-700 rounded px-3 py-1.5 hover:bg-gray-50"
        >
          アップロード用CSV
        </button>
        <button
          type="button"
          onClick={() =>
            downloadCsv(
              "資金繰り実績表.csv",
              cashflowResultToCsv(result.cashflow),
            )
          }
          className="text-sm border border-blue-500 text-blue-700 rounded px-3 py-1.5 hover:bg-blue-50"
        >
          資金繰り実績表CSV
        </button>
        <button
          type="button"
          onClick={() =>
            downloadCsv("明細表.csv", meisaiResultToCsv(result.meisai))
          }
          className="text-sm border border-blue-500 text-blue-700 rounded px-3 py-1.5 hover:bg-blue-50"
        >
          明細表CSV
        </button>
        <button
          type="button"
          onClick={onApply}
          className="ml-auto text-sm bg-blue-600 text-white rounded px-4 py-1.5 hover:bg-blue-700"
        >
          資金繰り表・明細表に直接反映
        </button>
      </div>
    </>
  );
}
