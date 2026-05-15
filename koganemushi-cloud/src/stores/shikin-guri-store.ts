import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  AccountRow,
  CashflowMatrix,
  CopyColumnOptions,
  MeisaiRow,
  MonthKey,
  PeriodConfig,
  ShikinGuriExportData,
} from "@/types/shikin-guri";
import { currentMonthKey, addMonths } from "@/lib/shikin-guri-months";
import type {
  CashflowCsvImportResult,
  AccountCsvImportResult,
  MeisaiCsvImportResult,
} from "@/lib/shikin-guri-csv";

export const PERIOD_LENGTH_MONTHS = 36;

export type ShikinGuriTab = "cashflow" | "accounts" | "chart" | "budget";

/** CashflowMatrix を深くコピー（cells はネストするので行ごとに複製） */
function cloneCashflow(src: CashflowMatrix): CashflowMatrix {
  const cells: Record<string, Record<MonthKey, number>> = {};
  for (const [subjectId, row] of Object.entries(src.cells)) {
    cells[subjectId] = { ...row };
  }
  return { openingBalance: src.openingBalance, cells };
}

function defaultPeriod(): PeriodConfig {
  const current = currentMonthKey();
  // 開始月は当月の23ヶ月前（実績12〜18ヶ月 + 予測18〜24ヶ月を想定）
  const start = addMonths(current, -23);
  return { startMonth: start, currentMonth: current };
}

function makeId(): string {
  return `acc_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

interface ShikinGuriState {
  period: PeriodConfig;
  activeTab: ShikinGuriTab;
  cashflow: CashflowMatrix;
  accounts: AccountRow[];
  meisai: MeisaiRow[];
  /** 予実対比用の予算（予測）スナップショット。未取得は null */
  budget: CashflowMatrix | null;
  /** 予算スナップショット取得日時（ISO文字列）。未取得は null */
  budgetSnapshotAt: string | null;

  setPeriod: (partial: Partial<PeriodConfig>) => void;
  setActiveTab: (tab: ShikinGuriTab) => void;

  /** 現在の資金繰り表を予算として保存（予実対比の「予定」） */
  captureBudgetSnapshot: () => void;
  /** 予算スナップショットを破棄 */
  clearBudgetSnapshot: () => void;

  setOpeningBalance: (value: number) => void;
  setCashflowCell: (subjectId: string, month: MonthKey, value: number) => void;

  addAccount: (name?: string) => void;
  removeAccount: (id: string) => void;
  renameAccount: (id: string, name: string) => void;
  setAccountBalance: (id: string, month: MonthKey, value: number) => void;

  /** CSV取込: 月キーの集合に対してセル値を上書き、空のものは0扱いで明示的に上書き */
  importCashflowCsv: (
    result: CashflowCsvImportResult,
    options: { applyOpeningBalance: boolean }
  ) => void;

  importAccountsCsv: (
    result: AccountCsvImportResult,
    mode: "replace" | "merge" | "append"
  ) => void;

  /** 明細表CSV取込: 既存の明細データを全て置き換える */
  importMeisaiCsv: (result: MeisaiCsvImportResult) => void;

  applyCopyColumn: (options: CopyColumnOptions) => void;

  loadFromJson: (data: ShikinGuriExportData) => void;
  resetAll: () => void;
}

function defaultCashflow(): CashflowMatrix {
  return { openingBalance: 0, cells: {} };
}

function defaultAccounts(): AccountRow[] {
  return [{ id: makeId(), name: "", balances: {} }];
}

export const useShikinGuriStore = create<ShikinGuriState>()(
  persist(
    (set) => ({
      period: defaultPeriod(),
      activeTab: "cashflow",
      cashflow: defaultCashflow(),
      accounts: defaultAccounts(),
      meisai: [],
      budget: null,
      budgetSnapshotAt: null,

      setPeriod: (partial) =>
        set((state) => ({ period: { ...state.period, ...partial } })),

      setActiveTab: (activeTab) => set({ activeTab }),

      captureBudgetSnapshot: () =>
        set((state) => ({
          budget: cloneCashflow(state.cashflow),
          budgetSnapshotAt: new Date().toISOString(),
        })),

      clearBudgetSnapshot: () => set({ budget: null, budgetSnapshotAt: null }),

      setOpeningBalance: (value) =>
        set((state) => ({ cashflow: { ...state.cashflow, openingBalance: value } })),

      setCashflowCell: (subjectId, month, value) =>
        set((state) => {
          const prev = state.cashflow.cells[subjectId] ?? {};
          const nextRow = { ...prev, [month]: value };
          return {
            cashflow: {
              ...state.cashflow,
              cells: { ...state.cashflow.cells, [subjectId]: nextRow },
            },
          };
        }),

      addAccount: (name = "") =>
        set((state) => ({
          accounts: [...state.accounts, { id: makeId(), name, balances: {} }],
        })),

      removeAccount: (id) =>
        set((state) => ({ accounts: state.accounts.filter((a) => a.id !== id) })),

      renameAccount: (id, name) =>
        set((state) => ({
          accounts: state.accounts.map((a) => (a.id === id ? { ...a, name } : a)),
        })),

      setAccountBalance: (id, month, value) =>
        set((state) => ({
          accounts: state.accounts.map((a) =>
            a.id === id ? { ...a, balances: { ...a.balances, [month]: value } } : a
          ),
        })),

      importCashflowCsv: (result, options) =>
        set((state) => {
          const newCells = { ...state.cashflow.cells };
          for (const [subjectId, row] of Object.entries(result.cellsBySubject)) {
            const prev = newCells[subjectId] ?? {};
            newCells[subjectId] = { ...prev, ...row };
          }
          const opening =
            options.applyOpeningBalance && result.openingBalanceCandidate !== null
              ? result.openingBalanceCandidate
              : state.cashflow.openingBalance;
          return {
            cashflow: { openingBalance: opening, cells: newCells },
          };
        }),

      importAccountsCsv: (result, mode) =>
        set((state) => {
          if (mode === "replace") {
            return {
              accounts: result.accounts.map((a) => ({
                id: makeId(),
                name: a.name,
                balances: { ...a.balances },
              })),
            };
          }
          if (mode === "append") {
            const newOnes: AccountRow[] = result.accounts.map((a) => ({
              id: makeId(),
              name: a.name,
              balances: { ...a.balances },
            }));
            // 既存の空1行は捨てる
            const filtered = state.accounts.filter(
              (a) => a.name !== "" || Object.keys(a.balances).length > 0
            );
            return { accounts: [...filtered, ...newOnes] };
          }
          // merge: 名前一致でマージ。未一致は追加。
          const byName: Record<string, AccountRow> = {};
          for (const a of state.accounts) {
            if (a.name) { byName[a.name] = a; }
          }
          const updated: AccountRow[] = [...state.accounts];
          for (const incoming of result.accounts) {
            if (byName[incoming.name]) {
              const existing = byName[incoming.name];
              const idx = updated.findIndex((x) => x.id === existing.id);
              if (idx >= 0) {
                updated[idx] = {
                  ...existing,
                  balances: { ...existing.balances, ...incoming.balances },
                };
              }
            } else {
              updated.push({
                id: makeId(),
                name: incoming.name,
                balances: { ...incoming.balances },
              });
            }
          }
          return { accounts: updated };
        }),

      importMeisaiCsv: (result) =>
        set(() => ({ meisai: result.rows })),

      applyCopyColumn: (options) =>
        set((state) => {
          const newCells = { ...state.cashflow.cells };
          for (const subjectId of options.subjectIds) {
            const prev = newCells[subjectId] ?? {};
            const sourceValue = prev[options.sourceMonth] ?? 0;
            const nextRow = { ...prev };
            for (const month of options.targetMonths) {
              const existing = prev[month];
              if (!options.overwriteExisting && existing !== undefined && existing !== 0) {
                continue;
              }
              nextRow[month] = sourceValue;
            }
            newCells[subjectId] = nextRow;
          }
          return { cashflow: { ...state.cashflow, cells: newCells } };
        }),

      loadFromJson: (data) =>
        set(() => ({
          period: data.period ?? defaultPeriod(),
          cashflow: data.cashflow
            ? {
                openingBalance: data.cashflow.openingBalance ?? 0,
                cells: data.cashflow.cells ?? {},
              }
            : defaultCashflow(),
          accounts:
            data.accounts && data.accounts.length > 0
              ? data.accounts.map((a) => ({
                  id: a.id ?? makeId(),
                  name: a.name ?? "",
                  balances: { ...(a.balances ?? {}) },
                }))
              : defaultAccounts(),
          meisai: data.meisai ?? [],
          budget: data.budget ?? null,
          budgetSnapshotAt: data.budgetSnapshotAt ?? null,
        })),

      resetAll: () =>
        set(() => ({
          period: defaultPeriod(),
          activeTab: "cashflow",
          cashflow: defaultCashflow(),
          accounts: defaultAccounts(),
          meisai: [],
          budget: null,
          budgetSnapshotAt: null,
        })),
    }),
    {
      name: "koganemushi-shikin-guri-v1",
      partialize: (state) => ({
        period: state.period,
        cashflow: state.cashflow,
        accounts: state.accounts,
        meisai: state.meisai,
        budget: state.budget,
        budgetSnapshotAt: state.budgetSnapshotAt,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<ShikinGuriState>;
        return {
          ...current,
          ...p,
          period: { ...current.period, ...(p.period ?? {}) },
          cashflow: {
            openingBalance: p.cashflow?.openingBalance ?? current.cashflow.openingBalance,
            cells: p.cashflow?.cells ?? current.cashflow.cells,
          },
          accounts: p.accounts ?? current.accounts,
          meisai: p.meisai ?? current.meisai,
          budget: p.budget ?? current.budget,
          budgetSnapshotAt: p.budgetSnapshotAt ?? current.budgetSnapshotAt,
        };
      },
    }
  )
);
