"use client";

import type { TaxYear } from "@/lib/tax-tables";

const TAX_YEAR_OPTIONS: { value: TaxYear; label: string }[] = [
  { value: "R7", label: "令和7年分" },
  { value: "R8", label: "令和8年分" },
  { value: "R9", label: "令和9年分" },
];

export function TaxYearSelector({
  value,
  onChange,
}: {
  value: TaxYear;
  onChange: (v: TaxYear) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="font-medium">適用年分:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as TaxYear)}
        className="border rounded px-2 py-1 text-sm bg-white"
      >
        {TAX_YEAR_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
