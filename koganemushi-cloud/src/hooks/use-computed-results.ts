import { useMemo } from "react";
import { useSimulationStore } from "@/stores/simulation-store";
import { useShallow } from "zustand/react/shallow";
import { calcExecutive, sumResults, calcCorporateTaxTotal } from "@/lib/calc-engine";
import type { ExecutiveInput, ExecutiveResult } from "@/types/simulation";

function calcExecPay(executives: ExecutiveInput[]): number {
  return executives.reduce(
    (s, e) =>
      s +
      e.regularSalary +
      e.predeterminedBonus1 +
      e.predeterminedBonus2 +
      e.predeterminedBonus3,
    0
  );
}

interface PlanResults {
  results: ExecutiveResult[];
  totals: ExecutiveResult;
  execPay: number;
  corporateIncome: number;
  corporateTax: number;
}

function usePlanResults(executives: ExecutiveInput[]): PlanResults {
  const { rates, combineOtherSalaryForInsurance, corporateTaxParams, effectiveTaxRates, taxYear } =
    useSimulationStore(
      useShallow((s) => ({
        rates: s.rates,
        combineOtherSalaryForInsurance: s.combineOtherSalaryForInsurance,
        corporateTaxParams: s.corporateTaxParams,
        effectiveTaxRates: s.effectiveTaxRates,
        taxYear: s.taxYear,
      }))
    );

  const results = useMemo(
    () =>
      executives.map((exec, i) =>
        calcExecutive(exec, rates, {
          combineOtherSalary: combineOtherSalaryForInsurance,
          executiveIndex: i,
          taxYear,
        })
      ),
    [executives, rates, combineOtherSalaryForInsurance, taxYear]
  );

  const totals = useMemo(() => sumResults(results), [results]);
  const execPay = useMemo(() => calcExecPay(executives), [executives]);

  const corporateIncome = useMemo(
    () => corporateTaxParams.preTaxCorporateIncome - execPay - totals.employerSocialInsurance,
    [corporateTaxParams.preTaxCorporateIncome, execPay, totals.employerSocialInsurance]
  );

  const corporateTax = useMemo(
    () =>
      calcCorporateTaxTotal(corporateTaxParams, execPay, totals.employerSocialInsurance, effectiveTaxRates),
    [corporateTaxParams, execPay, totals.employerSocialInsurance, effectiveTaxRates]
  );

  return { results, totals, execPay, corporateIncome, corporateTax };
}

export function useCurrentResults(): PlanResults {
  const currentExecutives = useSimulationStore((s) => s.currentExecutives);
  return usePlanResults(currentExecutives);
}

export function useComparisonResults(): PlanResults {
  const comparisonExecutives = useSimulationStore((s) => s.comparisonExecutives);
  return usePlanResults(comparisonExecutives);
}

export function usePlan2Results(): PlanResults {
  const plan2Executives = useSimulationStore((s) => s.plan2Executives);
  return usePlanResults(plan2Executives);
}
