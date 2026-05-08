"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type {
  BlockPuzzleResult,
  IdealPLParams,
  PLPeriodInput,
} from "@/types/block-puzzle";
import {
  hashPeriods,
  useBlockPuzzleStore,
} from "@/stores/block-puzzle-store";
import { useShallow } from "zustand/react/shallow";
import { AdviceConsentDialog } from "./advice-consent-dialog";
import { AdviceMarkdown } from "./advice-markdown";
import { IdealPLFormDialog } from "./ideal-pl-form-dialog";

interface Props {
  results: BlockPuzzleResult[];
}

interface ApiResponse {
  period: PLPeriodInput;
  reasoning: string;
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadInputTokens: number;
    cacheCreationInputTokens: number;
  };
  error?: string;
}

interface IdealPLEditableField {
  field: keyof PLPeriodInput;
  label: string;
}

const EDITABLE_FIELDS: IdealPLEditableField[] = [
  { field: "sales", label: "売上高" },
  { field: "costOfSales", label: "売上原価（変動費）" },
  { field: "personnelInVariableCost", label: "変動費に含まれる人件費" },
  { field: "executiveCompensation", label: "役員報酬" },
  { field: "executiveBonus", label: "役員賞与" },
  { field: "salaryAllowance", label: "給料手当" },
  { field: "miscellaneousSalary", label: "雑給" },
  { field: "bonus", label: "賞与" },
  { field: "retirementBenefits", label: "退職金" },
  { field: "legalWelfare", label: "法定福利費" },
  { field: "sellingAdminOther", label: "販売管理費計（人件費以外）" },
  { field: "depreciation", label: "減価償却費" },
  { field: "corporateTaxEtc", label: "法人税等" },
  { field: "loanRepayment", label: "借入金返済" },
];

interface PostArgs {
  results: BlockPuzzleResult[];
  params: IdealPLParams;
  existingAdviceText: string | null;
}

async function postIdealPL(args: PostArgs): Promise<ApiResponse> {
  const res = await fetch("/api/block-puzzle-ideal-pl", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const data = (await res.json()) as ApiResponse;
  if (!res.ok) {
    throw new Error(data.error ?? "理想P/L生成に失敗しました");
  }
  return data;
}

export function IdealPLPanel({ results }: Props) {
  const { ideal, setIdeal, updateIdealField, advice, periods } =
    useBlockPuzzleStore(
      useShallow((s) => ({
        ideal: s.ideal,
        setIdeal: s.setIdeal,
        updateIdealField: s.updateIdealField,
        advice: s.advice,
        periods: s.periods,
      })),
    );

  const [consentOpen, setConsentOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentHash = hashPeriods(periods);
  const isStale = ideal !== null && ideal.periodsHash !== currentHash;
  const hasAnyData = results.some((r) => r.sales > 0);

  const handleClick = () => {
    setError(null);
    setConsentOpen(true);
  };

  const handleConsentConfirm = () => {
    setConsentOpen(false);
    setFormOpen(true);
  };

  const handleSubmit = async (params: IdealPLParams) => {
    setFormOpen(false);
    setLoading(true);
    setError(null);
    try {
      const data = await postIdealPL({
        results,
        params,
        existingAdviceText: advice?.text ?? null,
      });
      setIdeal({
        period: data.period,
        reasoning: data.reasoning,
        params,
        generatedAt: new Date().toISOString(),
        periodsHash: currentHash,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知のエラー");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-purple-300 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-base font-bold">
          <span className="inline-block w-3 h-3 bg-purple-500 rounded-full mr-1" />
          ✨ AI理想 P/L
        </h2>
        <HeaderActions
          ideal={ideal}
          loading={loading}
          hasAnyData={hasAnyData}
          onGenerate={handleClick}
          onClear={() => setIdeal(null)}
        />
      </div>

      <p className="text-xs text-gray-500 bp-print-hide">
        ※ 過去5期の実績、ユーザー指定の経営目標、（生成済みなら）AI経営アドバイスを Claude に送信し、翌期（1年後）の理想P/L数値を構造化出力します。
      </p>

      <PanelBody
        hasAnyData={hasAnyData}
        loading={loading}
        error={error}
        isStale={isStale}
        ideal={ideal}
        onUpdateField={updateIdealField}
      />

      <AdviceConsentDialog
        open={consentOpen}
        onCancel={() => setConsentOpen(false)}
        onConfirm={handleConsentConfirm}
      />

      <IdealPLFormDialog
        open={formOpen}
        results={results}
        initialParams={ideal?.params ?? null}
        onCancel={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

interface HeaderActionsProps {
  ideal: ReturnType<typeof useBlockPuzzleStore.getState>["ideal"];
  loading: boolean;
  hasAnyData: boolean;
  onGenerate: () => void;
  onClear: () => void;
}

function HeaderActions({ ideal, loading, hasAnyData, onGenerate, onClear }: HeaderActionsProps) {
  return (
    <div className="flex items-center gap-2">
      {ideal && (
        <span className="text-xs text-gray-500">
          生成: {new Date(ideal.generatedAt).toLocaleString("ja-JP")}
        </span>
      )}
      {ideal && (
        <Button
          className="bp-print-hide"
          size="sm"
          variant="outline"
          onClick={onClear}
          title="生成された理想P/Lを削除します"
        >
          クリア
        </Button>
      )}
      <Button
        className="bp-print-hide"
        size="sm"
        variant="outline"
        onClick={onGenerate}
        disabled={loading || !hasAnyData}
      >
        {buttonLabel(loading, ideal !== null)}
      </Button>
    </div>
  );
}

interface PanelBodyProps {
  hasAnyData: boolean;
  loading: boolean;
  error: string | null;
  isStale: boolean;
  ideal: ReturnType<typeof useBlockPuzzleStore.getState>["ideal"];
  onUpdateField: (field: keyof PLPeriodInput, value: number | string) => void;
}

function PanelBody({
  hasAnyData,
  loading,
  error,
  isStale,
  ideal,
  onUpdateField,
}: PanelBodyProps) {
  if (!hasAnyData) {
    return (
      <div className="text-sm text-gray-500">
        P/Lデータを入力するとAIによる理想P/Lを生成できます。
      </div>
    );
  }
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-600 py-4">
        <Spinner />
        Claudeが理想P/Lを構築中です。30〜90秒ほどお待ちください…
      </div>
    );
  }
  return (
    <>
      {error && <ErrorBox message={error} />}
      {isStale && ideal && <StaleNotice />}
      {ideal && (
        <div className="space-y-4">
          <ParamsSummary params={ideal.params} />
          <EditableTable period={ideal.period} onUpdateField={onUpdateField} />
          {ideal.reasoning && <AdviceMarkdown text={ideal.reasoning} />}
        </div>
      )}
    </>
  );
}

function ParamsSummary({ params }: { params: IdealPLParams }) {
  const items: string[] = [`対象期間: ${params.horizonYears}年後`];
  if (params.salesTarget !== null) {
    items.push(`売上目標: ${params.salesTarget.toLocaleString("ja-JP")}円`);
  }
  if (params.targetGrossMarginPct !== null) {
    items.push(`目標粗利率: ${params.targetGrossMarginPct.toFixed(1)}%`);
  }
  if (params.targetLaborDistributionPct !== null) {
    items.push(`目標労働分配率: ${params.targetLaborDistributionPct.toFixed(1)}%`);
  }
  if (params.targetCashIncrease !== null) {
    items.push(`目標増加キャッシュ: ${params.targetCashIncrease.toLocaleString("ja-JP")}円`);
  }
  return (
    <div className="text-xs text-gray-700 bg-purple-50 border border-purple-200 rounded p-2">
      <span className="font-semibold mr-2">指定パラメータ:</span>
      {items.join(" / ")}
      {params.focus.trim() && (
        <div className="mt-1">
          <span className="font-semibold mr-1">重視:</span>
          {params.focus.trim()}
        </div>
      )}
    </div>
  );
}

function EditableTable({
  period,
  onUpdateField,
}: {
  period: PLPeriodInput;
  onUpdateField: (field: keyof PLPeriodInput, value: number | string) => void;
}) {
  return (
    <div className="bp-print-hide">
      <div className="text-xs font-semibold text-gray-700 mb-1">
        理想P/L 数値（クリックで編集できます）
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <RowEdit
          label="期ラベル"
          value={period.periodLabel}
          onChange={(v) => onUpdateField("periodLabel", v)}
          isText
        />
        {EDITABLE_FIELDS.map(({ field, label }) => (
          <RowEdit
            key={field}
            label={label}
            value={String(period[field] ?? 0)}
            onChange={(v) => {
              const n = Number(v.replace(/,/g, ""));
              onUpdateField(field, isFinite(n) ? n : 0);
            }}
          />
        ))}
      </div>
    </div>
  );
}

function RowEdit({
  label,
  value,
  onChange,
  isText,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  isText?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 py-0.5">
      <span className="w-44 shrink-0 text-gray-700">{label}</span>
      <input
        type={isText ? "text" : "text"}
        inputMode={isText ? "text" : "decimal"}
        className="flex-1 min-w-0 border border-gray-300 rounded px-1.5 py-0.5 text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-purple-300"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
      <div className="font-bold mb-1">エラー</div>
      <div>{message}</div>
    </div>
  );
}

function StaleNotice() {
  return (
    <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
      ※ 5期実績の入力値が変更されています。最新の数値で生成し直すには「再生成」をクリックしてください。
    </div>
  );
}

function buttonLabel(loading: boolean, hasIdeal: boolean): string {
  if (loading) { return "生成中..."; }
  if (hasIdeal) { return "再生成"; }
  return "理想P/L生成";
}

function Spinner() {
  return (
    <span className="inline-block w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
  );
}
