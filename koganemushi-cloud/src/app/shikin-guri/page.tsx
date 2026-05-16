"use client";

import { useRef, useState } from "react";
import {
  useShikinGuriStore,
  PERIOD_LENGTH_MONTHS,
  type ShikinGuriTab,
} from "@/stores/shikin-guri-store";
import type { MonthKey, ShikinGuriExportData } from "@/types/shikin-guri";
import { PeriodConfigBar } from "@/components/shikin-guri/period-config-bar";
import { ConsistencyBanner } from "@/components/shikin-guri/consistency-banner";
import { CashflowTable } from "@/components/shikin-guri/cashflow-table";
import { AccountsTable } from "@/components/shikin-guri/accounts-table";
import { BalanceChartView } from "@/components/shikin-guri/balance-chart-view";
import { KeijouChartView } from "@/components/shikin-guri/keijou-chart-view";
import { BudgetActualTable } from "@/components/shikin-guri/budget-actual-table";
import { LedgerImportPanel } from "@/components/shikin-guri/ledger-import-panel";
import { PrintMonthPickerDialog } from "@/components/shikin-guri/print-month-picker-dialog";
import { enumerateMonths } from "@/lib/shikin-guri-months";
import {
  chunkMonths,
  printAccounts,
  printBalanceChart,
  printBudgetActual,
  printCashflow,
} from "@/lib/shikin-guri-print";

const TAB_LABELS: { id: ShikinGuriTab; label: string }[] = [
  { id: "ledger", label: "実績取込" },
  { id: "cashflow", label: "資金繰り表" },
  { id: "accounts", label: "口座残高明細表" },
  { id: "chart", label: "残高グラフ" },
  { id: "budget", label: "予実対比表" },
];

function printAllTitle(tab: ShikinGuriTab): string {
  if (tab === "chart") {
    return "残高グラフをA4横2ページで印刷／PDF出力";
  }
  if (tab === "budget") {
    return "予実対比表を全期間（36ヶ月＝6ヶ月×6ページ）で印刷／PDF出力";
  }
  const name = tab === "cashflow" ? "資金繰り表" : "口座残高明細表";
  return `${name}を全期間（36ヶ月＝12ヶ月×3ページ）で印刷／PDF出力`;
}

function printAllLabel(tab: ShikinGuriTab): string {
  if (tab === "chart") {
    return "グラフ印刷";
  }
  return tab === "budget" ? "全期間印刷 (6ページ)" : "全期間印刷 (3ページ)";
}

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
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  const runPrint = (monthsList: MonthKey[][]) => {
    const state = useShikinGuriStore.getState();
    if (state.activeTab === "cashflow") {
      void printCashflow({
        monthsList,
        cashflow: state.cashflow,
        currentMonth: state.period.currentMonth,
      });
    } else if (state.activeTab === "accounts") {
      void printAccounts({
        monthsList,
        accounts: state.accounts,
        cashflow: state.cashflow,
        currentMonth: state.period.currentMonth,
      });
    } else if (state.activeTab === "budget") {
      if (!state.budget) {
        window.alert("先に「予実対比表」タブで予算を確定してください。");
        return;
      }
      // 各月3列で密になるため 6ヶ月／ページに分割
      void printBudgetActual({
        monthsList: chunkMonths(monthsList.flat(), 6),
        budget: state.budget,
        cashflow: state.cashflow,
        currentMonth: state.period.currentMonth,
      });
    }
  };

  const handlePrintAll = () => {
    const state = useShikinGuriStore.getState();
    const all = enumerateMonths(state.period.startMonth, PERIOD_LENGTH_MONTHS);
    if (state.activeTab === "chart") {
      void printBalanceChart({
        months: all,
        cashflow: state.cashflow,
        currentMonth: state.period.currentMonth,
      });
      return;
    }
    runPrint(chunkMonths(all, 12));
  };

  const handlePrint12Confirm = (selectedStart: MonthKey) => {
    setShowMonthPicker(false);
    runPrint([enumerateMonths(selectedStart, 12)]);
  };

  const handleExport = () => {
    const state = useShikinGuriStore.getState();
    const data: ShikinGuriExportData = {
      version: 1,
      period: state.period,
      cashflow: state.cashflow,
      accounts: state.accounts,
      meisai: state.meisai,
      budget: state.budget,
      budgetSnapshotAt: state.budgetSnapshotAt,
      learnedRules: state.learnedRules,
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
            onClick={handlePrintAll}
            disabled={activeTab === "ledger"}
            className="text-xs border border-indigo-500 text-indigo-700 rounded px-3 py-1 hover:bg-indigo-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            title={printAllTitle(activeTab)}
          >
            {printAllLabel(activeTab)}
          </button>
          <button
            onClick={() => setShowMonthPicker(true)}
            disabled={activeTab === "chart" || activeTab === "ledger"}
            className="text-xs border border-indigo-500 text-indigo-700 rounded px-3 py-1 hover:bg-indigo-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            title={
              activeTab === "chart"
                ? "残高グラフは全期間印刷のみ対応しています"
                : "開始月を選んで12ヶ月分だけ印刷／PDF出力"
            }
          >
            12ヶ月分だけ印刷…
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

      <main>
        {activeTab === "cashflow" && <CashflowTable />}
        {activeTab === "accounts" && <AccountsTable />}
        {activeTab === "chart" && (
          <>
            <BalanceChartView />
            <KeijouChartView />
          </>
        )}
        {activeTab === "budget" && <BudgetActualTable />}
        {activeTab === "ledger" && <LedgerImportPanel />}
      </main>

      {showMonthPicker && (
        <PrintMonthPickerDialog
          onCancel={() => setShowMonthPicker(false)}
          onConfirm={handlePrint12Confirm}
        />
      )}
    </div>
  );
}
