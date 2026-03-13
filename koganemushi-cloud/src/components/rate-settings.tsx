"use client";

import type { RateSettings, CorporateTaxParams } from "@/types/simulation";
import { Input } from "@/components/ui/input";
import { formatPercent, parsePercent, formatYen, parseYen } from "@/lib/format";

interface RateSettingsProps {
  rates: RateSettings;
  corporateTaxParams: CorporateTaxParams;
  onRatesChange: (rates: RateSettings) => void;
  onCorporateTaxParamsChange: (params: CorporateTaxParams) => void;
}

function PercentInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-sm whitespace-nowrap w-40">{label}</label>
      <Input
        type="text"
        className="w-24 text-right h-8 text-sm"
        defaultValue={formatPercent(value)}
        onBlur={(e) => onChange(parsePercent(e.target.value))}
      />
      <span className="text-sm text-muted-foreground">%</span>
    </div>
  );
}

function YenInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-sm whitespace-nowrap w-40">{label}</label>
      <Input
        type="text"
        className="w-36 text-right h-8 text-sm"
        defaultValue={value > 0 ? formatYen(value) : ""}
        onBlur={(e) => onChange(parseYen(e.target.value))}
      />
      <span className="text-sm text-muted-foreground">円</span>
    </div>
  );
}

export function RateSettingsPanel({
  rates,
  corporateTaxParams,
  onRatesChange,
  onCorporateTaxParamsChange,
}: RateSettingsProps) {
  const updateRate = (key: keyof RateSettings, value: number) => {
    onRatesChange({ ...rates, [key]: value });
  };

  const updateCorp = (key: keyof CorporateTaxParams, value: number) => {
    onCorporateTaxParamsChange({ ...corporateTaxParams, [key]: value });
  };

  return (
    <div className="flex flex-wrap gap-x-12 gap-y-3 p-4 bg-slate-50 border rounded-lg">
      <div className="space-y-2">
        <h3 className="text-sm font-bold mb-2">料率設定</h3>
        <PercentInput
          label="健康保険料率"
          value={rates.healthInsuranceRate}
          onChange={(v) => updateRate("healthInsuranceRate", v)}
        />
        <PercentInput
          label="介護保険料率"
          value={rates.nursingCareRate}
          onChange={(v) => updateRate("nursingCareRate", v)}
        />
        <PercentInput
          label="厚生年金保険料率"
          value={rates.pensionRate}
          onChange={(v) => updateRate("pensionRate", v)}
        />
        <PercentInput
          label="子ども・子育て拠出金率"
          value={rates.childcareContributionRate}
          onChange={(v) => updateRate("childcareContributionRate", v)}
        />
      </div>
      <div className="space-y-2">
        <h3 className="text-sm font-bold mb-2">上限額</h3>
        <YenInput
          label="健保 標準賞与額上限(年)"
          value={rates.healthBonusAnnualCap}
          onChange={(v) => updateRate("healthBonusAnnualCap", v)}
        />
        <YenInput
          label="厚年 標準賞与額上限(月)"
          value={rates.pensionBonusPerPaymentCap}
          onChange={(v) => updateRate("pensionBonusPerPaymentCap", v)}
        />
      </div>
      <div className="space-y-2">
        <h3 className="text-sm font-bold mb-2">法人税パラメータ</h3>
        <YenInput
          label="役員報酬支払前法人所得"
          value={corporateTaxParams.preTaxCorporateIncome}
          onChange={(v) => updateCorp("preTaxCorporateIncome", v)}
        />
        <YenInput
          label="均等割"
          value={corporateTaxParams.perCapitaLevy}
          onChange={(v) => updateCorp("perCapitaLevy", v)}
        />
        <YenInput
          label="繰越欠損金"
          value={corporateTaxParams.carryForwardLoss}
          onChange={(v) => updateCorp("carryForwardLoss", v)}
        />
      </div>
    </div>
  );
}
