import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { HojinnariInput, HojinnariRates } from "@/types/hojinnari";

export type HojinnariTab = "simulation" | "houjinnari" | "houkokusho" | "saitekika";

export const DEFAULT_HOJINNARI_RATES: HojinnariRates = {
  healthInsuranceRate: 0.0991,
  nursingCareRate: 0.0159,
  pensionRate: 0.183,
  // 法人税（中小企業の軽減税率15%、通常23.2%、地方法人特別税10.4%）
  corporateTaxRate1: 0.15,
  corporateTaxRate2: 0.232,
  localCorpTaxRate: 0.104,
  // 事業税（東京都・普通法人の標準税率）
  businessTaxRate1: 0.07,
  businessTaxRate2: 0.085,
  businessTaxRate3: 0.1,
  localBusinessTaxRate: 0.375,
};

export const DEFAULT_HOJINNARI_INPUT: HojinnariInput = {
  businessIncome: 0,
  blueDeduction: 650000,
  spouseExpense: 0,
  ownerAge: 45,
  ownerNationalInsurance: 0,
  ownerOtherDeductions: 0,
  isChildcareHousehold: false,
  corporateSalary: 0,
  spouseSalary: 0,
};

interface HojinnariState {
  input: HojinnariInput;
  rates: HojinnariRates;
  activeTab: HojinnariTab;
  setInput: (partial: Partial<HojinnariInput>) => void;
  setRates: (partial: Partial<HojinnariRates>) => void;
  setActiveTab: (tab: HojinnariTab) => void;
}

export const useHojinnariStore = create<HojinnariState>()(
  persist(
    (set) => ({
      input: { ...DEFAULT_HOJINNARI_INPUT },
      rates: { ...DEFAULT_HOJINNARI_RATES },
      activeTab: "simulation",

      setInput: (partial) =>
        set((state) => ({ input: { ...state.input, ...partial } })),

      setRates: (partial) =>
        set((state) => ({ rates: { ...state.rates, ...partial } })),

      setActiveTab: (activeTab) => set({ activeTab }),
    }),
    {
      name: "koganemushi-hojinnari",
      partialize: (state) => ({
        input: state.input,
        rates: state.rates,
      }),
    }
  )
);
