"use client";

import { useState } from "react";
import type { LedgerPipelineResult } from "@/lib/general-ledger-pipeline";
import type {
  CpDescAssignments,
  CpDescGroup,
  LearnedRules,
} from "@/types/general-ledger";
import { LedgerMappingTable } from "./ledger-mapping-table";
import { LedgerLearnedRulesPanel } from "./ledger-learned-rules-panel";

export interface MappingSectionProps {
  result: LedgerPipelineResult;
  aiCount: number;
  aiLoading: boolean;
  cpDescBreakdown: Map<string, CpDescGroup[]>;
  cpDescAssignments: CpDescAssignments;
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
  onRequestAi: () => void;
  onUnlearnCp: (counterpartyAccount: string) => void;
  onUnlearnCpDesc: (key: string) => void;
  onClearLearned: () => void;
}

export function MappingSection({
  result,
  aiCount,
  aiLoading,
  cpDescBreakdown,
  cpDescAssignments,
  learnedRules,
  onMappingChange,
  onCpDescChange,
  onRequestAi,
  onUnlearnCp,
  onUnlearnCpDesc,
  onClearLearned,
}: MappingSectionProps) {
  const [showLearned, setShowLearned] = useState(false);
  const learnedCount =
    Object.keys(learnedRules.cp).length +
    Object.keys(learnedRules.cpDesc).length;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold">
          相手勘定科目 → 資金繰り科目 マッピング
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowLearned((v) => !v)}
            className="text-xs border border-teal-500 text-teal-700 rounded px-3 py-1 hover:bg-teal-50"
          >
            {showLearned
              ? "学習ルールを閉じる"
              : `学習ルール管理（${learnedCount}）`}
          </button>
          <button
            type="button"
            disabled={aiCount === 0 || aiLoading}
            onClick={onRequestAi}
            className="text-xs border border-purple-500 text-purple-700 rounded px-3 py-1 hover:bg-purple-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {aiLoading
              ? "AI推定中…"
              : `AIで未割当を推定（摘要${aiCount}件）`}
          </button>
        </div>
      </div>
      {showLearned && (
        <div className="border rounded p-3 bg-teal-50/30">
          <LedgerLearnedRulesPanel
            learnedRules={learnedRules}
            onUnlearnCp={onUnlearnCp}
            onUnlearnCpDesc={onUnlearnCpDesc}
            onClear={onClearLearned}
          />
        </div>
      )}
      <LedgerMappingTable
        mapping={result.mapping}
        cpDescBreakdown={cpDescBreakdown}
        cpDescAssignments={cpDescAssignments}
        onChange={onMappingChange}
        onCpDescChange={onCpDescChange}
      />
    </div>
  );
}
