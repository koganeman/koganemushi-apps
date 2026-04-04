"use client";

import { useState } from "react";
import { useHojinnariStore } from "@/stores/hojinnari-store";
import { useShallow } from "zustand/react/shallow";
import { formatYen, formatPercent, parsePercent } from "@/lib/format";
import { Input } from "@/components/ui/input";

function YenInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [focused, setFocused] = useState(false);
  let displayValue = "";
  if (focused) {
    displayValue = value === 0 ? "" : String(value);
  } else {
    displayValue = value === 0 ? "" : formatYen(value);
  }
  return (
    <Input
      className="w-full text-right text-sm h-8"
      value={displayValue}
      onChange={(e) => {
        const str = e.target.value.replace(/[^\d]/g, "");
        onChange(str === "" ? 0 : parseInt(str, 10));
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholder="0"
    />
  );
}

function PercentInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [focused, setFocused] = useState(false);
  const [localText, setLocalText] = useState("");

  const displayValue = focused
    ? localText
    : formatPercent(value) + "%";

  return (
    <Input
      className="w-28 text-right text-sm h-8"
      value={displayValue}
      onChange={(e) => {
        const str = e.target.value.replace(/[^0-9.]/g, "");
        setLocalText(str);
        const num = parseFloat(str);
        if (!isNaN(num)) {
          onChange(num / 100);
        }
      }}
      onFocus={() => {
        setLocalText(value === 0 ? "" : (value * 100).toString());
        setFocused(true);
      }}
      onBlur={() => {
        setFocused(false);
        const num = parseFloat(localText);
        onChange(isNaN(num) ? 0 : num / 100);
      }}
      placeholder="0.00%"
    />
  );
}

function InputRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-2 items-center">
      <label className="text-sm text-gray-600">{label}</label>
      <div>{children}</div>
    </div>
  );
}

export function HoujinnariSheet() {
  const { input, rates, setInput, setRates } = useHojinnariStore(
    useShallow((s) => ({
      input: s.input,
      rates: s.rates,
      setInput: s.setInput,
      setRates: s.setRates,
    }))
  );

  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* ---- 税率設定 ---- */}
        <div className="bg-white rounded border p-4 space-y-3">
          <h2 className="font-bold text-sm border-b pb-2">税率設定</h2>

          <h3 className="text-xs font-semibold text-gray-500 uppercase">法人税</h3>
          <div className="space-y-2">
            <InputRow label="法人税率① (800万以下)">
              <PercentInput value={rates.corporateTaxRate1} onChange={(v) => setRates({ corporateTaxRate1: v })} />
            </InputRow>
            <InputRow label="法人税率② (800万超)">
              <PercentInput value={rates.corporateTaxRate2} onChange={(v) => setRates({ corporateTaxRate2: v })} />
            </InputRow>
            <InputRow label="地方法人特別税率">
              <PercentInput value={rates.localCorpTaxRate} onChange={(v) => setRates({ localCorpTaxRate: v })} />
            </InputRow>
          </div>

          <h3 className="text-xs font-semibold text-gray-500 uppercase pt-2">法人事業税</h3>
          <div className="space-y-2">
            <InputRow label="事業税率① (400万以下)">
              <PercentInput value={rates.businessTaxRate1} onChange={(v) => setRates({ businessTaxRate1: v })} />
            </InputRow>
            <InputRow label="事業税率② (400〜800万)">
              <PercentInput value={rates.businessTaxRate2} onChange={(v) => setRates({ businessTaxRate2: v })} />
            </InputRow>
            <InputRow label="事業税率③ (800万超)">
              <PercentInput value={rates.businessTaxRate3} onChange={(v) => setRates({ businessTaxRate3: v })} />
            </InputRow>
            <InputRow label="地方特別税率">
              <PercentInput
                value={rates.localBusinessTaxRate}
                onChange={(v) => setRates({ localBusinessTaxRate: v })}
              />
            </InputRow>
          </div>

          <h3 className="text-xs font-semibold text-gray-500 uppercase pt-2">社会保険料率（役員）</h3>
          <div className="space-y-2">
            <InputRow label="健康保険料率">
              <PercentInput value={rates.healthInsuranceRate} onChange={(v) => setRates({ healthInsuranceRate: v })} />
            </InputRow>
            <InputRow label="介護保険料率">
              <PercentInput value={rates.nursingCareRate} onChange={(v) => setRates({ nursingCareRate: v })} />
            </InputRow>
            <InputRow label="厚生年金保険料率">
              <PercentInput value={rates.pensionRate} onChange={(v) => setRates({ pensionRate: v })} />
            </InputRow>
          </div>
        </div>

        {/* ---- 完全法人成り ---- */}
        <div className="bg-white rounded border p-4 space-y-3">
          <h2 className="font-bold text-sm border-b pb-2">完全法人成り</h2>
          <p className="text-xs text-gray-500">
            全ての事業を法人化し、役員報酬として受け取るプラン
          </p>

          <div className="space-y-3">
            <div>
              <label className="text-sm text-gray-600 block mb-1">役員報酬（年額）</label>
              <YenInput
                value={input.plan2Salary}
                onChange={(v) => setInput({ plan2Salary: v })}
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 block mb-1">配偶者への給与（年額）</label>
              <YenInput
                value={input.plan2SpouseSalary}
                onChange={(v) => setInput({ plan2SpouseSalary: v })}
              />
            </div>
          </div>

          <div className="mt-4 p-3 bg-blue-50 rounded text-xs text-gray-600 space-y-1">
            <p className="font-semibold text-blue-800">完全法人成りの概要</p>
            <div className="grid grid-cols-2 gap-1">
              <span>法人売上（全額）:</span>
              <span className="text-right font-mono">{formatYen(input.businessIncome)}</span>
              <span>役員報酬:</span>
              <span className="text-right font-mono">{formatYen(input.plan2Salary)}</span>
              <span>配偶者給与:</span>
              <span className="text-right font-mono">{formatYen(input.plan2SpouseSalary)}</span>
            </div>
          </div>
        </div>

        {/* ---- マイクロ法人成り ---- */}
        <div className="bg-white rounded border p-4 space-y-3">
          <h2 className="font-bold text-sm border-b pb-2">マイクロ法人成り</h2>
          <p className="text-xs text-gray-500">
            個人事業の一部を別法人に移転し、残りは個人事業として継続するプラン
          </p>

          <div className="space-y-3">
            <div>
              <label className="text-sm text-gray-600 block mb-1">法人に移転する売上（年額）</label>
              <YenInput
                value={input.plan1MicroRevenue}
                onChange={(v) => setInput({ plan1MicroRevenue: v })}
              />
              {input.businessIncome > 0 && (
                <p className="text-xs text-gray-400 mt-0.5">
                  個人側残余: {formatYen(Math.max(0, input.businessIncome - input.plan1MicroRevenue))}
                </p>
              )}
            </div>
            <div>
              <label className="text-sm text-gray-600 block mb-1">マイクロ法人からの役員報酬（年額）</label>
              <YenInput
                value={input.plan1MicroSalary}
                onChange={(v) => setInput({ plan1MicroSalary: v })}
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 block mb-1">配偶者への法人給与（年額）</label>
              <YenInput
                value={input.plan1SpouseSalary}
                onChange={(v) => setInput({ plan1SpouseSalary: v })}
              />
            </div>
          </div>

          <div className="mt-4 p-3 bg-orange-50 rounded text-xs text-gray-600 space-y-1">
            <p className="font-semibold text-orange-800">マイクロ法人成りの概要</p>
            <div className="grid grid-cols-2 gap-1">
              <span>移転売上:</span>
              <span className="text-right font-mono">{formatYen(input.plan1MicroRevenue)}</span>
              <span>役員報酬:</span>
              <span className="text-right font-mono">{formatYen(input.plan1MicroSalary)}</span>
              <span>配偶者給与:</span>
              <span className="text-right font-mono">{formatYen(input.plan1SpouseSalary)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
