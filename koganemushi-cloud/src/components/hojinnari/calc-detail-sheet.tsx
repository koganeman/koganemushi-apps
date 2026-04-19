"use client";

import { Fragment } from "react";
import { useHojinnariStore } from "@/stores/hojinnari-store";
import { useShallow } from "zustand/react/shallow";
import { calcIndividual, calcPlan1, calcPlan2 } from "@/lib/hojinnari-calc";
import { formatYen } from "@/lib/format";
import type {
  TaxDetailBreakdown,
  CorpTaxDetailBreakdown,
  NetIncomeDetailBreakdown,
} from "@/types/hojinnari";

/* ── style constants ── */
const thCls =
  "py-1.5 px-2 text-right text-[11px] font-bold text-white bg-[#1f3f7a] border border-gray-400";
const thLabelCls = `${thCls} text-left`;
const sectionCls =
  "py-1 px-2 text-[11px] font-bold text-white bg-[#4472C4] border border-gray-400";
const tdLabel =
  "py-1 px-2 text-[11px] text-gray-700 border border-gray-300 whitespace-nowrap";
const tdVal =
  "py-1 px-2 text-right text-[11px] font-mono border border-gray-300";
const tdBoldLabel =
  "py-1 px-2 text-[11px] font-bold text-gray-700 border border-gray-300 whitespace-nowrap";
const tdBoldVal =
  "py-1 px-2 text-right text-[11px] font-mono font-bold border border-gray-300";

/* ── formatters ── */
function fmtYen(v: number): string {
  return v !== 0 ? formatYen(v) : "";
}

function fmtPercent(v: number): string {
  return v !== 0 ? (v * 100).toFixed(1) + "%" : "";
}

/* ── 1. Personal Tax Detail ── */

type TaxRow = {
  label: string;
  key: keyof TaxDetailBreakdown;
  bold?: boolean;
  format?: "yen" | "percent";
};

type TaxSection = {
  title: string;
  rows: TaxRow[];
};

const personalTaxSections: TaxSection[] = [
  {
    title: "▼ 収入・所得金額",
    rows: [
      { label: "事業所得（青色控除後）", key: "businessIncome" },
      { label: "給与収入", key: "salaryRevenue" },
      { label: "給与所得金額", key: "salaryAfterDeduction" },
      { label: "年金収入", key: "pensionRevenue" },
      { label: "年金雑所得", key: "pensionAfterDeduction" },
      { label: "他の所得金額", key: "otherIncome" },
      { label: "所得金額（合計）", key: "totalIncome", bold: true },
    ],
  },
  {
    title: "▼ 所得控除",
    rows: [
      { label: "社会保険料控除額", key: "socialInsuranceDeduction" },
      { label: "その他所得控除", key: "otherDeductions" },
      { label: "基礎控除", key: "basicDeduction" },
      { label: "所得控除合計", key: "totalDeductions", bold: true },
    ],
  },
  {
    title: "▼ 税金計算",
    rows: [
      { label: "課税所得金額", key: "taxableIncome", bold: true },
      { label: "適用税率", key: "incomeTaxRate", format: "percent" },
      { label: "税率控除額", key: "incomeTaxRateDeduction" },
      { label: "所得税額（基本）", key: "incomeTaxBase" },
      { label: "復興特別所得税（2.1%）", key: "incomeTaxRecovery" },
      { label: "所得税（100円未満切捨）", key: "incomeTax", bold: true },
      { label: "住民税（10%）", key: "residentTax", bold: true },
    ],
  },
  {
    title: "▼ 個人事業税",
    rows: [
      { label: "個人事業税", key: "individualBusinessTax" },
    ],
  },
];

function formatTaxValue(row: TaxRow, data: TaxDetailBreakdown): string {
  const v = data[row.key] as number;
  if (row.format === "percent") return fmtPercent(v);
  return fmtYen(v);
}

function PersonalTaxDetailTable({
  current,
  plan1,
  plan2,
}: {
  current: TaxDetailBreakdown;
  plan1: TaxDetailBreakdown;
  plan2: TaxDetailBreakdown;
}) {
  return (
    <div>
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr>
            <th className={thLabelCls} style={{ width: "180px" }}>
              個人所得税・住民税の計算明細
            </th>
            <th className={thCls}>現状</th>
            <th className={thCls}>Plan1（完全法人成り）</th>
            <th className={thCls}>Plan2（マイクロ法人）</th>
          </tr>
        </thead>
        <tbody>
          {personalTaxSections.map((section) => (
            <Fragment key={section.title}>
              <tr>
                <td colSpan={4} className={sectionCls}>
                  {section.title}
                </td>
              </tr>
              {section.rows.map((row) => {
                const labelCls = row.bold ? tdBoldLabel : tdLabel;
                const valCls = row.bold ? tdBoldVal : tdVal;
                return (
                  <tr key={row.key}>
                    <td className={labelCls}>{row.label}</td>
                    <td className={valCls}>{formatTaxValue(row, current)}</td>
                    <td className={valCls}>{formatTaxValue(row, plan2)}</td>
                    <td className={valCls}>{formatTaxValue(row, plan1)}</td>
                  </tr>
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── 2. Corp Tax Detail ── */

type CorpRow = {
  label: string;
  key: keyof CorpTaxDetailBreakdown;
  bold?: boolean;
  format?: "yen" | "string";
};

type CorpSection = {
  title: string;
  rows: CorpRow[];
};

const corpTaxSections: CorpSection[] = [
  {
    title: "▼ 法人所得",
    rows: [
      { label: "法人売上", key: "revenue" },
      { label: "役員報酬＋配偶者給与", key: "salaries" },
      { label: "社保会社負担", key: "employerSocialInsurance" },
      { label: "法人所得", key: "corporateIncome", bold: true },
    ],
  },
  {
    title: "▼ 法人税計算",
    rows: [
      { label: "適用区分", key: "corporateTaxRate", format: "string" },
      { label: "法人税額", key: "corporateTax", bold: true },
      { label: "法人事業税", key: "businessTax", bold: true },
    ],
  },
  {
    title: "▼ 内部留保",
    rows: [
      { label: "法人内部留保", key: "corporateRetained", bold: true },
    ],
  },
];

function formatCorpValue(row: CorpRow, data: CorpTaxDetailBreakdown): string {
  if (row.format === "string") return data[row.key] as string;
  const v = data[row.key] as number;
  return fmtYen(v);
}

function CorpTaxDetailTable({
  plan1,
  plan2,
}: {
  plan1: CorpTaxDetailBreakdown;
  plan2: CorpTaxDetailBreakdown;
}) {
  return (
    <div>
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr>
            <th className={thLabelCls} style={{ width: "180px" }}>
              法人税の計算明細
            </th>
            <th className={thCls}>Plan1（完全法人成り）</th>
            <th className={thCls}>Plan2（マイクロ法人）</th>
          </tr>
        </thead>
        <tbody>
          {corpTaxSections.map((section) => (
            <Fragment key={section.title}>
              <tr>
                <td colSpan={3} className={sectionCls}>
                  {section.title}
                </td>
              </tr>
              {section.rows.map((row) => {
                const labelCls = row.bold ? tdBoldLabel : tdLabel;
                const valCls = row.bold ? tdBoldVal : tdVal;
                return (
                  <tr key={row.key}>
                    <td className={labelCls}>{row.label}</td>
                    <td className={valCls}>{formatCorpValue(row, plan2)}</td>
                    <td className={valCls}>{formatCorpValue(row, plan1)}</td>
                  </tr>
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── 3. Net Income Detail ── */

type NetRow = {
  label: string;
  key: keyof NetIncomeDetailBreakdown;
  bold?: boolean;
};

type NetSection = {
  title: string;
  rows: NetRow[];
};

const netIncomeSections: NetSection[] = [
  {
    title: "▼ 収入合計",
    rows: [
      { label: "事業収入", key: "businessIncome" },
      { label: "給与収入", key: "salaryRevenue" },
      { label: "年金収入", key: "pensionRevenue" },
      { label: "他の所得", key: "otherIncome" },
      { label: "収入合計", key: "totalRevenue", bold: true },
    ],
  },
  {
    title: "▼ 控除項目",
    rows: [
      { label: "所得税", key: "incomeTax" },
      { label: "住民税", key: "residentTax" },
      { label: "個人事業税", key: "individualBusinessTax" },
      { label: "社会保険料", key: "socialInsurance" },
      { label: "控除合計", key: "totalDeductions", bold: true },
    ],
  },
  {
    title: "▼ 手取り額",
    rows: [
      { label: "手取り額", key: "netIncome", bold: true },
    ],
  },
];

function NetIncomeDetailTable({
  current,
  plan1,
  plan2,
}: {
  current: NetIncomeDetailBreakdown;
  plan1: NetIncomeDetailBreakdown;
  plan2: NetIncomeDetailBreakdown;
}) {
  return (
    <div>
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr>
            <th className={thLabelCls} style={{ width: "180px" }}>
              個人手取り額の計算明細
            </th>
            <th className={thCls}>現状</th>
            <th className={thCls}>Plan1（完全法人成り）</th>
            <th className={thCls}>Plan2（マイクロ法人）</th>
          </tr>
        </thead>
        <tbody>
          {netIncomeSections.map((section) => (
            <Fragment key={section.title}>
              <tr>
                <td colSpan={4} className={sectionCls}>
                  {section.title}
                </td>
              </tr>
              {section.rows.map((row) => {
                const labelCls = row.bold ? tdBoldLabel : tdLabel;
                const valCls = row.bold ? tdBoldVal : tdVal;
                const v = (d: NetIncomeDetailBreakdown) => fmtYen(d[row.key]);
                return (
                  <tr key={row.key}>
                    <td className={labelCls}>{row.label}</td>
                    <td className={valCls}>{v(current)}</td>
                    <td className={valCls}>{v(plan2)}</td>
                    <td className={valCls}>{v(plan1)}</td>
                  </tr>
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Main component ── */

export function CalcDetailSheet() {
  const { input, rates, taxYear } = useHojinnariStore(
    useShallow((s) => ({ input: s.input, rates: s.rates, taxYear: s.taxYear }))
  );

  const individual = calcIndividual(input, taxYear);
  const plan1 = calcPlan1(input, rates, taxYear);
  const plan2 = calcPlan2(input, rates, taxYear);

  return (
    <div className="p-4 space-y-6">
      <PersonalTaxDetailTable
        current={individual.taxDetail}
        plan1={plan1.taxDetail}
        plan2={plan2.taxDetail}
      />
      <CorpTaxDetailTable
        plan1={plan1.corpTaxDetail}
        plan2={plan2.corpTaxDetail}
      />
      <NetIncomeDetailTable
        current={individual.netIncomeDetail}
        plan1={plan1.netIncomeDetail}
        plan2={plan2.netIncomeDetail}
      />
    </div>
  );
}
