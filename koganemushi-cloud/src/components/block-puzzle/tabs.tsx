"use client";

export type ReportTabKey = "pl" | "bs" | "analysis" | "report";

interface Props {
  active: ReportTabKey;
  onChange: (next: ReportTabKey) => void;
}

const TABS: { key: ReportTabKey; label: string }[] = [
  { key: "pl", label: "P/L（損益）" },
  { key: "bs", label: "B/S（貸借対照表）" },
  { key: "analysis", label: "財務分析" },
  { key: "report", label: "経営レポート" },
];

export function ReportTabs({ active, onChange }: Props) {
  return (
    <div className="flex border-b border-gray-300 bp-print-hide">
      {TABS.map((t) => {
        const isActive = active === t.key;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className={
              isActive
                ? "px-4 py-2 text-sm font-semibold border-b-2 border-blue-600 text-blue-700"
                : "px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border-b-2 border-transparent"
            }
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
