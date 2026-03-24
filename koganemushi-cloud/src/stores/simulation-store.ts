import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  RateSettings,
  CorporateTaxParams,
  EffectiveTaxRates,
  ExecutiveInput,
} from "@/types/simulation";
import { createDefaultSimulationData, createEmptyExecutive } from "@/lib/defaults";

export type Tab = "simulation" | "hojinzei" | "houkokusho" | "saitekika";

interface SimulationState {
  // Data
  rates: RateSettings;
  corporateTaxParams: CorporateTaxParams;
  effectiveTaxRates: EffectiveTaxRates;
  currentExecutives: ExecutiveInput[];
  comparisonExecutives: ExecutiveInput[];
  plan2Executives: ExecutiveInput[];
  governmentHealthInsurance: boolean;
  combineOtherSalaryForInsurance: boolean;
  activeTab: Tab;

  // Actions
  setRates: (rates: RateSettings) => void;
  setCorporateTaxParams: (params: CorporateTaxParams) => void;
  updateCurrentExecutive: (index: number, exec: ExecutiveInput) => void;
  updateComparisonExecutive: (index: number, exec: ExecutiveInput) => void;
  transferCurrentToComparison: () => void;
  copyToPlan2: () => void;
  applyDividend: (dividend: number, salary: number) => void;
  applyBonus: (bonus: number) => void;
  setGovernmentHealthInsurance: (checked: boolean) => void;
  setCombineOtherSalaryForInsurance: (checked: boolean) => void;
  setActiveTab: (tab: Tab) => void;
}

const defaults = createDefaultSimulationData();

export const useSimulationStore = create<SimulationState>()(
  persist(
    (set) => ({
  // Initial data
  rates: defaults.rates,
  corporateTaxParams: defaults.corporateTaxParams,
  effectiveTaxRates: defaults.effectiveTaxRates,
  currentExecutives: defaults.currentExecutives,
  comparisonExecutives: defaults.comparisonExecutives,
  plan2Executives: Array.from({ length: 10 }, () => createEmptyExecutive()),
  governmentHealthInsurance: defaults.governmentHealthInsurance,
  combineOtherSalaryForInsurance: defaults.combineOtherSalaryForInsurance,
  activeTab: "simulation",

  // Actions
  setRates: (rates) => set({ rates }),

  setCorporateTaxParams: (corporateTaxParams) => set({ corporateTaxParams }),

  updateCurrentExecutive: (index, exec) =>
    set((state) => {
      const updated = [...state.currentExecutives];
      updated[index] = exec;
      return { currentExecutives: updated };
    }),

  updateComparisonExecutive: (index, exec) =>
    set((state) => {
      const updated = [...state.comparisonExecutives];
      updated[index] = exec;
      return { comparisonExecutives: updated };
    }),

  transferCurrentToComparison: () =>
    set((state) => ({
      comparisonExecutives: state.currentExecutives.map((e) => ({ ...e })),
    })),

  copyToPlan2: () =>
    set((state) => ({
      plan2Executives: state.comparisonExecutives.map((e) => ({ ...e })),
    })),

  applyDividend: (dividend, salary) =>
    set((state) => {
      const updated = [...state.comparisonExecutives];
      updated[0] = { ...updated[0], dividendIncome: dividend, regularSalary: salary };
      return { comparisonExecutives: updated };
    }),

  applyBonus: (bonus) =>
    set((state) => {
      const updated = [...state.comparisonExecutives];
      updated[0] = { ...updated[0], predeterminedBonus1: bonus };
      return { comparisonExecutives: updated };
    }),

  setGovernmentHealthInsurance: (governmentHealthInsurance) =>
    set({ governmentHealthInsurance }),

  setCombineOtherSalaryForInsurance: (combineOtherSalaryForInsurance) =>
    set({ combineOtherSalaryForInsurance }),

  setActiveTab: (activeTab) => set({ activeTab }),
    }),
    {
      name: "koganemushi-simulation",
      partialize: (state) => ({
        rates: state.rates,
        corporateTaxParams: state.corporateTaxParams,
        effectiveTaxRates: state.effectiveTaxRates,
        currentExecutives: state.currentExecutives,
        comparisonExecutives: state.comparisonExecutives,
        plan2Executives: state.plan2Executives,
        governmentHealthInsurance: state.governmentHealthInsurance,
        combineOtherSalaryForInsurance: state.combineOtherSalaryForInsurance,
      }),
    }
  )
);
