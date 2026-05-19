import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  AccountRow,
  AppliedTaxTranscription,
  CashflowMatrix,
  ConsumptionTaxInput,
  CopyColumnOptions,
  CorporateTaxInput,
  DefenseTaxMode,
  FiscalPeriodConfig,
  MeisaiForecastRow,
  MeisaiForecastState,
  MeisaiRow,
  MonthKey,
  PeriodConfig,
  ShikinGuriExportData,
  TaxForecastState,
} from "@/types/shikin-guri";
import { currentMonthKey, addMonths } from "@/lib/shikin-guri-months";
import {
  calcTaxForecast,
  computeTranscriptionCells,
  emptyAppliedTaxTranscription,
  revertTranscriptionCells,
} from "@/lib/tax-forecast-calc";
import type {
  CashflowCsvImportResult,
  AccountCsvImportResult,
  MeisaiCsvImportResult,
} from "@/lib/shikin-guri-csv";
import type {
  CpDescAssignments,
  DescriptionOverrides,
  LearnedRules,
  OffsetKeys,
  ParsedLedger,
  SubjectMappingEntry,
} from "@/types/general-ledger";

export const PERIOD_LENGTH_MONTHS = 36;

/**
 * 実績取込（総勘定元帳CSV）の作業状態。
 * タブ切替で消えないようストアに保持（localStorage には永続化しない＝再読込では消える）。
 */
export interface LedgerWorkState {
  parsed: ParsedLedger;
  mapping: SubjectMappingEntry[];
  overrides: DescriptionOverrides;
  cpDescAssignments: CpDescAssignments;
  /** 消込確定キー（科目＋金額） */
  offsetKeys: OffsetKeys;
  accountsCsv: AccountCsvImportResult | null;
}

export type ShikinGuriTab =
  | "cashflow"
  | "accounts"
  | "chart"
  | "budget"
  | "tax"
  | "ledger";

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
  /** 明細（全月）の予測入力（各科目の試算） */
  meisaiForecast: MeisaiForecastState;
  /** 納税予定タブの入力 */
  taxForecast: TaxForecastState;
  /** 納税予定の資金繰り表転記スナップショット（冪等転記用） */
  appliedTaxTranscription: AppliedTaxTranscription;
  /** 予実対比用の予算（予測）スナップショット。未取得は null */
  budget: CashflowMatrix | null;
  /** 予算スナップショット取得日時（ISO文字列）。未取得は null */
  budgetSnapshotAt: string | null;

  /** 実績取込の作業状態。未読込は null（タブ切替で保持） */
  ledgerWork: LedgerWorkState | null;
  /** 実績取込画面のロック（ON時は新規読込・クリアを抑止） */
  ledgerLocked: boolean;
  /** 科目割当の学習ルール（localStorage永続・次回取込で自動適用） */
  learnedRules: LearnedRules;

  setPeriod: (partial: Partial<PeriodConfig>) => void;
  setActiveTab: (tab: ShikinGuriTab) => void;

  /** 実績取込の作業状態を丸ごと設定（null でクリア） */
  setLedgerWork: (work: LedgerWorkState | null) => void;
  /** 実績取込の作業状態を部分更新（未読込時は無視） */
  patchLedgerWork: (patch: Partial<LedgerWorkState>) => void;
  /** 実績取込画面のロック切替 */
  setLedgerLocked: (locked: boolean) => void;

  /** 相手勘定科目→科目 を学習（null=除外） */
  learnCp: (counterpartyAccount: string, subjectId: string | null) => void;
  /** cpDescKey→科目 を学習（null=除外） */
  learnCpDesc: (key: string, subjectId: string | null) => void;
  /** 相手勘定科目の学習を削除 */
  unlearnCp: (counterpartyAccount: string) => void;
  /** cpDescKey の学習を削除 */
  unlearnCpDesc: (key: string) => void;
  /** 学習ルールを全削除 */
  clearLearnedRules: () => void;
  /** 学習ルールを丸ごと設定（JSON取込用） */
  setLearnedRules: (rules: LearnedRules) => void;

  /** 現在の資金繰り表を予算として保存（予実対比の「予定」） */
  captureBudgetSnapshot: () => void;
  /** 予算スナップショットを破棄 */
  clearBudgetSnapshot: () => void;

  setOpeningBalance: (value: number) => void;
  setCashflowCell: (subjectId: string, month: MonthKey, value: number) => void;

  /** 予測入力: 明細行/追加行の予測値を設定 */
  setMeisaiForecastValue: (
    subjectId: string,
    rowKey: string,
    value: number
  ) => void;
  /** 予測入力: 追加行を1行作成 */
  addMeisaiForecastRow: (subjectId: string) => void;
  /** 予測入力: 追加行の摘要/値を更新 */
  updateMeisaiForecastRow: (
    subjectId: string,
    id: string,
    patch: Partial<Pick<MeisaiForecastRow, "description" | "value">>
  ) => void;
  /** 予測入力: 追加行を削除 */
  removeMeisaiForecastRow: (subjectId: string, id: string) => void;

  /** 納税予定: 1期目決算月を設定 */
  setFiscalPeriod: (partial: Partial<FiscalPeriodConfig>) => void;
  /** 納税予定: 消費税概算入力を部分更新（期 index 0-2） */
  setConsumptionTaxInput: (
    periodIndex: 0 | 1 | 2,
    patch: Partial<ConsumptionTaxInput>
  ) => void;
  /** 納税予定: 法人税概算入力を部分更新（期 index 0-2） */
  setCorporateTaxInput: (
    periodIndex: 0 | 1 | 2,
    patch: Partial<CorporateTaxInput>
  ) => void;
  /** 納税予定: 防衛特別法人税モード切替 */
  setDefenseTaxMode: (mode: DefenseTaxMode) => void;
  /** 納税予定: 源泉所得税(納期特例) 手入力 */
  setWithholdingTax: (month: MonthKey, value: number) => void;
  /** 納税予定: 資金繰り表へ冪等加算転記（excludeBefore より前の月は除外） */
  applyTaxTranscription: (excludeBefore?: MonthKey | null) => void;
  /** 納税予定: 転記を取消（前回適用分を引き戻す） */
  clearTaxTranscription: () => void;

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

function defaultLearnedRules(): LearnedRules {
  return { version: 1, cp: {}, cpDesc: {} };
}

function defaultCashflow(): CashflowMatrix {
  return { openingBalance: 0, cells: {} };
}

function defaultMeisaiForecast(): MeisaiForecastState {
  return { values: {}, addedRows: {} };
}

function defaultConsumptionTaxInput(): ConsumptionTaxInput {
  return {
    preTaxProfit: 0,
    officerCompensation: 0,
    otherSalary: 0,
    legalWelfare: 0,
    depreciation: 0,
    insurance: 0,
    interestPaid: 0,
    otherNonTaxablePurchase: 0,
    interestReceived: 0,
    dividendReceived: 0,
    otherNonTaxableSales: 0,
    prepaidTax: 0,
  };
}

function defaultCorporateTaxInput(): CorporateTaxInput {
  return {
    carryForwardLoss: 0,
    prevBusinessTaxDeduction: 0,
    prevBusinessTaxDeductionManual: false,
    perCapitaLevy: 70000,
    prepaidTax: 0,
  };
}

function defaultTaxForecast(): TaxForecastState {
  const { year, month } = (() => {
    const m = /^(\d{4})-(\d{2})$/.exec(currentMonthKey());
    return m
      ? { year: parseInt(m[1], 10), month: parseInt(m[2], 10) }
      : { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };
  })();
  return {
    fiscalPeriod: { closingYear: year, closingMonth: month },
    consumptionTax: [
      defaultConsumptionTaxInput(),
      defaultConsumptionTaxInput(),
      defaultConsumptionTaxInput(),
    ],
    corporateTax: [
      defaultCorporateTaxInput(),
      defaultCorporateTaxInput(),
      defaultCorporateTaxInput(),
    ],
    defenseTaxMode: "auto",
    withholdingTax: {},
  };
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
      meisaiForecast: defaultMeisaiForecast(),
      taxForecast: defaultTaxForecast(),
      appliedTaxTranscription: emptyAppliedTaxTranscription(),
      budget: null,
      budgetSnapshotAt: null,
      ledgerWork: null,
      ledgerLocked: false,
      learnedRules: defaultLearnedRules(),

      setPeriod: (partial) =>
        set((state) => ({ period: { ...state.period, ...partial } })),

      setActiveTab: (activeTab) => set({ activeTab }),

      setLedgerWork: (ledgerWork) => set({ ledgerWork }),

      patchLedgerWork: (patch) =>
        set((state) =>
          state.ledgerWork
            ? { ledgerWork: { ...state.ledgerWork, ...patch } }
            : {}
        ),

      setLedgerLocked: (ledgerLocked) => set({ ledgerLocked }),

      learnCp: (cp, subjectId) =>
        set((state) => ({
          learnedRules: {
            ...state.learnedRules,
            cp: { ...state.learnedRules.cp, [cp]: subjectId },
          },
        })),

      learnCpDesc: (key, subjectId) =>
        set((state) => ({
          learnedRules: {
            ...state.learnedRules,
            cpDesc: { ...state.learnedRules.cpDesc, [key]: subjectId },
          },
        })),

      unlearnCp: (cp) =>
        set((state) => {
          const next = { ...state.learnedRules.cp };
          delete next[cp];
          return {
            learnedRules: { ...state.learnedRules, cp: next },
          };
        }),

      unlearnCpDesc: (key) =>
        set((state) => {
          const next = { ...state.learnedRules.cpDesc };
          delete next[key];
          return {
            learnedRules: { ...state.learnedRules, cpDesc: next },
          };
        }),

      clearLearnedRules: () => set({ learnedRules: defaultLearnedRules() }),

      setLearnedRules: (learnedRules) => set({ learnedRules }),

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

      setMeisaiForecastValue: (subjectId, rowKey, value) =>
        set((state) => {
          const prev = state.meisaiForecast.values[subjectId] ?? {};
          return {
            meisaiForecast: {
              ...state.meisaiForecast,
              values: {
                ...state.meisaiForecast.values,
                [subjectId]: { ...prev, [rowKey]: value },
              },
            },
          };
        }),

      addMeisaiForecastRow: (subjectId) =>
        set((state) => {
          const prev = state.meisaiForecast.addedRows[subjectId] ?? [];
          const row: MeisaiForecastRow = {
            id: makeId(),
            description: "",
            value: 0,
          };
          return {
            meisaiForecast: {
              ...state.meisaiForecast,
              addedRows: {
                ...state.meisaiForecast.addedRows,
                [subjectId]: [...prev, row],
              },
            },
          };
        }),

      updateMeisaiForecastRow: (subjectId, id, patch) =>
        set((state) => {
          const prev = state.meisaiForecast.addedRows[subjectId] ?? [];
          return {
            meisaiForecast: {
              ...state.meisaiForecast,
              addedRows: {
                ...state.meisaiForecast.addedRows,
                [subjectId]: prev.map((r) =>
                  r.id === id ? { ...r, ...patch } : r
                ),
              },
            },
          };
        }),

      removeMeisaiForecastRow: (subjectId, id) =>
        set((state) => {
          const prevRows = state.meisaiForecast.addedRows[subjectId] ?? [];
          const nextValues = { ...(state.meisaiForecast.values[subjectId] ?? {}) };
          delete nextValues[id];
          return {
            meisaiForecast: {
              values: {
                ...state.meisaiForecast.values,
                [subjectId]: nextValues,
              },
              addedRows: {
                ...state.meisaiForecast.addedRows,
                [subjectId]: prevRows.filter((r) => r.id !== id),
              },
            },
          };
        }),

      setFiscalPeriod: (partial) =>
        set((state) => ({
          taxForecast: {
            ...state.taxForecast,
            fiscalPeriod: { ...state.taxForecast.fiscalPeriod, ...partial },
          },
        })),

      setConsumptionTaxInput: (periodIndex, patch) =>
        set((state) => {
          const next = [...state.taxForecast.consumptionTax] as
            TaxForecastState["consumptionTax"];
          next[periodIndex] = { ...next[periodIndex], ...patch };
          return {
            taxForecast: { ...state.taxForecast, consumptionTax: next },
          };
        }),

      setCorporateTaxInput: (periodIndex, patch) =>
        set((state) => {
          const next = [...state.taxForecast.corporateTax] as
            TaxForecastState["corporateTax"];
          next[periodIndex] = { ...next[periodIndex], ...patch };
          return {
            taxForecast: { ...state.taxForecast, corporateTax: next },
          };
        }),

      setDefenseTaxMode: (defenseTaxMode) =>
        set((state) => ({
          taxForecast: { ...state.taxForecast, defenseTaxMode },
        })),

      setWithholdingTax: (month, value) =>
        set((state) => ({
          taxForecast: {
            ...state.taxForecast,
            withholdingTax: {
              ...state.taxForecast.withholdingTax,
              [month]: value,
            },
          },
        })),

      applyTaxTranscription: (excludeBefore = null) =>
        set((state) => {
          const { schedule } = calcTaxForecast(state.taxForecast);
          const rows = excludeBefore
            ? schedule.filter((r) => r.month > excludeBefore)
            : schedule;
          const { cells, nextDeltas } = computeTranscriptionCells(
            state.cashflow.cells,
            state.appliedTaxTranscription.deltas,
            rows
          );
          return {
            cashflow: { ...state.cashflow, cells },
            appliedTaxTranscription: {
              appliedAt: new Date().toISOString(),
              deltas: nextDeltas,
            },
          };
        }),

      clearTaxTranscription: () =>
        set((state) => {
          const cells = revertTranscriptionCells(
            state.cashflow.cells,
            state.appliedTaxTranscription.deltas
          );
          return {
            cashflow: { ...state.cashflow, cells },
            appliedTaxTranscription: emptyAppliedTaxTranscription(),
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
          meisaiForecast: data.meisaiForecast ?? defaultMeisaiForecast(),
          taxForecast: data.taxForecast ?? defaultTaxForecast(),
          appliedTaxTranscription:
            data.appliedTaxTranscription ?? emptyAppliedTaxTranscription(),
          budget: data.budget ?? null,
          budgetSnapshotAt: data.budgetSnapshotAt ?? null,
          learnedRules: data.learnedRules ?? defaultLearnedRules(),
        })),

      resetAll: () =>
        set((state) => ({
          period: defaultPeriod(),
          activeTab: "cashflow",
          cashflow: defaultCashflow(),
          accounts: defaultAccounts(),
          meisai: [],
          meisaiForecast: defaultMeisaiForecast(),
          taxForecast: defaultTaxForecast(),
          appliedTaxTranscription: emptyAppliedTaxTranscription(),
          budget: null,
          budgetSnapshotAt: null,
          // ロック中は実績取込の作業状態を保持
          ledgerWork: state.ledgerLocked ? state.ledgerWork : null,
          ledgerLocked: state.ledgerLocked,
        })),
    }),
    {
      name: "koganemushi-shikin-guri-v1",
      partialize: (state) => ({
        period: state.period,
        cashflow: state.cashflow,
        accounts: state.accounts,
        meisai: state.meisai,
        meisaiForecast: state.meisaiForecast,
        taxForecast: state.taxForecast,
        appliedTaxTranscription: state.appliedTaxTranscription,
        budget: state.budget,
        budgetSnapshotAt: state.budgetSnapshotAt,
        learnedRules: state.learnedRules,
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
          meisaiForecast: p.meisaiForecast ?? current.meisaiForecast,
          taxForecast: p.taxForecast ?? current.taxForecast,
          appliedTaxTranscription:
            p.appliedTaxTranscription ?? current.appliedTaxTranscription,
          budget: p.budget ?? current.budget,
          budgetSnapshotAt: p.budgetSnapshotAt ?? current.budgetSnapshotAt,
          learnedRules: p.learnedRules ?? current.learnedRules,
        };
      },
    }
  )
);
