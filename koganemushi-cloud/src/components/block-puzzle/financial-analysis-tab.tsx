"use client";

import { useMemo } from "react";
import type { BlockPuzzleResult } from "@/types/block-puzzle";
import type { BalanceSheetResult } from "@/types/balance-sheet";
import { useFinancialAnalysisStore } from "@/stores/financial-analysis-store";
import { useShallow } from "zustand/react/shallow";
import { computeAllIndicators } from "@/lib/financial-analysis-calc";
import { FAProfileForm } from "./fa-profile-form";
import { FABSDetailTable } from "./fa-bs-detail-table";
import { FAIndicatorCards } from "./fa-indicator-card";
import { FAGradeSummary } from "./fa-grade-summary";
import { FAFormulaTable } from "./fa-formula-table";

interface Props {
  plResults: BlockPuzzleResult[];
  bsResults: BalanceSheetResult[];
}

export function FinancialAnalysisTab({ plResults, bsResults }: Props) {
  const { profile, bsDetails, updateProfileField, setEmployeeCount, updateBSDetailField } =
    useFinancialAnalysisStore(
      useShallow((s) => ({
        profile: s.profile,
        bsDetails: s.bsDetails,
        updateProfileField: s.updateProfileField,
        setEmployeeCount: s.setEmployeeCount,
        updateBSDetailField: s.updateBSDetailField,
      })),
    );

  const periodLabels = plResults.map((r) => r.periodLabel);

  const allResults = useMemo(
    () => computeAllIndicators({ plResults, bsResults, bsDetails, profile }),
    [plResults, bsResults, bsDetails, profile],
  );

  // 直近3期分（左ほど最新）
  const recent3 = allResults.slice(0, 3);

  return (
    <div className="space-y-4">
      <div className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded p-2">
        <div className="font-semibold text-gray-700 mb-0.5">
          経済産業省「ローカルベンチマーク」に準拠
        </div>
        本ツールは経済産業省が公表する「ローカルベンチマーク（ロカベン）」の財務分析6指標に準拠しています。
        業種・資本金・従業員数・B/S詳細を入力すると、業種別・規模別ベンチマークと比較した5段階スコアと総合グレード(A/B/C/D)が表示されます。
      </div>

      <FAProfileForm
        profile={profile}
        periodLabels={periodLabels}
        onUpdateField={updateProfileField}
        onUpdateEmployees={setEmployeeCount}
      />

      <FABSDetailTable
        details={bsDetails}
        periodLabels={periodLabels}
        onUpdate={updateBSDetailField}
      />

      <FAGradeSummary recent={recent3} />

      <FAIndicatorCards results={recent3} />

      <FAFormulaTable />
    </div>
  );
}
