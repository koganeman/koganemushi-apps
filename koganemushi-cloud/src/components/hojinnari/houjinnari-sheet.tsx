"use client";

import { useHojinnariStore } from "@/stores/hojinnari-store";
import { useShallow } from "zustand/react/shallow";
import { calcHojinnari } from "@/lib/hojinnari-calc";
import { formatYen, formatPercent, parsePercent } from "@/lib/format";
import { Input } from "@/components/ui/input";

function PercentInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <Input
      className="w-28 text-right"
      value={formatPercent(value)}
      onChange={(e) => onChange(parsePercent(e.target.value))}
    />
  );
}

function DetailRow({ label, value }: { label: string; value: number }) {
  return (
    <tr className="border-b last:border-0">
      <td className="py-1.5 pr-4 text-sm text-gray-600">{label}</td>
      <td className="py-1.5 text-right text-sm font-mono">{formatYen(value)}</td>
    </tr>
  );
}

export function HoujinnariSheet() {
  const { input, rates, setRates } = useHojinnariStore(
    useShallow((s) => ({ input: s.input, rates: s.rates, setRates: s.setRates }))
  );

  const { corporate } = calcHojinnari(input, rates);

  return (
    <div className="p-4 space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 税率設定 */}
        <div className="bg-white rounded-lg border p-4 space-y-4">
          <h2 className="font-bold text-base border-b pb-2">法人税率・事業税率の設定</h2>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">法人税</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <label className="flex items-center text-gray-600">法人税率① （800万以下）</label>
              <PercentInput
                value={rates.corporateTaxRate1}
                onChange={(v) => setRates({ corporateTaxRate1: v })}
              />
              <label className="flex items-center text-gray-600">法人税率② （800万超）</label>
              <PercentInput
                value={rates.corporateTaxRate2}
                onChange={(v) => setRates({ corporateTaxRate2: v })}
              />
              <label className="flex items-center text-gray-600">地方法人特別税率</label>
              <PercentInput
                value={rates.localCorpTaxRate}
                onChange={(v) => setRates({ localCorpTaxRate: v })}
              />
            </div>

            <h3 className="text-sm font-semibold text-gray-700 pt-2">法人事業税</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <label className="flex items-center text-gray-600">事業税率① （400万以下）</label>
              <PercentInput
                value={rates.businessTaxRate1}
                onChange={(v) => setRates({ businessTaxRate1: v })}
              />
              <label className="flex items-center text-gray-600">事業税率② （400〜800万）</label>
              <PercentInput
                value={rates.businessTaxRate2}
                onChange={(v) => setRates({ businessTaxRate2: v })}
              />
              <label className="flex items-center text-gray-600">事業税率③ （800万超）</label>
              <PercentInput
                value={rates.businessTaxRate3}
                onChange={(v) => setRates({ businessTaxRate3: v })}
              />
              <label className="flex items-center text-gray-600">地方特別税率</label>
              <PercentInput
                value={rates.localBusinessTaxRate}
                onChange={(v) => setRates({ localBusinessTaxRate: v })}
              />
            </div>

            <h3 className="text-sm font-semibold text-gray-700 pt-2">社会保険料率（役員）</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <label className="flex items-center text-gray-600">健康保険料率</label>
              <PercentInput
                value={rates.healthInsuranceRate}
                onChange={(v) => setRates({ healthInsuranceRate: v })}
              />
              <label className="flex items-center text-gray-600">介護保険料率</label>
              <PercentInput
                value={rates.nursingCareRate}
                onChange={(v) => setRates({ nursingCareRate: v })}
              />
              <label className="flex items-center text-gray-600">厚生年金保険料率</label>
              <PercentInput
                value={rates.pensionRate}
                onChange={(v) => setRates({ pensionRate: v })}
              />
            </div>
          </div>
        </div>

        {/* 法人側詳細 */}
        <div className="bg-white rounded-lg border p-4 space-y-4">
          <h2 className="font-bold text-base border-b pb-2">法人側 計算詳細</h2>
          <table className="w-full">
            <tbody>
              <DetailRow label="法人所得" value={corporate.corporateIncome} />
              <DetailRow label="法人税" value={corporate.corporateTax} />
              <DetailRow label="法人事業税" value={corporate.businessTax} />
              <DetailRow label="法人内部留保" value={corporate.corporateRetained} />
              <tr className="border-b">
                <td className="py-1.5 text-xs text-gray-400 italic" colSpan={2}>役員</td>
              </tr>
              <DetailRow label="役員給与" value={corporate.ownerSalary} />
              <DetailRow label="給与所得控除後" value={corporate.ownerSalaryAfterDeduction} />
              <DetailRow label="社会保険料（役員負担）" value={corporate.ownerSocialInsurance} />
              <DetailRow label="基礎控除" value={corporate.ownerBasicDeduction} />
              <DetailRow label="課税所得" value={corporate.ownerTaxableIncome} />
              <DetailRow label="所得税" value={corporate.ownerIncomeTax} />
              <DetailRow label="住民税" value={corporate.ownerResidentTax} />
              <DetailRow label="役員手取り" value={corporate.ownerNetIncome} />
            </tbody>
            <tfoot>
              <tr className="border-t-2 font-bold">
                <td className="py-2 text-sm">手取り合計（役員＋内部留保）</td>
                <td className="py-2 text-right font-mono">{formatYen(corporate.totalNetIncome)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
