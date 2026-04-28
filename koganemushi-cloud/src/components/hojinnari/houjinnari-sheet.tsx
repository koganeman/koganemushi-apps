"use client";

import { useState } from "react";
import { useHojinnariStore } from "@/stores/hojinnari-store";
import { useShallow } from "zustand/react/shallow";
import { formatYen, formatPercent, parsePercent } from "@/lib/format";
import { calcSocialInsuranceIncome, calcEmployeeInsuranceRate } from "@/lib/hojinnari-calc";
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

          <h3 className="text-xs font-semibold text-gray-500 uppercase pt-2">法人住民税</h3>
          <div className="space-y-2">
            <InputRow label="都道府県民税率① (標準)">
              <PercentInput value={rates.prefecturalTaxRate1} onChange={(v) => setRates({ prefecturalTaxRate1: v })} />
            </InputRow>
            <InputRow label="都道府県民税率② (超過・参考)">
              <PercentInput value={rates.prefecturalTaxRate2} onChange={(v) => setRates({ prefecturalTaxRate2: v })} />
            </InputRow>
            <InputRow label="市町村民税率">
              <PercentInput value={rates.municipalTaxRate} onChange={(v) => setRates({ municipalTaxRate: v })} />
            </InputRow>
            <InputRow label="均等割（年額）">
              <YenInput value={input.perCapitaLevy} onChange={(v) => setInput({ perCapitaLevy: v })} />
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

          <h3 className="text-xs font-semibold text-gray-500 uppercase pt-2">医療法人事業税</h3>
          <div className="space-y-2">
            <InputRow label="医療法人事業税率① (400万以下)">
              <PercentInput value={rates.medicalBusinessTaxRate1} onChange={(v) => setRates({ medicalBusinessTaxRate1: v })} />
            </InputRow>
            <InputRow label="医療法人事業税率② (400〜800万)">
              <PercentInput value={rates.medicalBusinessTaxRate2} onChange={(v) => setRates({ medicalBusinessTaxRate2: v })} />
            </InputRow>
            <InputRow label="医療法人事業税率③ (800万超)">
              <PercentInput value={rates.medicalBusinessTaxRate3} onChange={(v) => setRates({ medicalBusinessTaxRate3: v })} />
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
            <InputRow label="子ども・子育て支援金率（労使折半）">
              <PercentInput value={rates.childcareSupportRate} onChange={(v) => setRates({ childcareSupportRate: v })} />
            </InputRow>
            <InputRow label="子ども・子育て拠出金率（会社のみ）">
              <PercentInput value={rates.childcareContributionRate} onChange={(v) => setRates({ childcareContributionRate: v })} />
            </InputRow>
          </div>
        </div>

        {/* ---- PLAN1: 完全法人成り ---- */}
        <div className="bg-white rounded border p-4 space-y-3">
          <h2 className="font-bold text-sm border-b pb-2">PLAN1: 完全法人成り</h2>
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
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isNonExecutive"
                checked={input.isNonExecutive ?? true}
                onChange={(e) => setInput({ isNonExecutive: e.target.checked })}
                className="h-4 w-4"
              />
              <label htmlFor="isNonExecutive" className="text-sm text-gray-600">
                非常勤役員（他社給与を標準報酬に合算しない）
              </label>
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

        {/* ---- PLAN2: マイクロ法人成り ---- */}
        <div className="bg-white rounded border p-4 space-y-3">
          <h2 className="font-bold text-sm border-b pb-2">PLAN2: マイクロ法人成り</h2>
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

      {/* ---- 医療法人・従業員設定 ---- */}
      <div className="bg-white rounded border p-4 space-y-4">
        <h2 className="font-bold text-sm border-b pb-2">医療法人・従業員設定</h2>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* 医療法人 */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={input.isMedicalCorporation}
                onChange={(e) => setInput({ isMedicalCorporation: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="font-semibold">医療法人</span>
              <span className="text-xs text-gray-400">（チェックで医療法人用税率・社会保険分を適用）</span>
            </label>

            {input.isMedicalCorporation && (
              <div className="space-y-2 pl-4 border-l-2 border-blue-200">
                <InputRow label="社会保険分医業収入">
                  <YenInput
                    value={input.socialInsuranceMedicalRevenue}
                    onChange={(v) => setInput({ socialInsuranceMedicalRevenue: v })}
                  />
                </InputRow>
                <InputRow label="総収入金額">
                  <YenInput
                    value={input.totalRevenue}
                    onChange={(v) => setInput({ totalRevenue: v })}
                  />
                </InputRow>
                <div className="mt-1 p-2 bg-blue-50 rounded text-xs">
                  <span className="text-gray-600">社会保険分の所得金額（概算）：</span>
                  <span className="font-mono font-semibold">
                    {input.totalRevenue > 0
                      ? formatYen(calcSocialInsuranceIncome(
                          Math.max(0, input.businessIncome),
                          input.socialInsuranceMedicalRevenue,
                          input.totalRevenue
                        ))
                      : "—"}
                  </span>
                  <span className="text-gray-500 ml-1">円</span>
                  <p className="text-gray-400 mt-0.5">※法人所得確定後の値は報告書・最適化タブで確認できます</p>
                </div>
              </div>
            )}
          </div>

          {/* 従業員 */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">他に社員がいる場合</h3>
            <div className="space-y-2">
              <InputRow label="年間従業員給料額">
                <YenInput
                  value={input.employeeSalary}
                  onChange={(v) => setInput({ employeeSalary: v })}
                />
              </InputRow>
              <div className="grid grid-cols-2 gap-2 items-center text-xs text-gray-600">
                <span>従業員会社負担保険料率（自動計算）</span>
                <span className="text-right font-mono">{formatPercent(calcEmployeeInsuranceRate(rates))}%</span>
              </div>
              {input.employeeSalary > 0 && (
                <div className="p-2 bg-yellow-50 rounded text-xs">
                  <span className="text-gray-600">従業員会社負担分：</span>
                  <span className="font-mono font-semibold">
                    {formatYen(Math.floor(input.employeeSalary * calcEmployeeInsuranceRate(rates)))}
                  </span>
                  <span className="text-gray-500 ml-1">円</span>
                  {input.isMedicalCorporation && (
                    <p className="text-gray-400 mt-0.5">
                      ※業種別国保の場合は厚生年金分のみ。料率を適宜変更してください。
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ---- 業種別国保パターン ---- */}
        <div className="border-t pt-4 space-y-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={input.useIndustryInsurance}
              onChange={(e) => setInput({ useIndustryInsurance: e.target.checked })}
              className="w-4 h-4"
            />
            <span className="font-semibold">業種別国保（健康保険のみ国保固定額・厚生年金は加入）</span>
            <span className="text-xs text-gray-400">
              （チェック時、健康保険・介護保険・支援金は0、月額固定の業種別国保を個人負担に加算）
            </span>
          </label>

          {input.useIndustryInsurance && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 pl-4 border-l-2 border-blue-200">
              <InputRow label="事業主（役員）の業種別国保 月額">
                <YenInput
                  value={input.industryInsuranceMonthlyOwner}
                  onChange={(v) => setInput({ industryInsuranceMonthlyOwner: v })}
                />
              </InputRow>
              <InputRow label="配偶者の業種別国保 月額">
                <YenInput
                  value={input.industryInsuranceMonthlySpouse}
                  onChange={(v) => setInput({ industryInsuranceMonthlySpouse: v })}
                />
              </InputRow>
              <p className="xl:col-span-2 text-xs text-gray-500">
                ※年額換算 = 月額 × 12。配偶者は法人給与 &gt; 0 のときに加算されます。
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
