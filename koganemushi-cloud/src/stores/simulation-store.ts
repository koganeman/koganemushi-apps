import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  RateSettings,
  CorporateTaxParams,
  EffectiveTaxRates,
  ExecutiveInput,
} from "@/types/simulation";
import type { TaxYear } from "@/lib/tax-tables";
import { createDefaultSimulationData, createEmptyExecutive } from "@/lib/defaults";

export type Tab = "simulation" | "hojinzei" | "houkokusho" | "saitekika";

interface SimulationState {
  rates: RateSettings;
  corporateTaxParams: CorporateTaxParams;
  effectiveTaxRates: EffectiveTaxRates;
  currentExecutives: ExecutiveInput[];
  comparisonExecutives: ExecutiveInput[];
  plan2Executives: ExecutiveInput[];
  combineOtherSalaryForInsurance: boolean;
  activeTab: Tab;
  taxYear: TaxYear;
  plan1Label: string;
  plan2Label: string;

  setRates: (rates: RateSettings) => void;
  setCorporateTaxParams: (params: CorporateTaxParams) => void;
  updateCurrentExecutive: (index: number, exec: ExecutiveInput) => void;
  updateComparisonExecutive: (index: number, exec: ExecutiveInput) => void;
  transferCurrentToComparison: () => void;
  copyToPlan2: () => void;
  applyDividend: (dividend: number, salary: number) => void;
  applyBonus: (bonus: number) => void;
  setCombineOtherSalaryForInsurance: (checked: boolean) => void;
  setActiveTab: (tab: Tab) => void;
  setTaxYear: (taxYear: TaxYear) => void;
  setPlan1Label: (label: string) => void;
  setPlan2Label: (label: string) => void;
}

const defaults = createDefaultSimulationData();

function migrateExecutive(exec: Partial<ExecutiveInput>): ExecutiveInput {
  const regular = exec.regularSalary ?? 0;
  return {
    ...createEmptyExecutive(),
    ...exec,
    preChangeMonthlyRemuneration: exec.preChangeMonthlyRemuneration ?? 0,
    postChangeMonthlyRemuneration:
      exec.postChangeMonthlyRemuneration ?? (regular > 0 ? Math.floor(regular / 12) : 0),
    standardRemunerationChangeMonth: exec.standardRemunerationChangeMonth ?? 1,
    hasMidYearChange: exec.hasMidYearChange ?? false,
  };
}

export const useSimulationStore = create<SimulationState>()(
  persist(
    (set) => ({
      rates: defaults.rates,
      corporateTaxParams: defaults.corporateTaxParams,
      effectiveTaxRates: defaults.effectiveTaxRates,
      currentExecutives: defaults.currentExecutives,
      comparisonExecutives: defaults.comparisonExecutives,
      plan2Executives: Array.from({ length: 10 }, () => createEmptyExecutive()),
      combineOtherSalaryForInsurance: defaults.combineOtherSalaryForInsurance,
      activeTab: "simulation",
      taxYear: "R8" as TaxYear,
      plan1Label: "",
      plan2Label: "",

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

      setCombineOtherSalaryForInsurance: (combineOtherSalaryForInsurance) =>
        set({ combineOtherSalaryForInsurance }),

      setActiveTab: (activeTab) => set({ activeTab }),
      setTaxYear: (taxYear) => set({ taxYear }),
      setPlan1Label: (plan1Label) => set({ plan1Label }),
      setPlan2Label: (plan2Label) => set({ plan2Label }),
    }),
    {
      name: "koganemushi-simulation",
      version: 3,
      migrate: (persistedState: unknown, version: number) => {
        const s = persistedState as Record<string, unknown>;
        if (!s || typeof s !== "object") return s;
        if (version < 2) {
          delete s.governmentHealthInsurance;
        }
        if (version < 3) {
          for (const key of ["currentExecutives", "comparisonExecutives", "plan2Executives"] as const) {
            if (Array.isArray(s[key])) {
              s[key] = (s[key] as Partial<ExecutiveInput>[]).map(migrateExecutive);
            }
          }
        }
        return s;
      },
      partialize: (state) => ({
        rates: state.rates,
        corporateTaxParams: state.corporateTaxParams,
        effectiveTaxRates: state.effectiveTaxRates,
        currentExecutives: state.currentExecutives,
        comparisonExecutives: state.comparisonExecutives,
        plan2Executives: state.plan2Executives,
        combineOtherSalaryForInsurance: state.combineOtherSalaryForInsurance,
        taxYear: state.taxYear,
        plan1Label: state.plan1Label,
        plan2Label: state.plan2Label,
      }),
    }
  )
);
