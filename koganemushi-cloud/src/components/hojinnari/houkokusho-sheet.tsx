"use client";

import { useHojinnariStore } from "@/stores/hojinnari-store";
import { useShallow } from "zustand/react/shallow";
import { calcIndividual, calcPlan1, calcPlan2 } from "@/lib/hojinnari-calc";
import { formatYen } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from "recharts";

/** 差引の有利/不利ラベル */
function diffLabel(value: number, type: "burden" | "income"): string {
  if (value === 0) return "";
  if (type === "burden") {
    return value > 0 ? "不利/負担増" : "有利/負担減";
  }
  return value > 0 ? "有利/手取り増" : "不利/手取り減";
}

function fmtOrEmpty(value: number): string {
  if (value === 0) return "";
  return formatYen(value);
}

function fmtDiff(value: number): string {
  if (value === 0) return "";
  return formatYen(value);
}

function PlanTable({
  title,
  individual,
  planResult,
}: {
  title: string;
  individual: ReturnType<typeof calcIndividual>;
  planResult: ReturnType<typeof calcPlan1>;
}) {
  // 現状
  const curBusinessIncome = individual.businessIncome;
  const curSalaryIncome = 0; // 個人事業主は給与収入なし（法人からの給与はない）
  const curCorporateTax = 0;
  const curPersonalTax = individual.taxTotal; // 所得税+住民税
  const curBusinessTax = individual.individualBusinessTax;
  const curTaxTotal = curCorporateTax + curPersonalTax + curBusinessTax;
  const curSocialIndividual = individual.nationalInsurance;
  const curSocialEmployer = 0;
  const curSocialTotal = curSocialIndividual + curSocialEmployer;
  const curBurden = curTaxTotal + curSocialTotal;
  const curCombinedNet = individual.netIncome;
  const curPersonalNet = individual.netIncome;
  const curCorporateNet = 0;

  // 法人成り後
  const aftBusinessIncome = planResult.individualBusinessIncome;
  const aftCorporateIncome = planResult.corporateIncome;
  const aftSalaryIncome = planResult.corporateSalary;
  const aftCorporateTax = planResult.corporateTax + planResult.corporateBusinessTax;
  const aftPersonalTax = planResult.individualIncomeTax + planResult.individualResidentTax;
  const aftBusinessTax = planResult.individualBusinessTax;
  const aftTaxTotal = aftCorporateTax + aftPersonalTax + aftBusinessTax;
  const aftSocialIndividual = planResult.ownerSocialInsurance;
  const aftSocialEmployer = planResult.employerSocialInsurance;
  const aftSocialTotal = planResult.totalSocialInsurance;
  const aftBurden = aftTaxTotal + aftSocialTotal;
  const aftCombinedNet = planResult.combinedNetIncome;
  const aftPersonalNet = planResult.ownerNetIncome;
  const aftCorporateNet = planResult.corporateRetained;

  const thCls = "py-1.5 px-2 text-right text-[11px] font-bold text-white bg-[#1f3f7a] border border-gray-400";
  const thLabelCls = `${thCls} text-left`;
  const tdLabel = "py-1 px-2 text-[11px] text-gray-700 border border-gray-300 whitespace-nowrap";
  const tdVal = "py-1 px-2 text-right text-[11px] font-mono border border-gray-300";
  const tdBoldLabel = "py-1 px-2 text-[11px] font-bold text-gray-900 border border-gray-300 whitespace-nowrap";
  const tdBoldVal = "py-1 px-2 text-right text-[11px] font-mono font-bold border border-gray-300";

  function DiffTd({ value, type }: { value: number; type: "burden" | "income" }) {
    const label = diffLabel(value, type);
    const color = type === "burden"
      ? (value > 0 ? "text-red-600" : value < 0 ? "text-blue-700" : "")
      : (value < 0 ? "text-red-600" : value > 0 ? "text-blue-700" : "");
    return (
      <td className={`${tdBoldVal} ${color}`}>
        {fmtDiff(value)}
        {label && <span className="ml-1 text-[9px]">{label}</span>}
      </td>
    );
  }

  return (
    <div>
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr>
            <th className={thLabelCls} style={{ width: "140px" }}></th>
            <th className={thCls}>現状</th>
            <th className={thCls}>法人成り後</th>
            <th className={thCls}>差引</th>
          </tr>
        </thead>
        <tbody>
          {/* 所得 */}
          <tr>
            <td className={tdLabel}>事業所得金額</td>
            <td className={tdVal}>{fmtOrEmpty(curBusinessIncome)}</td>
            <td className={tdVal}>{fmtOrEmpty(aftBusinessIncome)}</td>
            <td className={tdVal}></td>
          </tr>
          <tr>
            <td className={tdLabel}>法人所得金額</td>
            <td className={tdVal}></td>
            <td className={tdVal}>{fmtOrEmpty(aftCorporateIncome)}</td>
            <td className={tdVal}></td>
          </tr>
          <tr>
            <td className={tdLabel}>給与収入金額</td>
            <td className={tdVal}>{fmtOrEmpty(curSalaryIncome)}</td>
            <td className={tdVal}>{fmtOrEmpty(aftSalaryIncome)}</td>
            <td className={tdVal}></td>
          </tr>

          {/* 空行 */}
          <tr><td colSpan={4} className="border border-gray-300 h-2"></td></tr>

          {/* 税金 */}
          <tr>
            <td className={tdLabel}>法人税等</td>
            <td className={tdVal}></td>
            <td className={tdVal}>{fmtOrEmpty(aftCorporateTax)}</td>
            <td className={tdVal}>{fmtDiff(aftCorporateTax - curCorporateTax)}</td>
          </tr>
          <tr>
            <td className={tdLabel}>個人所得税等</td>
            <td className={tdVal}>{fmtOrEmpty(curPersonalTax)}</td>
            <td className={tdVal}>{fmtOrEmpty(aftPersonalTax)}</td>
            <td className={tdVal}>{fmtDiff(aftPersonalTax - curPersonalTax)}</td>
          </tr>
          <tr>
            <td className={tdLabel}>事業税</td>
            <td className={tdVal}>{fmtOrEmpty(curBusinessTax)}</td>
            <td className={tdVal}>{fmtOrEmpty(aftBusinessTax)}</td>
            <td className={tdVal}>{fmtDiff(aftBusinessTax - curBusinessTax)}</td>
          </tr>

          {/* 空行 */}
          <tr><td colSpan={4} className="border border-gray-300 h-2"></td></tr>

          {/* 税金合計 */}
          <tr className="bg-gray-50">
            <td className={tdBoldLabel}>税金</td>
            <td className={tdBoldVal}>{fmtOrEmpty(curTaxTotal)}</td>
            <td className={tdBoldVal}>{fmtOrEmpty(aftTaxTotal)}</td>
            <td className={tdBoldVal}>{fmtDiff(aftTaxTotal - curTaxTotal)}</td>
          </tr>

          {/* 空行 */}
          <tr><td colSpan={4} className="border border-gray-300 h-2"></td></tr>

          {/* 社会保険 */}
          <tr>
            <td className={tdLabel}>社会保険料個人負担</td>
            <td className={tdVal}>{fmtOrEmpty(curSocialIndividual)}</td>
            <td className={tdVal}>{fmtOrEmpty(aftSocialIndividual)}</td>
            <td className={tdVal}>{fmtDiff(aftSocialIndividual - curSocialIndividual)}</td>
          </tr>
          <tr>
            <td className={tdLabel}>社会保険料法人負担</td>
            <td className={tdVal}></td>
            <td className={tdVal}>{fmtOrEmpty(aftSocialEmployer)}</td>
            <td className={tdVal}>
              {fmtDiff(aftSocialEmployer)}
              {aftSocialEmployer > 0 && <span className="ml-1 text-[9px] text-gray-500">※従業員分含む</span>}
            </td>
          </tr>

          {/* 空行 */}
          <tr><td colSpan={4} className="border border-gray-300 h-2"></td></tr>

          {/* 社会保険合計 */}
          <tr className="bg-gray-50">
            <td className={tdBoldLabel}>社会保険料</td>
            <td className={tdBoldVal}>{fmtOrEmpty(curSocialTotal)}</td>
            <td className={tdBoldVal}>{fmtOrEmpty(aftSocialTotal)}</td>
            <td className={tdBoldVal}>{fmtDiff(aftSocialTotal - curSocialTotal)}</td>
          </tr>

          {/* 空行 */}
          <tr><td colSpan={4} className="border border-gray-300 h-2"></td></tr>

          {/* 税金・社会保険料負担 */}
          <tr className="bg-gray-100">
            <td className={tdBoldLabel}>税金・社会保険料負担</td>
            <td className={tdBoldVal}>{fmtOrEmpty(curBurden)}</td>
            <td className={tdBoldVal}>{fmtOrEmpty(aftBurden)}</td>
            <DiffTd value={aftBurden - curBurden} type="burden" />
          </tr>
          {/* 合算手取り額 */}
          <tr className="bg-gray-100">
            <td className={tdBoldLabel}>合算手取り額</td>
            <td className={tdBoldVal}>{fmtOrEmpty(curCombinedNet)}</td>
            <td className={tdBoldVal}>{fmtOrEmpty(aftCombinedNet)}</td>
            <DiffTd value={aftCombinedNet - curCombinedNet} type="income" />
          </tr>
          {/* 個人手取り額 */}
          <tr className="bg-blue-50">
            <td className={tdBoldLabel}>個人手取り額</td>
            <td className={tdBoldVal}>{fmtOrEmpty(curPersonalNet)}</td>
            <td className={tdBoldVal}>{fmtOrEmpty(aftPersonalNet)}</td>
            <DiffTd value={aftPersonalNet - curPersonalNet} type="income" />
          </tr>
          {/* 法人手取り額 */}
          <tr>
            <td className={tdBoldLabel}>法人手取り額</td>
            <td className={tdVal}></td>
            <td className={tdBoldVal}>{fmtOrEmpty(aftCorporateNet)}</td>
            <DiffTd value={aftCorporateNet - curCorporateNet} type="income" />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function IncreaseChart({
  label,
  individual,
  planResult,
}: {
  label: string;
  individual: ReturnType<typeof calcIndividual>;
  planResult: ReturnType<typeof calcPlan1>;
}) {
  const curNet = individual.netIncome;
  const combinedDiff = planResult.combinedNetIncome - curNet;
  const corporateDiff = planResult.corporateRetained;
  const personalDiff = planResult.ownerNetIncome - curNet;

  const data = [
    { name: "合算手取り額", value: combinedDiff },
    { name: "法人手取り額", value: corporateDiff },
    { name: "個人手取り額", value: personalDiff },
  ];

  const COLORS = ["#4472C4", "#ED7D31", "#A5A5A5"];

  return (
    <div className="border border-gray-300 bg-white p-3">
      <h4 className="text-xs font-bold text-center text-red-700 mb-2">
        法人成後手取り増減額（{label}）
      </h4>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 9 }} />
          <YAxis
            tickFormatter={(v: number) => v.toLocaleString()}
            tick={{ fontSize: 9 }}
          />
          <Tooltip formatter={(value) => (typeof value === "number" ? formatYen(value) : String(value))} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          <ReferenceLine y={0} stroke="#666" />
          <Bar dataKey="value" name="増減額">
            {data.map((_, idx) => (
              <Cell key={idx} fill={COLORS[idx]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function PlanBlock({
  title,
  individual,
  plan1Result,
  plan2Result,
}: {
  title: string;
  individual: ReturnType<typeof calcIndividual>;
  plan1Result: ReturnType<typeof calcPlan1>;
  plan2Result: ReturnType<typeof calcPlan2>;
}) {
  return (
    <div className="flex-1 min-w-[420px]">
      <div className="bg-yellow-50 border border-yellow-400 px-3 py-1 mb-2 text-sm font-bold">
        {title}
      </div>
      <div className="space-y-4">
        <div>
          <div className="text-xs font-bold text-gray-600 mb-1 pl-1">完全法人成り：</div>
          <PlanTable title="" individual={individual} planResult={plan2Result} />
          <div className="mt-2">
            <IncreaseChart label="完全法人成り" individual={individual} planResult={plan2Result} />
          </div>
        </div>
        <div>
          <div className="text-xs font-bold text-gray-600 mb-1 pl-1">マイクロ法人成り：</div>
          <PlanTable title="" individual={individual} planResult={plan1Result} />
          <div className="mt-2">
            <IncreaseChart label="マイクロ法人成り" individual={individual} planResult={plan1Result} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function HoukokushoSheet() {
  const { input, rates, decisionMeasures, reportPlan2Input, reportPlan2Rates, copyReportPlan1ToPlan2 } = useHojinnariStore(
    useShallow((s) => ({
      input: s.input,
      rates: s.rates,
      decisionMeasures: s.decisionMeasures,
      reportPlan2Input: s.reportPlan2Input,
      reportPlan2Rates: s.reportPlan2Rates,
      copyReportPlan1ToPlan2: s.copyReportPlan1ToPlan2,
    }))
  );

  // 決算対策の合計
  const decisionTotals = (decisionMeasures ?? []).reduce(
    (acc, m) => ({
      corporateExpense: acc.corporateExpense + m.corporateExpense,
      taxDeductible: acc.taxDeductible + m.taxDeductible,
      personalIncomeIncrease: acc.personalIncomeIncrease + m.personalIncomeIncrease,
      hiddenAssetIncrease: acc.hiddenAssetIncrease + m.hiddenAssetIncrease,
    }),
    { corporateExpense: 0, taxDeductible: 0, personalIncomeIncrease: 0, hiddenAssetIncrease: 0 }
  );
  const hasDecisionMeasures = decisionTotals.corporateExpense > 0 || decisionTotals.personalIncomeIncrease > 0 || decisionTotals.hiddenAssetIncrease > 0;

  // プラン1: 現在の入力値から計算
  const individual1 = calcIndividual(input);
  const plan1Micro = calcPlan1(input, rates);
  const plan1Full = calcPlan2(input, rates);

  // プラン2: スナップショットから計算（なければプラン1と同じ）
  const p2Input = reportPlan2Input ?? input;
  const p2Rates = reportPlan2Rates ?? rates;
  const individual2 = calcIndividual(p2Input);
  const plan2Micro = calcPlan1(p2Input, p2Rates);
  const plan2Full = calcPlan2(p2Input, p2Rates);

  return (
    <div className="p-4 space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center gap-4 bg-white rounded border p-3">
        <h2 className="font-bold text-sm">法人成りシミュレーション</h2>
        <Button
          size="sm"
          variant="outline"
          onClick={copyReportPlan1ToPlan2}
          className="text-xs"
        >
          プラン1をプラン2に転記
        </Button>
        <div className="text-xs text-gray-600 border border-gray-300 rounded px-2 py-1">
          ● 円単位
        </div>
      </div>

      {/* プラン1（左） / プラン2（右） */}
      <div className="flex gap-6 flex-wrap">
        <PlanBlock
          title="プラン1"
          individual={individual1}
          plan1Result={plan1Micro}
          plan2Result={plan1Full}
        />
        <PlanBlock
          title="プラン2"
          individual={individual2}
          plan1Result={plan2Micro}
          plan2Result={plan2Full}
        />
      </div>

      {/* 決算対策の効果 */}
      {hasDecisionMeasures && (
        <div className="bg-white rounded border p-4 space-y-3">
          <h3 className="font-bold text-sm border-b pb-2">法人成り後の決算対策の効果</h3>
          <div className="overflow-x-auto">
            <table className="w-full max-w-xl border-collapse text-[11px]">
              <thead>
                <tr>
                  <th className="py-1.5 px-2 text-left text-[11px] font-bold text-white bg-[#1f3f7a] border border-gray-400 w-36">項目</th>
                  <th className="py-1.5 px-2 text-right text-[11px] font-bold text-white bg-[#1f3f7a] border border-gray-400">法人支出額</th>
                  <th className="py-1.5 px-2 text-right text-[11px] font-bold text-white bg-[#1f3f7a] border border-gray-400">損金算入額</th>
                  <th className="py-1.5 px-2 text-right text-[11px] font-bold text-white bg-[#1f3f7a] border border-gray-400">個人手取り増加</th>
                  <th className="py-1.5 px-2 text-right text-[11px] font-bold text-white bg-[#1f3f7a] border border-gray-400">法人の簿外資産</th>
                </tr>
              </thead>
              <tbody>
                {(decisionMeasures ?? [])
                  .filter((m) => m.name || m.corporateExpense > 0)
                  .map((m, i) => (
                    <tr key={i} className="border-b">
                      <td className="py-1 px-2 text-[11px] border border-gray-300">{m.name || "—"}</td>
                      <td className="py-1 px-2 text-right text-[11px] font-mono border border-gray-300">{m.corporateExpense > 0 ? formatYen(m.corporateExpense) : ""}</td>
                      <td className="py-1 px-2 text-right text-[11px] font-mono border border-gray-300">{m.taxDeductible > 0 ? formatYen(m.taxDeductible) : ""}</td>
                      <td className="py-1 px-2 text-right text-[11px] font-mono border border-gray-300 text-blue-700">{m.personalIncomeIncrease > 0 ? formatYen(m.personalIncomeIncrease) : ""}</td>
                      <td className="py-1 px-2 text-right text-[11px] font-mono border border-gray-300">{m.hiddenAssetIncrease > 0 ? formatYen(m.hiddenAssetIncrease) : ""}</td>
                    </tr>
                  ))}
                <tr className="bg-gray-100">
                  <td className="py-1 px-2 text-[11px] font-bold border border-gray-300">合計</td>
                  <td className="py-1 px-2 text-right text-[11px] font-mono font-bold border border-gray-300">{decisionTotals.corporateExpense > 0 ? formatYen(decisionTotals.corporateExpense) : ""}</td>
                  <td className="py-1 px-2 text-right text-[11px] font-mono font-bold border border-gray-300">{decisionTotals.taxDeductible > 0 ? formatYen(decisionTotals.taxDeductible) : ""}</td>
                  <td className="py-1 px-2 text-right text-[11px] font-mono font-bold border border-gray-300 text-blue-700">{decisionTotals.personalIncomeIncrease > 0 ? formatYen(decisionTotals.personalIncomeIncrease) : ""}</td>
                  <td className="py-1 px-2 text-right text-[11px] font-mono font-bold border border-gray-300">{decisionTotals.hiddenAssetIncrease > 0 ? formatYen(decisionTotals.hiddenAssetIncrease) : ""}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
