import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  BSDetail,
  CompanyProfile,
  FinancialAnalysisExportData,
} from "@/types/financial-analysis";

const DEFAULT_PERIODS = 5;

function makeInitialProfile(): CompanyProfile {
  return {
    industrySubCode: "",
    industryGroupCode: "",
    capitalYen: 0,
    employeeCounts: Array.from({ length: DEFAULT_PERIODS }, () => null),
  };
}

function makeInitialDetails(): BSDetail[] {
  return Array.from({ length: DEFAULT_PERIODS }, () => ({
    receivables: 0,
    inventory: 0,
    payables: 0,
    totalDebt: 0,
  }));
}

interface FinancialAnalysisState {
  profile: CompanyProfile;
  bsDetails: BSDetail[];

  setProfile: (profile: CompanyProfile) => void;
  updateProfileField: <K extends keyof CompanyProfile>(field: K, value: CompanyProfile[K]) => void;
  setEmployeeCount: (index: number, value: number | null) => void;
  setBSDetails: (details: BSDetail[]) => void;
  updateBSDetailField: (index: number, field: keyof BSDetail, value: number) => void;
  /** P/L・B/Sのシフトに連動してBSDetailと従業員数を1つ右にシフト */
  shiftAndInsertEmpty: () => void;
  resetAnalysis: () => void;
  loadFromJson: (data: FinancialAnalysisExportData) => void;
}

export const useFinancialAnalysisStore = create<FinancialAnalysisState>()(
  persist(
    (set) => ({
      profile: makeInitialProfile(),
      bsDetails: makeInitialDetails(),

      setProfile: (profile) => set({ profile }),

      updateProfileField: (field, value) =>
        set((state) => ({ profile: { ...state.profile, [field]: value } })),

      setEmployeeCount: (index, value) =>
        set((state) => {
          const next = state.profile.employeeCounts.slice();
          next[index] = value;
          return { profile: { ...state.profile, employeeCounts: next } };
        }),

      setBSDetails: (bsDetails) => set({ bsDetails }),

      updateBSDetailField: (index, field, value) =>
        set((state) => {
          const next = state.bsDetails.slice();
          next[index] = { ...next[index], [field]: value };
          return { bsDetails: next };
        }),

      shiftAndInsertEmpty: () =>
        set((state) => {
          const len = state.bsDetails.length;
          const detEmpty: BSDetail = {
            receivables: 0,
            inventory: 0,
            payables: 0,
            totalDebt: 0,
          };
          const newDetails = [detEmpty, ...state.bsDetails.slice(0, len - 1)];
          const newCounts = [null, ...state.profile.employeeCounts.slice(0, len - 1)];
          return {
            bsDetails: newDetails,
            profile: { ...state.profile, employeeCounts: newCounts },
          };
        }),

      resetAnalysis: () =>
        set({
          profile: makeInitialProfile(),
          bsDetails: makeInitialDetails(),
        }),

      loadFromJson: (data) =>
        set((state) => ({
          profile: data.profile ?? state.profile,
          bsDetails: Array.isArray(data.bsDetails) && data.bsDetails.length > 0
            ? data.bsDetails
            : state.bsDetails,
        })),
    }),
    {
      name: "koganemushi-financial-analysis-v1",
      partialize: (state) => ({
        profile: state.profile,
        bsDetails: state.bsDetails,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<FinancialAnalysisState>;
        return {
          ...current,
          ...p,
          profile: p.profile ?? current.profile,
          bsDetails: p.bsDetails ?? current.bsDetails,
        };
      },
    },
  ),
);
