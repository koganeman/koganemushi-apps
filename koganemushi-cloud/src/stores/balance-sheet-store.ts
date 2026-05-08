import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  BalanceSheetAdvice,
  BalanceSheetExportData,
  BalanceSheetUnit,
  BSPeriodInput,
} from "@/types/balance-sheet";
import { createEmptyBSPeriod } from "@/lib/balance-sheet-calc";

const DEFAULT_PERIODS = 5;

function makeInitialPeriods(): BSPeriodInput[] {
  // 左が最新期、右が古い期
  return Array.from({ length: DEFAULT_PERIODS }, (_, i) =>
    createEmptyBSPeriod(`第${DEFAULT_PERIODS - i}期`),
  );
}

interface BalanceSheetState {
  periods: BSPeriodInput[];
  unit: BalanceSheetUnit;
  advice: BalanceSheetAdvice | null;

  setPeriods: (periods: BSPeriodInput[]) => void;
  updateField: (
    index: number,
    field: keyof BSPeriodInput,
    value: number | string,
  ) => void;
  applyPdfToColumn: (index: number, next: BSPeriodInput) => void;
  setUnit: (unit: BalanceSheetUnit) => void;
  resetPeriods: () => void;
  setAdvice: (advice: BalanceSheetAdvice | null) => void;
  loadFromJson: (data: BalanceSheetExportData) => void;
}

/** periodsの内容から決定論的なハッシュを生成（advice の有効性確認用） */
export function hashBSPeriods(periods: BSPeriodInput[]): string {
  const json = JSON.stringify(periods);
  let h = 0x811c9dc5;
  for (let i = 0; i < json.length; i++) {
    h ^= json.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

export const useBalanceSheetStore = create<BalanceSheetState>()(
  persist(
    (set) => ({
      periods: makeInitialPeriods(),
      unit: "thousand",
      advice: null,

      setPeriods: (periods) => set({ periods }),

      updateField: (index, field, value) =>
        set((state) => {
          const next = state.periods.slice();
          next[index] = { ...next[index], [field]: value } as BSPeriodInput;
          return { periods: next };
        }),

      applyPdfToColumn: (index, next) =>
        set((state) => {
          const out = state.periods.slice();
          out[index] = next;
          return { periods: out };
        }),

      setUnit: (unit) => set({ unit }),

      resetPeriods: () => set({ periods: makeInitialPeriods(), advice: null }),

      setAdvice: (advice) => set({ advice }),

      loadFromJson: (data) =>
        set((state) => {
          const periods =
            Array.isArray(data.periods) && data.periods.length > 0
              ? data.periods.map((period) => ({
                  ...createEmptyBSPeriod(period.periodLabel ?? ""),
                  ...period,
                }))
              : state.periods;
          return {
            periods,
            unit: data.unit ?? state.unit,
            advice: null,
          };
        }),
    }),
    {
      name: "koganemushi-balance-sheet-v1",
      partialize: (state) => ({
        periods: state.periods,
        unit: state.unit,
        advice: state.advice,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<BalanceSheetState>;
        const mergedPeriods =
          p.periods && p.periods.length > 0
            ? p.periods.map((period) => ({
                ...createEmptyBSPeriod(period.periodLabel ?? ""),
                ...period,
              }))
            : current.periods;
        return {
          ...current,
          ...p,
          periods: mergedPeriods,
        };
      },
    },
  ),
);
