import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PLPeriodInput, BlockPuzzleUnit } from "@/types/block-puzzle";
import { createEmptyPLPeriod } from "@/lib/block-puzzle-calc";

const DEFAULT_PERIODS = 5;

function makeInitialPeriods(): PLPeriodInput[] {
  // 左が最新期、右が古い期
  return Array.from({ length: DEFAULT_PERIODS }, (_, i) =>
    createEmptyPLPeriod(`第${DEFAULT_PERIODS - i}期`)
  );
}

interface BlockPuzzleState {
  periods: PLPeriodInput[];
  unit: BlockPuzzleUnit;
  showCashSection: boolean;

  setPeriods: (periods: PLPeriodInput[]) => void;
  updateField: (index: number, field: keyof PLPeriodInput, value: number | string) => void;
  applyPdfToColumn: (index: number, next: PLPeriodInput) => void;
  setUnit: (unit: BlockPuzzleUnit) => void;
  setShowCashSection: (show: boolean) => void;
  resetPeriods: () => void;
}

export const useBlockPuzzleStore = create<BlockPuzzleState>()(
  persist(
    (set) => ({
      periods: makeInitialPeriods(),
      unit: "thousand",
      showCashSection: true,

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

      setUnit: (unit) => set({ unit }),

      setShowCashSection: (showCashSection) => set({ showCashSection }),

      resetPeriods: () => set({ periods: makeInitialPeriods() }),
    }),
    {
      name: "koganemushi-block-puzzle-v1",
      partialize: (state) => ({
        periods: state.periods,
        unit: state.unit,
        showCashSection: state.showCashSection,
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
        };
      },
    }
  )
);
