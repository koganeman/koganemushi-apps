"use client";

import { useMemo, useState } from "react";
import { useShikinGuriStore } from "@/stores/shikin-guri-store";
import { calcTaxForecast } from "@/lib/tax-forecast-calc";
import { formatJpMonth } from "@/lib/shikin-guri-months";
import { DefenseTaxToggle } from "./defense-tax-toggle";
import { ConsumptionTaxInputTable } from "./consumption-tax-input-table";
import { CorporateTaxInputTable } from "./corporate-tax-input-table";
import { TaxRateTableView } from "./tax-rate-table-view";
import { TaxScheduleTable } from "./tax-schedule-table";

function FiscalPeriodBar() {
  const fp = useShikinGuriStore((s) => s.taxForecast.fiscalPeriod);
  const setFiscalPeriod = useShikinGuriStore((s) => s.setFiscalPeriod);
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="font-medium">第1期 決算月</span>
      <input
        type="number"
        value={fp.closingYear}
        onChange={(e) =>
          setFiscalPeriod({ closingYear: parseInt(e.target.value, 10) || 0 })
        }
        className="border border-gray-300 rounded px-2 py-1 w-24 text-sm"
        aria-label="第1期 決算年"
      />
      <span>年</span>
      <select
        value={fp.closingMonth}
        onChange={(e) =>
          setFiscalPeriod({ closingMonth: parseInt(e.target.value, 10) })
        }
        className="border border-gray-300 rounded px-2 py-1 text-sm"
        aria-label="第1期 決算月"
      >
        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
          <option key={m} value={m}>
            {m}月
          </option>
        ))}
      </select>
      <span className="text-xs text-gray-500">
        （第2・3期は +12ヶ月で自動算出）
      </span>
    </div>
  );
}

function TaxTranscriptionFooter() {
  const currentMonth = useShikinGuriStore((s) => s.period.currentMonth);
  const appliedAt = useShikinGuriStore(
    (s) => s.appliedTaxTranscription.appliedAt
  );
  const applyTaxTranscription = useShikinGuriStore(
    (s) => s.applyTaxTranscription
  );
  const clearTaxTranscription = useShikinGuriStore(
    (s) => s.clearTaxTranscription
  );

  const [excludeActuals, setExcludeActuals] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const handleApply = () => {
    if (appliedAt) {
      const ok = window.confirm(
        `前回転記（${new Date(appliedAt).toLocaleString()}）の内容を` +
          `差し替えます。よろしいですか？`
      );
      if (!ok) {
        return;
      }
    }
    applyTaxTranscription(excludeActuals ? currentMonth : null);
    setMessage("資金繰り予定表へ転記しました。");
  };

  const handleClear = () => {
    if (!window.confirm("転記を取消し、加算分を資金繰り表から差し戻します。")) {
      return;
    }
    clearTaxTranscription();
    setMessage("転記を取消しました。");
  };

  return (
    <div className="border-t bg-blue-50/40 px-6 py-3 flex flex-wrap items-center gap-3 text-sm">
      <label className="flex items-center gap-1">
        <input
          type="checkbox"
          checked={excludeActuals}
          onChange={(e) => {
            setExcludeActuals(e.target.checked);
            setMessage(null);
          }}
        />
        実績月（{formatJpMonth(currentMonth)} 以前）を除外
      </label>
      <button
        type="button"
        onClick={handleApply}
        className="bg-blue-600 text-white rounded px-3 py-1.5 hover:bg-blue-700"
      >
        資金繰り予定表に加算転記
      </button>
      <button
        type="button"
        onClick={handleClear}
        disabled={!appliedAt}
        className="border border-gray-400 text-gray-700 rounded px-3 py-1.5 hover:bg-gray-50 disabled:opacity-40"
      >
        転記を取消
      </button>
      {appliedAt && (
        <span className="text-xs text-gray-500">
          前回転記: {new Date(appliedAt).toLocaleString()}
        </span>
      )}
      {message && (
        <span className="text-green-700 text-xs font-medium">{message}</span>
      )}
    </div>
  );
}

export function TaxForecastPanel() {
  const taxForecast = useShikinGuriStore((s) => s.taxForecast);
  const result = useMemo(() => calcTaxForecast(taxForecast), [taxForecast]);

  return (
    <div className="pb-10">
      <div className="px-6 py-4 space-y-4">
        <FiscalPeriodBar />
        <DefenseTaxToggle
          periodApplied={result.periods.map((p) => p.defenseApplied)}
        />
        <div className="flex flex-wrap gap-8">
          <ConsumptionTaxInputTable result={result} />
          <CorporateTaxInputTable result={result} />
        </div>
        <TaxRateTableView />
        <TaxScheduleTable result={result} />
      </div>
      <TaxTranscriptionFooter />
    </div>
  );
}
