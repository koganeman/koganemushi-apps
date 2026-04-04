import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { HojinnariInput, HojinnariRates, FamilyMember } from "@/types/hojinnari";

export type HojinnariTab = "simulation" | "houjinnari" | "houkokusho" | "saitekika";

const EMPTY_FAMILY_MEMBER: FamilyMember = {
  age: 0,
  salaryIncome: 0,
  pensionIncome: 0,
  otherIncome: 0,
  socialInsurance: 0,
  otherDeductions: 0,
};

export const DEFAULT_HOJINNARI_RATES: HojinnariRates = {
  healthInsuranceRate: 0.0991,
  nursingCareRate: 0.0159,
  pensionRate: 0.183,
  corporateTaxRate1: 0.15,
  corporateTaxRate2: 0.232,
  localCorpTaxRate: 0.104,
  businessTaxRate1: 0.07,
  businessTaxRate2: 0.085,
  businessTaxRate3: 0.1,
  localBusinessTaxRate: 0.375,
};

export const DEFAULT_HOJINNARI_INPUT: HojinnariInput = {
  // 現状（個人事業主）
  businessIncome: 0,
  blueDeduction: 650000,
  ownerAge: 45,
  ownerNationalInsurance: 0,
  ownerSalaryIncome: 0,
  ownerPensionIncome: 0,
  ownerOtherIncome: 0,
  ownerOtherDeductions: 0,
  isChildcareHousehold: false,

  // 家族構成
  hasSpouse: false,
  spouse: { ...EMPTY_FAMILY_MEMBER },
  childCount: 0,
  children: [{ ...EMPTY_FAMILY_MEMBER }, { ...EMPTY_FAMILY_MEMBER }],

  // PLAN1: マイクロ法人成り
  plan1MicroRevenue: 0,
  plan1MicroSalary: 0,
  plan1SpouseSalary: 0,

  // PLAN2: 完全法人成り
  plan2Salary: 0,
  plan2SpouseSalary: 0,
};

interface HojinnariState {
  input: HojinnariInput;
  rates: HojinnariRates;
  activeTab: HojinnariTab;
  reportPlan2Input: HojinnariInput | null;
  reportPlan2Rates: HojinnariRates | null;
  setInput: (partial: Partial<HojinnariInput>) => void;
  setSpouse: (partial: Partial<FamilyMember>) => void;
  setChild: (index: 0 | 1, partial: Partial<FamilyMember>) => void;
  setRates: (partial: Partial<HojinnariRates>) => void;
  setActiveTab: (tab: HojinnariTab) => void;
  savePlan1AsPlan2: () => void;
  copyReportPlan1ToPlan2: () => void;
}

export const useHojinnariStore = create<HojinnariState>()(
  persist(
    (set) => ({
      input: { ...DEFAULT_HOJINNARI_INPUT },
      rates: { ...DEFAULT_HOJINNARI_RATES },
      activeTab: "simulation",
      reportPlan2Input: null,
      reportPlan2Rates: null,

      setInput: (partial) =>
        set((state) => ({ input: { ...state.input, ...partial } })),

      setSpouse: (partial) =>
        set((state) => ({
          input: {
            ...state.input,
            spouse: { ...state.input.spouse, ...partial },
          },
        })),

      setChild: (index, partial) =>
        set((state) => {
          const children = [...state.input.children] as [FamilyMember, FamilyMember];
          children[index] = { ...children[index], ...partial };
          return { input: { ...state.input, children } };
        }),

      setRates: (partial) =>
        set((state) => ({ rates: { ...state.rates, ...partial } })),

      setActiveTab: (activeTab) => set({ activeTab }),

      // 法人なりシートの設定値を転記
      savePlan1AsPlan2: () =>
        set((state) => ({
          input: {
            ...state.input,
            plan2Salary: state.input.plan1MicroSalary,
            plan2SpouseSalary: state.input.plan1SpouseSalary,
          },
        })),

      // 報告書: プラン1の現在の入力値・料率をプラン2にスナップショット保存
      copyReportPlan1ToPlan2: () =>
        set((state) => ({
          reportPlan2Input: { ...state.input },
          reportPlan2Rates: { ...state.rates },
        })),
    }),
    {
      name: "koganemushi-hojinnari-v2",
      partialize: (state) => ({
        input: state.input,
        rates: state.rates,
        reportPlan2Input: state.reportPlan2Input,
        reportPlan2Rates: state.reportPlan2Rates,
      }),
    }
  )
);
