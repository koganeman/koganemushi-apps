import type {
  RateSettings,
  CorporateTaxParams,
  ExecutiveInput,
  SimulationData,
} from "@/types/simulation";
import { DEFAULT_EFFECTIVE_TAX_RATES } from "./tax-tables";

export const defaultRates: RateSettings = {
  healthInsuranceRate: 0.0991,
  nursingCareRate: 0.0159,
  pensionRate: 0.183,
  childcareSupportRate: 0.0023,
  childcareContributionRate: 0.0036,
  healthBonusAnnualCap: 5730000,
  pensionBonusPerPaymentCap: 1500000,
};

export const defaultCorporateTaxParams: CorporateTaxParams = {
  preTaxCorporateIncome: 0,
  perCapitaLevy: 70000,
  carryForwardLoss: 0,
};

export function createEmptyExecutive(): ExecutiveInput {
  return {
    name: "",
    age: 0,
    regularSalary: 0,
    predeterminedBonus1: 0,
    predeterminedBonus2: 0,
    predeterminedBonus3: 0,
    otherSalaryIncome: 0,
    definedBenefitPension: 0,
    dividendIncome: 0,
    otherIncome: 0,
    otherDeductions: 0,
    taxCredit: 0,
    socialInsuranceEnrolled: true,
    childcareHousehold: true,
    manualHealthInsurance: false,
    manualHealthInsuranceAmount: 0,
    preChangeMonthlyRemuneration: 0,
    postChangeMonthlyRemuneration: 0,
    standardRemunerationChangeMonth: 1,
  };
}

export function createDefaultSimulationData(): SimulationData {
  const executives = Array.from({ length: 10 }, () => createEmptyExecutive());

  return {
    rates: { ...defaultRates },
    corporateTaxParams: { ...defaultCorporateTaxParams },
    effectiveTaxRates: { ...DEFAULT_EFFECTIVE_TAX_RATES },
    currentExecutives: executives,
    comparisonExecutives: executives.map((e) => ({ ...e })),
    combineOtherSalaryForInsurance: false,
  };
}
