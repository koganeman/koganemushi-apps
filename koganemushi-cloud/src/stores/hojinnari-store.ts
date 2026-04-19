import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { HojinnariInput, HojinnariRates, FamilyMember, DecisionMeasure } from "@/types/hojinnari";
import type { TaxYear } from "@/lib/tax-tables";

export type HojinnariTab = "simulation" | "houjinnari" | "houkokusho" | "saitekika" | "keisan-meisai";

const EMPTY_FAMILY_MEMBER: FamilyMember = {
  age: 0,
  salaryIncome: 0,
  pensionIncome: 0,
  otherIncome: 0,
  socialInsurance: 0,
  otherDeductions: 0,
};

const DEFAULT_DECISION_MEASURES: DecisionMeasure[] = [
  { name: "出張旅費手当", corporateExpense: 0, taxDeductible: 0, personalIncomeIncrease: 0, hiddenAssetIncrease: 0 },
  { name: "社宅家賃", corporateExpense: 0, taxDeductible: 0, personalIncomeIncrease: 0, hiddenAssetIncrease: 0 },
  { name: "セーフティ共済", corporateExpense: 0, taxDeductible: 0, personalIncomeIncrease: 0, hiddenAssetIncrease: 0 },
  { name: "経営者保険", corporateExpense: 0, taxDeductible: 0, personalIncomeIncrease: 0, hiddenAssetIncrease: 0 },
  { name: "", corporateExpense: 0, taxDeductible: 0, personalIncomeIncrease: 0, hiddenAssetIncrease: 0 },
  { name: "", corporateExpense: 0, taxDeductible: 0, personalIncomeIncrease: 0, hiddenAssetIncrease: 0 },
  { name: "", corporateExpense: 0, taxDeductible: 0, personalIncomeIncrease: 0, hiddenAssetIncrease: 0 },
  { name: "", corporateExpense: 0, taxDeductible: 0, personalIncomeIncrease: 0, hiddenAssetIncrease: 0 },
];

export const DEFAULT_HOJINNARI_RATES: HojinnariRates = {
  healthInsuranceRate: 0.0991,
  nursingCareRate: 0.0159,
  pensionRate: 0.183,
  childcareSupportRate: 0.0023,
  childcareContributionRate: 0.0036,
  corporateTaxRate1: 0.15,
  corporateTaxRate2: 0.232,
  localCorpTaxRate: 0.104,
  businessTaxRate1: 0.07,
  businessTaxRate2: 0.085,
  businessTaxRate3: 0.1,
  localBusinessTaxRate: 0.375,
  medicalBusinessTaxRate1: 0.035,
  medicalBusinessTaxRate2: 0.049,
  medicalBusinessTaxRate3: 0.07,
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

  // 非常勤役員
  isNonExecutive: true,

  // 医療法人
  isMedicalCorporation: false,
  socialInsuranceMedicalRevenue: 0,
  totalRevenue: 0,

  // 従業員
  employeeSalary: 0,
};

interface HojinnariState {
  input: HojinnariInput;
  rates: HojinnariRates;
  decisionMeasures: DecisionMeasure[];
  activeTab: HojinnariTab;
  taxYear: TaxYear;
  reportPlan2Input: HojinnariInput | null;
  reportPlan2Rates: HojinnariRates | null;
  setInput: (partial: Partial<HojinnariInput>) => void;
  setSpouse: (partial: Partial<FamilyMember>) => void;
  setChild: (index: 0 | 1, partial: Partial<FamilyMember>) => void;
  setRates: (partial: Partial<HojinnariRates>) => void;
  setDecisionMeasure: (index: number, partial: Partial<DecisionMeasure>) => void;
  setActiveTab: (tab: HojinnariTab) => void;
  setTaxYear: (taxYear: TaxYear) => void;
  savePlan1AsPlan2: () => void;
  copyReportPlan1ToPlan2: () => void;
}

export const useHojinnariStore = create<HojinnariState>()(
  persist(
    (set) => ({
      input: { ...DEFAULT_HOJINNARI_INPUT },
      rates: { ...DEFAULT_HOJINNARI_RATES },
      decisionMeasures: DEFAULT_DECISION_MEASURES.map((m) => ({ ...m })),
      activeTab: "simulation",
      taxYear: "R8" as TaxYear,
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

      setDecisionMeasure: (index, partial) =>
        set((state) => {
          const measures = [...state.decisionMeasures] as DecisionMeasure[];
          measures[index] = { ...measures[index], ...partial };
          return { decisionMeasures: measures };
        }),

      setActiveTab: (activeTab) => set({ activeTab }),

      setTaxYear: (taxYear) => set({ taxYear }),

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
      name: "koganemushi-hojinnari-v4",
      partialize: (state) => ({
        input: state.input,
        rates: state.rates,
        decisionMeasures: state.decisionMeasures,
        taxYear: state.taxYear,
        reportPlan2Input: state.reportPlan2Input,
        reportPlan2Rates: state.reportPlan2Rates,
      }),
    }
  )
);
