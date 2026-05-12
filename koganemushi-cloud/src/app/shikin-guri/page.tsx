"use client";

import { useRef } from "react";
import {
  useShikinGuriStore,
  type ShikinGuriTab,
} from "@/stores/shikin-guri-store";
import type { ShikinGuriExportData } from "@/types/shikin-guri";
import { PeriodConfigBar } from "@/components/shikin-guri/period-config-bar";
import { ConsistencyBanner } from "@/components/shikin-guri/consistency-banner";
import { CashflowTable } from "@/components/shikin-guri/cashflow-table";
import { AccountsTable } from "@/components/shikin-guri/accounts-table";

const TAB_LABELS: { id: ShikinGuriTab; label: string }[] = [
  { id: "cashflow", label: "資金繰り表" },
  { id: "accounts", label: "口座残高明細表" },
];

function timestampForFilename(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export default function ShikinGuriPage() {
  const activeTab = useShikinGuriStore((s) => s.activeTab);
  const setActiveTab = useShikinGuriStore((s) => s.setActiveTab);
  const loadFromJson = useShikinGuriStore((s) => s.loadFromJson);
  const resetAll = useShikinGuriStore((s) => s.resetAll);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const state = useShikinGuriStore.getState();
    const data: ShikinGuriExportData = {
      version: 1,
      period: state.period,
      cashflow: state.cashflow,
      accounts: state.accounts,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shikin-guri_${timestampForFilename()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) { return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = String(ev.target?.result ?? "");
        const data = JSON.parse(text) as ShikinGuriExportData;
        if (typeof data !== "object" || data === null) {
          alert("JSONの形式が不正です。");
          return;
        }
        loadFromJson(data);
        alert("インポートしました。");
      } catch (err) {
        alert(`インポートに失敗しました: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        if (fileInputRef.current) { fileInputRef.current.value = ""; }
      }
    };
    reader.readAsText(file);
  };

  const handleReset = () => {
    if (window.confirm("入力データを全てリセットして初期状態に戻します。よろしいですか？")) {
      resetAll();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* マニュアルリンク（URL は準備中） */}
      <div className="bg-white border-b px-6 py-2 text-sm">
        <a
          href="#"
          onClick={(e) => e.preventDefault()}
          title="マニュアルは準備中です"
          className="text-gray-400 cursor-not-allowed underline"
        >
          資金繰り表 操作マニュアル（準備中）
        </a>
      </div>

      {/* タブナビゲーション */}
      <div className="bg-white border-b px-6 flex items-center gap-0">
        {TAB_LABELS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-blue-600 text-blue-700 bg-blue-50"
                : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
        <div className="ml-auto pr-2 flex items-center gap-2">
          <button
            onClick={handleImportClick}
            className="text-xs border border-blue-500 text-blue-700 rounded px-3 py-1 hover:bg-blue-50 transition-colors"
            title="JSONファイルから入力データを読み込みます"
          >
            JSON インポート
          </button>
          <button
            onClick={handleExport}
            className="text-xs border border-green-500 text-green-700 rounded px-3 py-1 hover:bg-green-50 transition-colors"
            title="現在の入力データをJSONファイルに保存します"
          >
            JSON エクスポート
          </button>
          <button
            onClick={handleReset}
            className="text-xs border border-gray-400 text-gray-600 rounded px-3 py-1 hover:bg-gray-100 transition-colors"
            title="入力をすべてリセット"
          >
            リセット
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportFile}
            className="hidden"
          />
        </div>
      </div>

      <PeriodConfigBar />
      <ConsistencyBanner />

      <main className="max-w-[1800px] mx-auto">
        {activeTab === "cashflow" && <CashflowTable />}
        {activeTab === "accounts" && <AccountsTable />}
      </main>
    </div>
  );
}
