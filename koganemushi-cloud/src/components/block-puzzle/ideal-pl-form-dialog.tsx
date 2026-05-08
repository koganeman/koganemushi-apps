"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  BlockPuzzleResult,
  IdealHorizon,
  IdealPLParams,
} from "@/types/block-puzzle";

interface Props {
  open: boolean;
  results: BlockPuzzleResult[];
  initialParams: IdealPLParams | null;
  onCancel: () => void;
  onSubmit: (params: IdealPLParams) => void;
}

interface SmartDefaults {
  salesTarget: number;
  grossMarginPct: number;
  laborDistPct: number;
  cashIncrease: number;
}

function average(values: number[]): number {
  if (values.length === 0) { return 0; }
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function computeSmartDefaults(
  results: BlockPuzzleResult[],
  horizonYears: IdealHorizon,
): SmartDefaults {
  const valid = results.filter((r) => r.sales > 0);
  // results は左ほど最新 (index 0 = 最新)
  const latest = valid[0] ?? null;
  const salesBase = latest?.sales ?? 0;
  const salesTarget = Math.round(salesBase * (1 + horizonYears * 0.05));
  const grossMarginPct = latest ? latest.grossProfitRate * 100 : 0;
  const laborDistPct =
    average(valid.filter((r) => r.grossProfit > 0).map((r) => r.laborDistributionRate)) * 100;
  const cashIncrease = Math.round(average(valid.map((r) => r.cashIncrease)));
  return { salesTarget, grossMarginPct, laborDistPct, cashIncrease };
}

function parseNum(v: string): number | null {
  const trimmed = v.trim();
  if (trimmed === "") { return null; }
  const n = Number(trimmed.replace(/,/g, ""));
  if (!isFinite(n)) { return null; }
  return n;
}

function nullableToString(v: number | null | undefined): string {
  if (v === null || v === undefined) { return ""; }
  return String(v);
}

export function IdealPLFormDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={(v) => { if (!v) { props.onCancel(); } }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>AI理想P/L 生成パラメータ</DialogTitle>
        </DialogHeader>
        {props.open && (
          <FormBody
            results={props.results}
            initialParams={props.initialParams}
            onCancel={props.onCancel}
            onSubmit={props.onSubmit}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface FormBodyProps {
  results: BlockPuzzleResult[];
  initialParams: IdealPLParams | null;
  onCancel: () => void;
  onSubmit: (params: IdealPLParams) => void;
}

interface FormState {
  horizon: IdealHorizon;
  salesTarget: string;
  grossMarginPct: string;
  laborDistPct: string;
  cashIncrease: string;
  focus: string;
}

function makeInitialFormState(params: IdealPLParams | null): FormState {
  if (!params) {
    return {
      horizon: 1,
      salesTarget: "",
      grossMarginPct: "",
      laborDistPct: "",
      cashIncrease: "",
      focus: "",
    };
  }
  return {
    horizon: params.horizonYears,
    salesTarget: nullableToString(params.salesTarget),
    grossMarginPct: nullableToString(params.targetGrossMarginPct),
    laborDistPct: nullableToString(params.targetLaborDistributionPct),
    cashIncrease: nullableToString(params.targetCashIncrease),
    focus: params.focus,
  };
}

function FormBody({ results, initialParams, onCancel, onSubmit }: FormBodyProps) {
  const [state, setState] = useState<FormState>(() => makeInitialFormState(initialParams));
  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setState((s) => ({ ...s, [key]: value }));
  };

  const defaults = useMemo(
    () => computeSmartDefaults(results, state.horizon),
    [results, state.horizon],
  );

  const handleConfirm = () => {
    onSubmit({
      horizonYears: state.horizon,
      salesTarget: parseNum(state.salesTarget),
      targetGrossMarginPct: parseNum(state.grossMarginPct),
      targetLaborDistributionPct: parseNum(state.laborDistPct),
      targetCashIncrease: parseNum(state.cashIncrease),
      focus: state.focus.trim(),
    });
  };

  return (
    <div className="space-y-4 text-sm">
      <p className="text-gray-600 text-xs">
        空欄の項目はAIが過去5期実績の傾向から自動で設定します。プレースホルダ（薄字）はあくまで目安です。
      </p>

      <div className="text-sm text-gray-700">
        <span className="font-medium">対象期間:</span> 1年後（翌期）の理想P/L
      </div>

      <FormField
        label="売上目標（円）"
        placeholder={defaults.salesTarget.toLocaleString("ja-JP")}
        value={state.salesTarget}
        onChange={(v) => update("salesTarget", v)}
        hint="過去最新期 × 1.05 を目安に表示中"
      />

      <FormField
        label="目標粗利益率（%）"
        placeholder={defaults.grossMarginPct.toFixed(1)}
        value={state.grossMarginPct}
        onChange={(v) => update("grossMarginPct", v)}
        hint="過去最新期の実績粗利率"
      />

      <FormField
        label="目標労働分配率（%）"
        placeholder={defaults.laborDistPct.toFixed(1)}
        value={state.laborDistPct}
        onChange={(v) => update("laborDistPct", v)}
        hint="過去5期の平均労働分配率"
      />

      <FormField
        label="目標増加キャッシュ（円）"
        placeholder={defaults.cashIncrease.toLocaleString("ja-JP")}
        value={state.cashIncrease}
        onChange={(v) => update("cashIncrease", v)}
        hint="過去5期の平均増加キャッシュ"
      />

      <div>
        <label className="block font-medium mb-1">重視ポイント（任意）</label>
        <textarea
          className="w-full min-h-[80px] rounded-lg border border-gray-300 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
          placeholder="例：人件費を増やして従業員待遇を改善したい / 借入返済を優先したい / 新規事業に投資したい"
          value={state.focus}
          onChange={(e) => update("focus", e.target.value)}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel}>
          キャンセル
        </Button>
        <Button onClick={handleConfirm}>送信して生成する</Button>
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}

function FormField({ label, placeholder, value, onChange, hint }: FieldProps) {
  return (
    <div>
      <label className="block font-medium mb-1">{label}</label>
      <Input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {hint && <div className="text-[11px] text-gray-500 mt-0.5">{hint}</div>}
    </div>
  );
}
