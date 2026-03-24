import { useMemo } from "react";
import { useSimulationStore } from "@/stores/simulation-store";
import { useShallow } from "zustand/react/shallow";
import { calcExecutive, sumResults, calcCorporateTaxTotal } from "@/lib/calc-engine";
import type { ExecutiveInput, ExecutiveResult } from "@/types/simulation";

/** 役員報酬合計（定期同額＋事前確定） */
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
  const { rates, governmentHealthInsurance, combineOtherSalaryForInsurance, corporateTaxParams, effectiveTaxRates } =
    useSimulationStore(
      useShallow((s) => ({
        rates: s.rates,
        governmentHealthInsurance: s.governmentHealthInsurance,
        combineOtherSalaryForInsurance: s.combineOtherSalaryForInsurance,
        corporateTaxParams: s.corporateTaxParams,
        effectiveTaxRates: s.effectiveTaxRates,
      }))
    );

  const results = useMemo(
    () =>
      executives.map((exec, i) =>
        calcExecutive(exec, rates, {
          isGovernmentHealthInsurance: governmentHealthInsurance,
          combineOtherSalary: combineOtherSalaryForInsurance,
          executiveIndex: i,
        })
      ),
    [executives, rates, governmentHealthInsurance, combineOtherSalaryForInsurance]
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
