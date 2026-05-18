"use client";

import { useMemo, useRef, useState } from "react";
import {
  useShikinGuriStore,
  PERIOD_LENGTH_MONTHS,
  type LedgerWorkState,
} from "@/stores/shikin-guri-store";
import { enumerateMonths } from "@/lib/shikin-guri-months";
import { importAccountsCsv } from "@/lib/shikin-guri-csv";
import { decodeLedgerBytes } from "@/lib/general-ledger-decode";
import { parseGeneralLedger } from "@/lib/general-ledger-parse";
import {
  buildMappingTable,
  buildCpDescBreakdown,
  applyLearnedCp,
} from "@/lib/general-ledger-mapping";
import {
  aggregatePipeline,
  cpDescKey,
} from "@/lib/general-ledger-pipeline";
import { requestAiMapping } from "@/lib/general-ledger-ai-mapping";
import { checkBalances } from "@/lib/general-ledger-balance-check";
import { reconcile } from "@/lib/general-ledger-reconcile";
import type { AiMappingRequestItem } from "@/types/general-ledger";
import { LedgerAiConsentDialog } from "./ledger-ai-consent-dialog";
import { LedgerResultView } from "./ledger-result-view";
import { LedgerHeader } from "./ledger-import-header";
import {
  filterCellsToPeriod,
  errMessage,
  piecesOf,
  ledgerEmptyMessage,
} from "./ledger-import-helpers";


export function LedgerImportPanel() {
  const ledgerInputRef = useRef<HTMLInputElement>(null);

  const period = useShikinGuriStore((s) => s.period);
  const importCashflow = useShikinGuriStore((s) => s.importCashflowCsv);
  const importMeisai = useShikinGuriStore((s) => s.importMeisaiCsv);
  const setActiveTab = useShikinGuriStore((s) => s.setActiveTab);

  // 作業状態はストア保持（タブ切替で消えない）
  const work = useShikinGuriStore((s) => s.ledgerWork);
  const setLedgerWork = useShikinGuriStore((s) => s.setLedgerWork);
  const patchLedgerWork = useShikinGuriStore((s) => s.patchLedgerWork);
  const locked = useShikinGuriStore((s) => s.ledgerLocked);
  const setLedgerLocked = useShikinGuriStore((s) => s.setLedgerLocked);

  const learnedRules = useShikinGuriStore((s) => s.learnedRules);
  const learnCp = useShikinGuriStore((s) => s.learnCp);
  const learnCpDesc = useShikinGuriStore((s) => s.learnCpDesc);
  const unlearnCp = useShikinGuriStore((s) => s.unlearnCp);
  const unlearnCpDesc = useShikinGuriStore((s) => s.unlearnCpDesc);
  const clearLearnedRules = useShikinGuriStore((s) => s.clearLearnedRules);

  const {
    parsed,
    mapping,
    overrides,
    cpDescAssignments,
    offsetKeys,
    accountsCsv,
  } = useMemo(() => piecesOf(work), [work]);

  const [error, setError] = useState<string | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  const cpDescBreakdown = useMemo(
    () => (parsed ? buildCpDescBreakdown(parsed.txns) : new Map()),
    [parsed],
  );

  const result = useMemo(
    () =>
      parsed
        ? aggregatePipeline(parsed, mapping, {
            descriptionOverrides: overrides,
            cpDescAssignments,
            offsetKeys,
          })
        : null,
    [parsed, mapping, overrides, cpDescAssignments, offsetKeys],
  );

  const balanceRows = useMemo(
    () => (parsed && accountsCsv ? checkBalances(parsed, accountsCsv) : []),
    [parsed, accountsCsv],
  );

  const reconcileRows = useMemo(
    () => (parsed && result ? reconcile(result, parsed, accountsCsv) : []),
    [parsed, result, accountsCsv],
  );

  const unmappedEntries = mapping.filter((m) => m.source === "unmapped");

  const handleLedgerFile = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
    if (locked) {
      setError("ロック中です。ロック解除してから読み込んでください。");
      if (ledgerInputRef.current) {
        ledgerInputRef.current.value = "";
      }
      return;
    }
    setError(null);
    try {
      const p = parseGeneralLedger(decodeLedgerBytes(await file.arrayBuffer()));
      if (p.txns.length === 0) {
        setError(ledgerEmptyMessage(p));
        return;
      }
      const next: LedgerWorkState = {
        parsed: p,
        // 学習済みの相手勘定科目ルールを自動適用
        mapping: applyLearnedCp(
          buildMappingTable(p.txns),
          learnedRules.cp,
        ),
        overrides: {},
        // 学習済みの摘要単位ルールを初期割当として自動適用
        cpDescAssignments: { ...learnedRules.cpDesc },
        offsetKeys: {},
        accountsCsv: null,
      };
      setLedgerWork(next);
    } catch (err) {
      setError(errMessage("読み込みに失敗しました", err));
    } finally {
      if (ledgerInputRef.current) {
        ledgerInputRef.current.value = "";
      }
    }
  };

  const handleAccountsFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        patchLedgerWork({
          accountsCsv: importAccountsCsv(String(ev.target?.result ?? "")),
        });
      } catch (err) {
        setError(errMessage("口座残高一覧表の読み込みに失敗しました", err));
      }
    };
    reader.readAsText(file, "utf-8");
  };

  const handleMappingChange = (
    counterpartyAccount: string,
    subjectId: string | null,
  ) => {
    patchLedgerWork({
      mapping: mapping.map((m) =>
        m.counterpartyAccount === counterpartyAccount
          ? { ...m, subjectId, source: "manual" }
          : m,
      ),
    });
    // 相手勘定科目単位の変更を学習（次回取込で自動適用）
    learnCp(counterpartyAccount, subjectId);
  };

  const handleOverride = (
    overrideKey: string,
    value: string | null | undefined,
  ) => {
    const next = { ...overrides };
    if (value === undefined) {
      delete next[overrideKey];
    } else {
      next[overrideKey] = value;
    }
    patchLedgerWork({ overrides: next });
  };

  const handleCpDescChange = (
    counterpartyAccount: string,
    description: string,
    value: string | null | undefined,
  ) => {
    const key = cpDescKey(counterpartyAccount, description);
    const next = { ...cpDescAssignments };
    if (value === undefined) {
      delete next[key];
      unlearnCpDesc(key);
    } else {
      next[key] = value;
      learnCpDesc(key, value);
    }
    patchLedgerWork({ cpDescAssignments: next });
  };

  const handleOffsetChange = (key: string, confirmed: boolean) => {
    const next = { ...offsetKeys };
    if (confirmed) {
      next[key] = true;
    } else {
      delete next[key];
    }
    patchLedgerWork({ offsetKeys: next });
  };

  /** 未割当 cp を摘要単位に展開した AI 依頼項目 */
  const aiItems = useMemo<AiMappingRequestItem[]>(() => {
    const items: AiMappingRequestItem[] = [];
    for (const m of mapping) {
      if (m.source !== "unmapped") {
        continue;
      }
      const groups = cpDescBreakdown.get(m.counterpartyAccount) ?? [];
      for (const g of groups) {
        const key = cpDescKey(m.counterpartyAccount, g.description);
        if (Object.prototype.hasOwnProperty.call(cpDescAssignments, key)) {
          continue; // 既に割当済はスキップ
        }
        items.push({
          counterpartyAccount: m.counterpartyAccount,
          description: g.description,
          sampleDescriptions: [g.description],
        });
      }
    }
    return items;
  }, [mapping, cpDescBreakdown, cpDescAssignments]);

  const handleRunAi = async () => {
    setConsentOpen(false);
    setAiLoading(true);
    setError(null);
    try {
      const results = await requestAiMapping(aiItems);
      const current = useShikinGuriStore.getState().ledgerWork;
      if (!current) {
        return;
      }
      const next = { ...current.cpDescAssignments };
      for (const r of results) {
        if (r.description === undefined || r.subjectId === null) {
          continue;
        }
        const key = cpDescKey(r.counterpartyAccount, r.description);
        next[key] = r.subjectId;
        // AI推定結果も学習（次回取込で自動適用）
        learnCpDesc(key, r.subjectId);
      }
      patchLedgerWork({ cpDescAssignments: next });
    } catch (err) {
      setError(errMessage("AIマッピングに失敗しました", err));
    } finally {
      setAiLoading(false);
    }
  };

  const handleApplyToStore = () => {
    if (!result) {
      return;
    }
    const periodMonths = new Set(
      enumerateMonths(period.startMonth, PERIOD_LENGTH_MONTHS),
    );
    importCashflow(
      {
        ...result.cashflow,
        cellsBySubject: filterCellsToPeriod(
          result.cashflow.cellsBySubject,
          periodMonths,
        ),
      },
      { applyOpeningBalance: result.openingBalanceFirstMonth !== 0 },
    );
    importMeisai(result.meisai);
    setActiveTab("cashflow");
  };

  const handleClear = () => {
    if (locked) {
      return;
    }
    if (
      work &&
      !window.confirm("実績取込の作業内容をクリアします。よろしいですか？")
    ) {
      return;
    }
    setLedgerWork(null);
    setError(null);
  };

  const statsText = parsed
    ? `${parsed.formatName ?? "?"} / ${parsed.txns.length} 取引 / ${parsed.accountLedgers.length} 台帳 / スキップ ${parsed.skippedRows} 行`
    : null;

  return (
    <div className="p-6 space-y-5">
      <LedgerHeader
        locked={locked}
        hasWork={work !== null}
        statsText={statsText}
        inputRef={ledgerInputRef}
        onToggleLock={() => setLedgerLocked(!locked)}
        onClear={handleClear}
        onPickFile={() => ledgerInputRef.current?.click()}
        onFileChange={handleLedgerFile}
      />

      {error && (
        <div className="border border-red-300 bg-red-50 text-red-700 rounded p-3 text-sm">
          {error}
        </div>
      )}

      {result && (
        <LedgerResultView
          result={result}
          unmappedCount={unmappedEntries.length}
          aiCount={aiItems.length}
          aiLoading={aiLoading}
          accountsCsv={accountsCsv}
          balanceRows={balanceRows}
          reconcileRows={reconcileRows}
          overrides={overrides}
          cpDescBreakdown={cpDescBreakdown}
          cpDescAssignments={cpDescAssignments}
          offsetKeys={offsetKeys}
          learnedRules={learnedRules}
          onMappingChange={handleMappingChange}
          onOverride={handleOverride}
          onCpDescChange={handleCpDescChange}
          onOffsetChange={handleOffsetChange}
          onUnlearnCp={unlearnCp}
          onUnlearnCpDesc={unlearnCpDesc}
          onClearLearned={clearLearnedRules}
          onRequestAi={() => setConsentOpen(true)}
          onAccountsFile={handleAccountsFile}
          onApply={handleApplyToStore}
        />
      )}

      <LedgerAiConsentDialog
        open={consentOpen}
        count={aiItems.length}
        onCancel={() => setConsentOpen(false)}
        onConfirm={handleRunAi}
      />
    </div>
  );
}
