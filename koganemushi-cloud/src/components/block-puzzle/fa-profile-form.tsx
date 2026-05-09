"use client";

import { Input } from "@/components/ui/input";
import type { CompanyProfile } from "@/types/financial-analysis";
import {
  findGroupCodeBySubCode,
  listIndustryGroups,
} from "@/lib/financial-analysis-bench";
import { formatYen, parseYen } from "@/lib/format";

interface Props {
  profile: CompanyProfile;
  periodLabels: string[]; // 5期分の期ラベル
  onUpdateField: <K extends keyof CompanyProfile>(field: K, value: CompanyProfile[K]) => void;
  onUpdateEmployees: (index: number, value: number | null) => void;
}

export function FAProfileForm({
  profile,
  periodLabels,
  onUpdateField,
  onUpdateEmployees,
}: Props) {
  const groups = listIndustryGroups();

  const handleSubChange = (subCode: string) => {
    onUpdateField("industrySubCode", subCode);
    const groupCode = findGroupCodeBySubCode(subCode);
    onUpdateField("industryGroupCode", groupCode ?? "");
  };

  return (
    <section className="bg-white border rounded-lg p-4 space-y-3">
      <h3 className="text-sm font-bold text-gray-700">会社情報</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="block font-medium mb-1">業種</span>
          <select
            value={profile.industrySubCode}
            onChange={(e) => handleSubChange(e.target.value)}
            className="w-full border rounded px-2 py-1 bg-white"
          >
            <option value="">— 業種を選択 —</option>
            {groups.map((g) => (
              <optgroup key={g.code} label={`${g.code}_${g.name}`}>
                {g.subs.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.code}_{s.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="block font-medium mb-1">資本金（円）</span>
          <Input
            type="text"
            inputMode="numeric"
            value={formatYen(profile.capitalYen)}
            onChange={(e) => onUpdateField("capitalYen", parseYen(e.target.value))}
            placeholder="例: 10,000,000"
          />
        </label>
      </div>

      <div>
        <div className="block font-medium mb-1 text-sm">従業員数（人、各期末）</div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {periodLabels.map((label, i) => (
            <label key={i} className="block text-xs">
              <span className="block text-gray-600">{label || `第${5 - i}期`}</span>
              <Input
                type="text"
                inputMode="numeric"
                value={profile.employeeCounts[i] === null ? "" : String(profile.employeeCounts[i])}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^\d]/g, "");
                  onUpdateEmployees(i, v === "" ? null : Number(v));
                }}
                placeholder="-"
              />
            </label>
          ))}
        </div>
      </div>
    </section>
  );
}
