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
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

type DiffStyle = "favorable" | "unfavorable" | "neutral";

function diffStyle(v: number): DiffStyle {
  if (v > 0) { return "favorable"; }
  if (v < 0) { return "unfavorable"; }
  return "neutral";
}

function cellClass(style: DiffStyle): string {
  if (style === "favorable") { return "py-1 px-2 text-right text-xs font-mono border-r text-blue-700 font-bold"; }
  if (style === "unfavorable") { return "py-1 px-2 text-right text-xs font-mono border-r text-red-600 font-bold"; }
  return "py-1 px-2 text-right text-xs font-mono border-r text-gray-400";
}

function DiffCell({ value }: { value: number }) {
  const style = diffStyle(value);
  return (
    <td className={cellClass(style)}>
      <span>
        {value > 0 ? "+" : ""}
        {formatYen(value)}
      </span>
      {style === "favorable" && (
        <span className="ml-1 text-[10px] text-blue-500">▲有利</span>
      )}
      {style === "unfavorable" && (
        <span className="ml-1 text-[10px] text-red-400">▼不利</span>
      )}
    </td>
  );
}

function ReportRow({
  label,
  currentValue,
  afterValue,
  isBold = false,
  isSection = false,
  note,
}: {
  label: string;
  currentValue: number;
  afterValue: number;
  isBold?: boolean;
  isSection?: boolean;
  note?: string;
}) {
  if (isSection) {
    return (
      <tr>
        <td
          colSpan={4}
          className="py-1 px-2 text-xs font-bold text-white bg-gray-500"
        >
          {label}
        </td>
      </tr>
    );
  }
  const diff = afterValue - currentValue;
  return (
    <tr className={`border-b ${isBold ? "bg-gray-50 font-bold" : ""}`}>
      <td className="py-1 px-2 text-xs text-gray-700 border-r whitespace-nowrap">
        {label}
        {note && <span className="text-gray-400 ml-1 text-[10px]">{note}</span>}
      </td>
      <td className="py-1 px-2 text-right text-xs font-mono border-r">{formatYen(currentValue)}</td>
      <td className="py-1 px-2 text-right text-xs font-mono border-r">{formatYen(afterValue)}</td>
      <DiffCell value={diff} />
    </tr>
  );
}

function PlanTable({
  title,
  planColor,
  currentNetIncome,
  planResult,
}: {
  title: string;
  planColor: "blue" | "orange";
  currentNetIncome: number;
  planResult: ReturnType<typeof calcPlan1>;
}) {
  const colorClass = planColor === "blue" ? "bg-blue-600" : "bg-orange-500";

  const afterSocialIndividual = planResult.ownerSocialInsurance;
  const afterSocialEmployer = planResult.employerSocialInsurance;

  return (
    <div className="flex-1 min-w-0">
      <div className={`${colorClass} text-white text-xs font-bold px-3 py-1.5 rounded-t`}>
        {title}
      </div>
      <table className="w-full border-collapse text-xs border border-t-0">
        <thead>
          <tr className="bg-gray-100 border-b">
            <th className="py-1 px-2 text-left text-xs font-medium text-gray-500 border-r w-32">項目</th>
            <th className="py-1 px-2 text-right text-xs font-medium text-gray-500 border-r">現状</th>
            <th className="py-1 px-2 text-right text-xs font-medium text-gray-500 border-r">法人成り後</th>
            <th className="py-1 px-2 text-right text-xs font-medium text-gray-500">差引</th>
          </tr>
        </thead>
        <tbody>
          <ReportRow label="▼ 売上・所得" currentValue={0} afterValue={0} isSection />
          <ReportRow
            label="事業所得金額"
            currentValue={planResult.individualBusinessIncome}
            afterValue={planResult.individualBusinessIncome}
          />
          <ReportRow
            label="法人売上（移転分）"
            currentValue={0}
            afterValue={planResult.corporateRevenue}
          />
          <ReportRow
            label="法人所得金額"
            currentValue={0}
            afterValue={planResult.corporateIncome}
          />

          <ReportRow label="▼ 税金" currentValue={0} afterValue={0} isSection />
          <ReportRow
            label="法人税"
            currentValue={0}
            afterValue={planResult.corporateTax}
          />
          <ReportRow
            label="法人事業税"
            currentValue={0}
            afterValue={planResult.corporateBusinessTax}
          />
          <ReportRow
            label="個人所得税"
            currentValue={0}
            afterValue={planResult.individualIncomeTax}
          />
          <ReportRow
            label="個人住民税"
            currentValue={0}
            afterValue={planResult.individualResidentTax}
          />
          <ReportRow
            label="個人事業税"
            currentValue={0}
            afterValue={planResult.individualBusinessTax}
          />

          <ReportRow label="▼ 社会保険" currentValue={0} afterValue={0} isSection />
          <ReportRow
            label="社会保険料（個人負担）"
            currentValue={0}
            afterValue={afterSocialIndividual}
          />
          <ReportRow
            label="社会保険料（法人負担）"
            currentValue={0}
            afterValue={afterSocialEmployer}
            note="※法事業者分含"
          />
          <ReportRow
            label="社会保険料計"
            currentValue={0}
            afterValue={planResult.totalSocialInsurance}
            isBold
          />

          <ReportRow label="▼ 手取り" currentValue={0} afterValue={0} isSection />
          <ReportRow
            label="合算CF手取り額"
            currentValue={currentNetIncome}
            afterValue={planResult.combinedNetIncome}
            isBold
          />
          <ReportRow
            label="役員手取り額"
            currentValue={currentNetIncome}
            afterValue={planResult.ownerNetIncome}
          />
          <ReportRow
            label="法人手取り額（内部留保）"
            currentValue={0}
            afterValue={planResult.corporateRetained}
          />
        </tbody>
        <tfoot>
          <tr className="border-t-2 bg-gray-50">
            <td className="py-2 px-2 text-xs font-bold" colSpan={4}>
              合計手取り増減額:
              <span
                className={`ml-2 text-base font-bold ${
                  planResult.combinedNetIncome - currentNetIncome >= 0
                    ? "text-blue-700"
                    : "text-red-600"
                }`}
              >
                {planResult.combinedNetIncome - currentNetIncome >= 0 ? "+" : ""}
                {formatYen(planResult.combinedNetIncome - currentNetIncome)}
              </span>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function HoukokushoSheet() {
  const { input, rates, savePlan1AsPlan2 } = useHojinnariStore(
    useShallow((s) => ({
      input: s.input,
      rates: s.rates,
      savePlan1AsPlan2: s.savePlan1AsPlan2,
    }))
  );

  const individual = calcIndividual(input);
  const plan1Result = calcPlan1(input, rates);
  const plan2Result = calcPlan2(input, rates);

  const currentNetIncome = individual.netIncome;
  const p1Increase = plan1Result.combinedNetIncome - currentNetIncome;
  const p2Increase = plan2Result.combinedNetIncome - currentNetIncome;
  const p1vsp2 = p1Increase - p2Increase;

  // グラフデータ
  const chartData = [
    {
      name: "現状",
      合算手取り: currentNetIncome,
      役員手取り: currentNetIncome,
      法人手取り: 0,
    },
    {
      name: "PLAN1",
      合算手取り: plan1Result.combinedNetIncome,
      役員手取り: plan1Result.ownerNetIncome,
      法人手取り: plan1Result.corporateRetained,
    },
    {
      name: "PLAN2",
      合算手取り: plan2Result.combinedNetIncome,
      役員手取り: plan2Result.ownerNetIncome,
      法人手取り: plan2Result.corporateRetained,
    },
  ];

  const increaseData = [
    {
      name: "PLAN1\n増減額",
      増減額: p1Increase,
    },
    {
      name: "PLAN2\n増減額",
      増減額: p2Increase,
    },
  ];

  return (
    <div className="p-4 space-y-4">
      {/* ヘッダー操作 */}
      <div className="flex items-center gap-4 bg-white rounded border p-3">
        <h2 className="font-bold text-sm">法人なりシミュレーション 報告書</h2>
        <Button
          size="sm"
          variant="outline"
          onClick={savePlan1AsPlan2}
          className="text-xs"
        >
          PLAN1をPLAN2に転記して保存
        </Button>
        <span className="text-xs text-gray-400">
          事業所得: {formatYen(input.businessIncome)}
        </span>
      </div>

      {/* PLAN1 / PLAN2 並列表示 */}
      <div className="flex gap-4 flex-wrap xl:flex-nowrap">
        <PlanTable
          title={`PLAN1: マイクロ法人成り（移転 ${formatYen(input.plan1MicroRevenue)}・役員報酬 ${formatYen(input.plan1MicroSalary)}）`}
          planColor="blue"
          currentNetIncome={currentNetIncome}
          planResult={plan1Result}
        />
        <PlanTable
          title={`PLAN2: 完全法人成り（役員報酬 ${formatYen(input.plan2Salary)}）`}
          planColor="orange"
          currentNetIncome={currentNetIncome}
          planResult={plan2Result}
        />
      </div>

      {/* サマリー */}
      <div className="bg-white rounded border p-4">
        <h3 className="font-bold text-sm mb-3">合計手取り増減額の比較</h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="p-3 border rounded">
            <p className="text-xs text-gray-500">PLAN1 増減額</p>
            <p className={`text-xl font-bold ${p1Increase >= 0 ? "text-blue-700" : "text-red-600"}`}>
              {p1Increase >= 0 ? "+" : ""}{formatYen(p1Increase)}
            </p>
          </div>
          <div className="p-3 border rounded">
            <p className="text-xs text-gray-500">PLAN2 増減額</p>
            <p className={`text-xl font-bold ${p2Increase >= 0 ? "text-orange-600" : "text-red-600"}`}>
              {p2Increase >= 0 ? "+" : ""}{formatYen(p2Increase)}
            </p>
          </div>
          <div className="p-3 border rounded bg-gray-50">
            <p className="text-xs text-gray-500">P1-P2 差額</p>
            <p className={`text-xl font-bold ${p1vsp2 >= 0 ? "text-blue-700" : "text-orange-600"}`}>
              {p1vsp2 >= 0 ? "+" : ""}{formatYen(p1vsp2)}
            </p>
            <p className="text-xs text-gray-400">
              {p1vsp2 >= 0 ? "PLAN1が有利" : "PLAN2が有利"}
            </p>
          </div>
        </div>
      </div>

      {/* グラフ */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-white rounded border p-4">
          <h3 className="font-bold text-sm mb-3">手取り額の比較</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis
                tickFormatter={(v: number) => `${(v / 10000).toFixed(0)}万`}
                tick={{ fontSize: 10 }}
              />
              <Tooltip formatter={(value) => (typeof value === "number" ? formatYen(value) : String(value))} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="合算手取り" fill="#3b82f6" name="合算手取り額" />
              <Bar dataKey="役員手取り" fill="#f97316" name="役員手取り額" />
              <Bar dataKey="法人手取り" fill="#6b7280" name="法人手取り額" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded border p-4">
          <h3 className="font-bold text-sm mb-3">法人成後手取り増減額</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={increaseData} margin={{ top: 10, right: 10, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis
                tickFormatter={(v: number) => `${(v / 10000).toFixed(0)}万`}
                tick={{ fontSize: 10 }}
              />
              <Tooltip formatter={(value) => (typeof value === "number" ? formatYen(value) : String(value))} />
              <ReferenceLine y={0} stroke="#666" />
              <Bar
                dataKey="増減額"
                fill="#3b82f6"
                name="手取り増減額"
                label={{ position: "top", formatter: (v: unknown) => `${(Number(v) / 10000).toFixed(0)}万`, fontSize: 10 }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
