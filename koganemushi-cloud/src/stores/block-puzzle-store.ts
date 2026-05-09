import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  BlockPuzzleUnit,
  IdealPLParams,
  PLPeriodInput,
} from "@/types/block-puzzle";
import { createEmptyPLPeriod } from "@/lib/block-puzzle-calc";

const DEFAULT_PERIODS = 5;

function makeInitialPeriods(): PLPeriodInput[] {
  // 左が最新期、右が古い期
  return Array.from({ length: DEFAULT_PERIODS }, (_, i) =>
    createEmptyPLPeriod(`第${DEFAULT_PERIODS - i}期`)
  );
}

export interface BlockPuzzleAdvice {
  text: string;
  generatedAt: string;
  periodsHash: string;
}

export interface BlockPuzzleIdeal {
  period: PLPeriodInput;
  reasoning: string;
  params: IdealPLParams;
  generatedAt: string;
  periodsHash: string;
}

/** エクスポート/インポート用のJSONフォーマット */
export interface BlockPuzzleExportData {
  version: number;
  periods: PLPeriodInput[];
  unit?: BlockPuzzleUnit;
  showCashSection?: boolean;
  ideal?: BlockPuzzleIdeal;
}

interface BlockPuzzleState {
  periods: PLPeriodInput[];
  unit: BlockPuzzleUnit;
  showCashSection: boolean;
  advice: BlockPuzzleAdvice | null;
  ideal: BlockPuzzleIdeal | null;

  setPeriods: (periods: PLPeriodInput[]) => void;
  updateField: (index: number, field: keyof PLPeriodInput, value: number | string) => void;
  applyPdfToColumn: (index: number, next: PLPeriodInput) => void;
  /** 過去期を1つ右にシフトし、next を最新期(index 0)に挿入。最古期は破棄。 */
  shiftAndInsertPeriod: (next: PLPeriodInput) => void;
  setUnit: (unit: BlockPuzzleUnit) => void;
  setShowCashSection: (show: boolean) => void;
  resetPeriods: () => void;
  setAdvice: (advice: BlockPuzzleAdvice | null) => void;
  setIdeal: (ideal: BlockPuzzleIdeal | null) => void;
  updateIdealField: (field: keyof PLPeriodInput, value: number | string) => void;
  loadFromJson: (data: BlockPuzzleExportData) => void;
}

/**
 * periodsの内容から決定論的なハッシュを生成。advice の有効性確認に使う。
 */
export function hashPeriods(periods: PLPeriodInput[]): string {
  const json = JSON.stringify(periods);
  // FNV-1a 32bit。短くてOKな用途
  let h = 0x811c9dc5;
  for (let i = 0; i < json.length; i++) {
    h ^= json.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

export const useBlockPuzzleStore = create<BlockPuzzleState>()(
  persist(
    (set) => ({
      periods: makeInitialPeriods(),
      unit: "thousand",
      showCashSection: true,
      advice: null,
      ideal: null,

      setPeriods: (periods) => set({ periods }),

      updateField: (index, field, value) =>
        set((state) => {
          const next = state.periods.slice();
          next[index] = { ...next[index], [field]: value } as PLPeriodInput;
          return { periods: next };
        }),

      applyPdfToColumn: (index, next) =>
        set((state) => {
          const out = state.periods.slice();
          // 借入金返済はPDFに載らないため、ユーザーの手入力値を保持
          out[index] = { ...next, loanRepayment: state.periods[index].loanRepayment };
          return { periods: out };
        }),

      shiftAndInsertPeriod: (next) =>
        set((state) => {
          const len = state.periods.length;
          // 最新期の loanRepayment は新規期では未定なので next の値（通常0）をそのまま使う
          return { periods: [next, ...state.periods.slice(0, len - 1)] };
        }),

      setUnit: (unit) => set({ unit }),

      setShowCashSection: (showCashSection) => set({ showCashSection }),

      resetPeriods: () => set({ periods: makeInitialPeriods(), advice: null, ideal: null }),

      setAdvice: (advice) => set({ advice }),

      setIdeal: (ideal) => set({ ideal }),

      updateIdealField: (field, value) =>
        set((state) => {
          if (!state.ideal) { return {}; }
          const period = { ...state.ideal.period, [field]: value } as PLPeriodInput;
          return { ideal: { ...state.ideal, period } };
        }),

      loadFromJson: (data) =>
        set((state) => {
          const periods =
            Array.isArray(data.periods) && data.periods.length > 0
              ? data.periods.map((period) => ({
                  ...createEmptyPLPeriod(period.periodLabel ?? ""),
                  ...period,
                }))
              : state.periods;
          return {
            periods,
            unit: data.unit ?? state.unit,
            showCashSection: data.showCashSection ?? state.showCashSection,
            // インポート時はadviceの整合性が取れないためクリア
            advice: null,
            ideal: data.ideal ?? null,
          };
        }),
    }),
    {
      name: "koganemushi-block-puzzle-v1",
      partialize: (state) => ({
        periods: state.periods,
        unit: state.unit,
        showCashSection: state.showCashSection,
        advice: state.advice,
        ideal: state.ideal,
      }),
      // 既存localStorageに新フィールドが欠けている場合のデフォルト補完
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<BlockPuzzleState>;
        const mergedPeriods =
          p.periods && p.periods.length > 0
            ? p.periods.map((period) => ({
                ...createEmptyPLPeriod(period.periodLabel ?? ""),
                ...period,
              }))
            : current.periods;
        return {
          ...current,
          ...p,
          periods: mergedPeriods,
          ideal: p.ideal ?? null,
        };
      },
    }
  )
);
