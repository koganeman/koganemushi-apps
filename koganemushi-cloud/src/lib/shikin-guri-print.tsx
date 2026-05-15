"use client";

import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { PrintCashflowSheet } from "@/components/shikin-guri/print-cashflow-sheet";
import { PrintAccountsSheet } from "@/components/shikin-guri/print-accounts-sheet";
import { PrintBalanceChartSheet } from "@/components/shikin-guri/print-balance-chart-sheet";
import { PrintKeijouChartSheet } from "@/components/shikin-guri/print-keijou-chart-sheet";
import { PrintBudgetActualSheet } from "@/components/shikin-guri/print-budget-actual-sheet";
import type {
  AccountRow,
  CashflowMatrix,
  MonthKey,
} from "@/types/shikin-guri";

export function chunkMonths(months: MonthKey[], chunkSize: number): MonthKey[][] {
  const out: MonthKey[][] = [];
  for (let i = 0; i < months.length; i += chunkSize) {
    out.push(months.slice(i, i + chunkSize));
  }
  return out;
}

interface RunPrintArgs {
  monthsList: MonthKey[][];
  renderPage: (months: MonthKey[], pageIndex: number) => React.ReactNode;
  /** 印刷時の document.title に使うASCII名（Chrome印刷プレビューの文字化け対策） */
  asciiKind: "Cashflow" | "Accounts" | "BalanceChart" | "BudgetActual";
}

async function runPrint({ monthsList, renderPage, asciiKind }: RunPrintArgs): Promise<void> {
  // 冪等性: 既存の印刷コンテナがあれば除去
  document.getElementById("print-container")?.remove();

  const container = document.createElement("div");
  container.id = "print-container";
  container.classList.add("shikin-print-container");
  document.body.appendChild(container);

  const roots: Root[] = [];
  const pages: HTMLDivElement[] = monthsList.map(() => {
    const page = document.createElement("div");
    page.className = "print-page print-content";
    container.appendChild(page);
    return page;
  });

  // 同期レンダーで全ページのDOMを確定させる
  flushSync(() => {
    pages.forEach((page, i) => {
      const root = createRoot(page);
      roots.push(root);
      root.render(renderPage(monthsList[i], i));
    });
  });

  // タブタイトルを ASCII 名に一時差し替え（Chrome 印刷プレビュー左上の文字化け回避＆PDF保存時のデフォルト名にも反映）
  const firstChunk = monthsList[0];
  const lastChunk = monthsList[monthsList.length - 1];
  const firstMonth = firstChunk[0];
  const lastMonth = lastChunk[lastChunk.length - 1];
  const printDocTitle = `${asciiKind}_${firstMonth}_${lastMonth}`;
  const originalTitle = document.title;
  document.title = printDocTitle;

  document.body.classList.add("printing");
  try {
    // レイアウト確定を待ってから印刷ダイアログを開く
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );
    window.print();
  } finally {
    document.body.classList.remove("printing");
    roots.forEach((r) => r.unmount());
    container.remove();
    document.title = originalTitle;
  }
}

export interface PrintCashflowOptions {
  monthsList: MonthKey[][];
  cashflow: CashflowMatrix;
  currentMonth: MonthKey;
}

export function printCashflow(opts: PrintCashflowOptions): Promise<void> {
  return runPrint({
    monthsList: opts.monthsList,
    asciiKind: "Cashflow",
    renderPage: (months) => (
      <PrintCashflowSheet
        months={months}
        cashflow={opts.cashflow}
        currentMonth={opts.currentMonth}
      />
    ),
  });
}

export interface PrintAccountsOptions {
  monthsList: MonthKey[][];
  accounts: AccountRow[];
  cashflow: CashflowMatrix;
  currentMonth: MonthKey;
}

export function printAccounts(opts: PrintAccountsOptions): Promise<void> {
  return runPrint({
    monthsList: opts.monthsList,
    asciiKind: "Accounts",
    renderPage: (months) => (
      <PrintAccountsSheet
        months={months}
        accounts={opts.accounts}
        cashflow={opts.cashflow}
        currentMonth={opts.currentMonth}
      />
    ),
  });
}

export interface PrintBudgetActualOptions {
  monthsList: MonthKey[][];
  budget: CashflowMatrix;
  cashflow: CashflowMatrix;
  currentMonth: MonthKey;
}

export function printBudgetActual(opts: PrintBudgetActualOptions): Promise<void> {
  return runPrint({
    monthsList: opts.monthsList,
    asciiKind: "BudgetActual",
    renderPage: (months) => (
      <PrintBudgetActualSheet
        months={months}
        budget={opts.budget}
        cashflow={opts.cashflow}
        currentMonth={opts.currentMonth}
      />
    ),
  });
}

export interface PrintBalanceChartOptions {
  months: MonthKey[];
  cashflow: CashflowMatrix;
  currentMonth: MonthKey;
}

export function printBalanceChart(opts: PrintBalanceChartOptions): Promise<void> {
  // 1ページ目=残高グラフ、2ページ目=経常収支グラフ
  return runPrint({
    monthsList: [opts.months, opts.months],
    asciiKind: "BalanceChart",
    renderPage: (months, pageIndex) =>
      pageIndex === 0 ? (
        <PrintBalanceChartSheet
          months={months}
          cashflow={opts.cashflow}
          currentMonth={opts.currentMonth}
        />
      ) : (
        <PrintKeijouChartSheet
          months={months}
          cashflow={opts.cashflow}
          currentMonth={opts.currentMonth}
        />
      ),
  });
}
