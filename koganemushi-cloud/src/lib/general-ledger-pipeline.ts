/**
 * 正規化トランザクション + マッピング → 中間ファイル / 資金繰り実績表 / 明細表。
 * 出力は既存の CashflowCsvImportResult / MeisaiCsvImportResult 型に合わせ、
 * 既存ストアアクション（importCashflowCsv / importMeisaiCsv）へ直結する。
 */
import type {
  CashflowCsvImportResult,
  MeisaiCsvImportResult,
} from "@/lib/shikin-guri-csv";
import {
  OPENING_BALANCE_LABEL,
  SUBJECTS,
  SUBJECT_BY_ID,
} from "@/lib/shikin-guri-subjects";
import { formatJpMonth } from "@/lib/shikin-guri-months";
import { resolveSubject } from "@/lib/general-ledger-mapping";
import type { MeisaiRow, MonthKey } from "@/types/shikin-guri";
import type {
  CpDescAssignments,
  DescriptionOverrides,
  DiscrepancyDiagnosis,
  DiscrepancyGroup,
  IntermediateRow,
  MeisaiPreviewRow,
  OffsetCandidate,
  PipelineAdjustments,
  ParsedLedger,
  RawLedgerTxn,
  ReverseFlowRow,
  SubjectMappingEntry,
} from "@/types/general-ledger";

export interface LedgerPipelineResult {
  months: MonthKey[];
  cashflow: CashflowCsvImportResult;
  meisai: MeisaiCsvImportResult;
  /** 明細表プレビュー（科目上書きUI用。マッピング既定科目で安定キー保持） */
  meisaiPreview: MeisaiPreviewRow[];
  /** 逆方向フロー（科目種別と逆向きで集計0計上＝残高に漏れる明細） */
  reverseFlows: ReverseFlowRow[];
  /** 残高不一致の自動診断（原因分解） */
  discrepancy: DiscrepancyDiagnosis;
  /** 消込候補（科目＋同額の入金/出金ペア） */
  offsetCandidates: OffsetCandidate[];
  intermediateRows: IntermediateRow[];
  mapping: SubjectMappingEntry[];
  /** 資金移動・除外として集計対象外になったトランザクション数 */
  excludedCount: number;
  /** 期首月の前期繰越残高合計 */
  openingBalanceFirstMonth: number;
}

const EMPTY_LABEL = "(空欄)";

/** 表示用の相手勘定科目正規化（中間ファイルの摘要内容用） */
const SUMMARY_LABEL_NORMALIZE: Record<string, string> = {
  資金諸口: "資金移動",
};

function txnDirection(t: RawLedgerTxn): "inflow" | "outflow" {
  return t.inflow > 0 && t.outflow === 0 ? "inflow" : "outflow";
}

/** 摘要内容 = 取引内容 + " " + 相手勘定科目（資金諸口は資金移動と表記） */
export function buildIntermediateRows(
  txns: RawLedgerTxn[],
): IntermediateRow[] {
  return txns
    .filter((t) => !t.isOpeningCarry)
    .map((t) => {
      const cpLabel =
        SUMMARY_LABEL_NORMALIZE[t.counterpartyAccount] ??
        t.counterpartyAccount;
      const summary = [t.description.trim(), cpLabel]
        .filter((s) => s !== "")
        .join(" ");
      return {
        date: t.date,
        outflow: t.outflow,
        inflow: t.inflow,
        balance: t.balance,
        summary,
      };
    });
}

/** 消込キー（資金繰り科目＋金額） */
export function offsetKey(subjectId: string, amount: number): string {
  return `${subjectId}${amount}`;
}

/** 摘要分解の割当キー（相手勘定科目＋摘要） */
export function cpDescKey(cp: string, description: string): string {
  return `${cp}${description.trim()}`;
}

/**
 * 1トランザクションの行先 subjectId を決定。
 * 優先順位:
 *  1. 摘要分解割当 cpDescAssignments[(cp, 摘要)]（あれば確定。string/null）
 *  2. 相手勘定科目マッピング
 *     - rule由来: 入出金方向で都度再解決（借入金等の方向依存を保つ）
 *     - manual/ai由来: ユーザー/AI判断を全方向に適用
 *     - excluded/unmapped/未登録: null（集計対象外）
 */
function resolveTxnSubject(
  t: RawLedgerTxn,
  entryByCp: Map<string, SubjectMappingEntry>,
  cpDescAssignments: CpDescAssignments,
): string | null {
  const cp = t.counterpartyAccount || EMPTY_LABEL;
  const dkey = cpDescKey(cp, t.description);
  if (Object.prototype.hasOwnProperty.call(cpDescAssignments, dkey)) {
    return cpDescAssignments[dkey];
  }
  const entry = entryByCp.get(cp);
  if (!entry) {
    return null;
  }
  if (entry.source === "rule") {
    return resolveSubject(t.counterpartyAccount, txnDirection(t)).subjectId;
  }
  return entry.subjectId;
}

/** 明細行単位の科目上書きキー（マッピング既定科目＋摘要で安定） */
export function meisaiOverrideKey(
  baseSubjectId: string,
  description: string,
): string {
  return `${baseSubjectId}${description}`;
}

/** (baseSubject, 摘要) 単位の集計ユニット */
interface MeisaiUnit {
  overrideKey: string;
  baseSubjectId: string;
  finalSubjectId: string;
  description: string;
  amounts: Record<MonthKey, number>;
}

/** マッピング既定科目 → 明細行上書きを適用した実効科目（null=除外） */
function effectiveSubject(
  baseSubjectId: string,
  description: string,
  overrides: DescriptionOverrides,
): { overrideKey: string; finalSubjectId: string | null } {
  const overrideKey = meisaiOverrideKey(baseSubjectId, description);
  const has = Object.prototype.hasOwnProperty.call(overrides, overrideKey);
  return {
    overrideKey,
    finalSubjectId: has ? overrides[overrideKey] : baseSubjectId,
  };
}

interface LeakAcc {
  counterpartyAccount: string;
  overrideKey: string;
  baseSubjectId: string;
  finalSubjectId: string;
  description: string;
  kind: "income" | "expense";
  txnCount: number;
  leakedAmount: number;
}

interface ExcludedDiagAcc {
  counterpartyAccount: string;
  description: string;
  category: "transfer" | "excluded";
  txnCount: number;
  leakedSigned: number;
}

interface Accumulators {
  cellsBySubject: Record<string, Record<MonthKey, number>>;
  units: Map<string, MeisaiUnit>;
  leaks: Map<string, LeakAcc>;
  excludedDiag: Map<string, ExcludedDiagAcc>;
  excludedCount: number;
  offsetCandidates: OffsetCandidate[];
}

interface TxnTarget {
  overrideKey: string;
  baseSubjectId: string;
  finalSubjectId: string;
  description: string;
  amount: number;
}

interface ResolveCtx {
  entryByCp: Map<string, SubjectMappingEntry>;
  overrides: DescriptionOverrides;
  cpDescAssignments: CpDescAssignments;
}

/** マッピング＋上書きを適用して1txnの行先・金額を決定。対象外は null */
function resolveTxnTarget(
  t: RawLedgerTxn,
  ctx: ResolveCtx,
): TxnTarget | null {
  const baseSubjectId = resolveTxnSubject(
    t,
    ctx.entryByCp,
    ctx.cpDescAssignments,
  );
  if (baseSubjectId === null) {
    return null;
  }
  const description = t.description.trim();
  const { overrideKey, finalSubjectId } = effectiveSubject(
    baseSubjectId,
    description,
    ctx.overrides,
  );
  if (finalSubjectId === null) {
    return null;
  }
  const def = SUBJECT_BY_ID[finalSubjectId];
  if (!def) {
    return null;
  }
  return {
    overrideKey,
    baseSubjectId,
    finalSubjectId,
    description,
    amount: def.kind === "income" ? t.inflow : t.outflow,
  };
}

function upsertUnit(acc: Accumulators, tgt: TxnTarget): MeisaiUnit {
  let unit = acc.units.get(tgt.overrideKey);
  if (!unit) {
    unit = {
      overrideKey: tgt.overrideKey,
      baseSubjectId: tgt.baseSubjectId,
      finalSubjectId: tgt.finalSubjectId,
      description: tgt.description,
      amounts: {},
    };
    acc.units.set(tgt.overrideKey, unit);
  }
  unit.finalSubjectId = tgt.finalSubjectId;
  return unit;
}

/**
 * 逆方向フロー（科目kindと逆向きで金額0計上＝残高に漏れる）を記録。
 * counted=0 かつ 実フロー>0 のとき検出。
 */
function recordLeak(
  acc: Accumulators,
  t: RawLedgerTxn,
  tgt: TxnTarget,
  kind: "income" | "expense",
): void {
  const flow = t.inflow + t.outflow;
  if (tgt.amount !== 0 || flow === 0) {
    return;
  }
  let leak = acc.leaks.get(tgt.overrideKey);
  if (!leak) {
    leak = {
      counterpartyAccount: t.counterpartyAccount || EMPTY_LABEL,
      overrideKey: tgt.overrideKey,
      baseSubjectId: tgt.baseSubjectId,
      finalSubjectId: tgt.finalSubjectId,
      description: tgt.description,
      kind,
      txnCount: 0,
      leakedAmount: 0,
    };
    acc.leaks.set(tgt.overrideKey, leak);
  }
  leak.finalSubjectId = tgt.finalSubjectId;
  leak.kind = kind;
  leak.txnCount++;
  leak.leakedAmount += flow;
}

/** 1トランザクションを集計に加算。集計対象外なら false */
function accumulateTxn(
  t: RawLedgerTxn,
  ctx: ResolveCtx,
  acc: Accumulators,
): boolean {
  const tgt = resolveTxnTarget(t, ctx);
  if (!tgt) {
    return false;
  }
  const row = (acc.cellsBySubject[tgt.finalSubjectId] ??= {});
  row[t.monthKey] = (row[t.monthKey] ?? 0) + tgt.amount;

  const unit = upsertUnit(acc, tgt);
  unit.amounts[t.monthKey] = (unit.amounts[t.monthKey] ?? 0) + tgt.amount;

  const kind = SUBJECT_BY_ID[tgt.finalSubjectId]?.kind;
  if (kind) {
    recordLeak(acc, t, tgt, kind);
  }
  return true;
}

/** 集計対象外（資金移動/未割当）の txn を診断用に記録 */
function recordExcludedDiag(acc: Accumulators, t: RawLedgerTxn): void {
  const cp = t.counterpartyAccount || EMPTY_LABEL;
  const category: "transfer" | "excluded" =
    cp === "資金諸口" ? "transfer" : "excluded";
  const key = `${category}${cpDescKey(cp, t.description)}`;
  let e = acc.excludedDiag.get(key);
  if (!e) {
    e = {
      counterpartyAccount: cp,
      description: t.description.trim(),
      category,
      txnCount: 0,
      leakedSigned: 0,
    };
    acc.excludedDiag.set(key, e);
  }
  e.txnCount++;
  e.leakedSigned += t.inflow - t.outflow;
}

function subjectOrder(subjectId: string): number {
  return SUBJECT_BY_ID[subjectId]?.order ?? 9999;
}

/** ユニット → 既存 importMeisaiCsv 互換の明細行（実効科目＋摘要で再集計） */
function unitsToStoreMeisai(units: MeisaiUnit[]): MeisaiRow[] {
  const byKey = new Map<string, MeisaiRow>();
  for (const u of units) {
    const key = `${u.finalSubjectId}${u.description}`;
    let mr = byKey.get(key);
    if (!mr) {
      mr = {
        subjectId: u.finalSubjectId,
        description: u.description,
        amounts: {},
      };
      byKey.set(key, mr);
    }
    for (const [m, v] of Object.entries(u.amounts)) {
      mr.amounts[m] = (mr.amounts[m] ?? 0) + v;
    }
  }
  return Array.from(byKey.values()).filter((r) =>
    Object.values(r.amounts).some((v) => v !== 0),
  );
}

function buildMeisaiPreview(units: MeisaiUnit[]): MeisaiPreviewRow[] {
  return units
    .map((u) => ({
      overrideKey: u.overrideKey,
      baseSubjectId: u.baseSubjectId,
      subjectId: u.finalSubjectId,
      description: u.description,
      amounts: u.amounts,
    }))
    .sort(
      (a, b) =>
        subjectOrder(a.subjectId) - subjectOrder(b.subjectId) ||
        a.description.localeCompare(b.description, "ja"),
    );
}

function buildReverseFlows(leaks: Map<string, LeakAcc>): ReverseFlowRow[] {
  return Array.from(leaks.values())
    .map((l) => ({
      counterpartyAccount: l.counterpartyAccount,
      description: l.description,
      overrideKey: l.overrideKey,
      baseSubjectId: l.baseSubjectId,
      subjectId: l.finalSubjectId,
      kind: l.kind,
      txnCount: l.txnCount,
      leakedAmount: l.leakedAmount,
    }))
    .sort((a, b) => b.leakedAmount - a.leakedAmount);
}

function sumOpeningBalance(
  parsed: ParsedLedger,
  firstMonth: MonthKey | null,
): number {
  if (firstMonth === null) {
    return 0;
  }
  return parsed.openingBalances
    .filter((o) => o.monthKey <= firstMonth)
    .reduce((sum, o) => sum + o.balance, 0);
}

function ledgerLastTotal(parsed: ParsedLedger): number {
  const last = new Map<string, number>();
  for (const t of parsed.txns) {
    last.set(t.accountLedger, t.balance);
  }
  return [...last.values()].reduce((s, v) => s + v, 0);
}

function countedSignedTotal(
  cells: Record<string, Record<MonthKey, number>>,
): number {
  let net = 0;
  for (const [sid, row] of Object.entries(cells)) {
    const def = SUBJECT_BY_ID[sid];
    if (!def) {
      continue;
    }
    const sum = Object.values(row).reduce((s, v) => s + v, 0);
    net += def.kind === "income" ? sum : -sum;
  }
  return net;
}

function discrepancyGroups(acc: Accumulators): DiscrepancyGroup[] {
  const groups: DiscrepancyGroup[] = [];
  for (const e of acc.excludedDiag.values()) {
    groups.push({
      category: e.category,
      counterpartyAccount: e.counterpartyAccount,
      description: e.description,
      cpDescKey: cpDescKey(e.counterpartyAccount, e.description),
      txnCount: e.txnCount,
      leakedSigned: e.leakedSigned,
      diffContribution: -e.leakedSigned,
    });
  }
  for (const l of acc.leaks.values()) {
    // income科目に出金: L=-flow / expense科目に入金: L=+flow
    const leakedSigned =
      l.kind === "income" ? -l.leakedAmount : l.leakedAmount;
    groups.push({
      category: "reverse",
      counterpartyAccount: l.counterpartyAccount,
      description: l.description,
      cpDescKey: cpDescKey(l.counterpartyAccount, l.description),
      txnCount: l.txnCount,
      leakedSigned,
      diffContribution: -leakedSigned,
    });
  }
  return groups
    .filter((g) => g.diffContribution !== 0)
    .sort(
      (a, b) => Math.abs(b.diffContribution) - Math.abs(a.diffContribution),
    );
}

function buildDiscrepancy(
  parsed: ParsedLedger,
  acc: Accumulators,
  openingBalanceFirstMonth: number,
): DiscrepancyDiagnosis {
  const openingAll = parsed.openingBalances.reduce(
    (s, o) => s + o.balance,
    0,
  );
  const allSigned = parsed.txns.reduce(
    (s, t) => (t.isOpeningCarry ? s : s + t.inflow - t.outflow),
    0,
  );
  const ledgerLast = ledgerLastTotal(parsed);
  const countedSigned = countedSignedTotal(acc.cellsBySubject);
  const finalDiff =
    openingBalanceFirstMonth + countedSigned - ledgerLast;

  let transferLeak = 0;
  let excludedLeak = 0;
  for (const e of acc.excludedDiag.values()) {
    if (e.category === "transfer") {
      transferLeak += e.leakedSigned;
    } else {
      excludedLeak += e.leakedSigned;
    }
  }
  let reverseLeak = 0;
  for (const l of acc.leaks.values()) {
    reverseLeak += l.kind === "income" ? -l.leakedAmount : l.leakedAmount;
  }
  const transferContribution = -transferLeak;
  const excludedContribution = -excludedLeak;
  const reverseContribution = -reverseLeak;
  const explained =
    transferContribution + excludedContribution + reverseContribution;

  return {
    ledgerIntegrityDiff: openingAll + allSigned - ledgerLast,
    finalDiff,
    transferContribution,
    excludedContribution,
    reverseContribution,
    explained,
    residual: finalDiff - explained,
    groups: discrepancyGroups(acc),
  };
}

interface OffsetGroup {
  subjectId: string;
  amount: number;
  inflow: RawLedgerTxn[];
  outflow: RawLedgerTxn[];
  inSamples: string[];
  outSamples: string[];
}

function pushSample(arr: string[], desc: string): void {
  const d = desc.trim();
  if (d && arr.length < 3 && !arr.includes(d)) {
    arr.push(d);
  }
}

/**
 * 消込候補（資金繰り科目＋同額の入金/出金ペア）と、確認済の除外txn集合を構築。
 * 摘要は一致条件に含めない（科目＋金額のみ）。入金=出金 同額ペアのみ。
 */
function getOrCreateGroup(
  groups: Map<string, OffsetGroup>,
  subjectId: string,
  gross: number,
): OffsetGroup {
  const key = offsetKey(subjectId, gross);
  let g = groups.get(key);
  if (!g) {
    g = {
      subjectId,
      amount: gross,
      inflow: [],
      outflow: [],
      inSamples: [],
      outSamples: [],
    };
    groups.set(key, g);
  }
  return g;
}

function pushTxnToGroup(
  g: OffsetGroup,
  isIn: boolean,
  t: RawLedgerTxn,
): void {
  if (isIn) {
    g.inflow.push(t);
    pushSample(g.inSamples, t.description);
  } else {
    g.outflow.push(t);
    pushSample(g.outSamples, t.description);
  }
}

function collectOffsetGroups(
  parsed: ParsedLedger,
  ctx: ResolveCtx,
): Map<string, OffsetGroup> {
  const groups = new Map<string, OffsetGroup>();
  for (const t of parsed.txns) {
    if (t.isOpeningCarry) {
      continue;
    }
    const tgt = resolveTxnTarget(t, ctx);
    if (!tgt) {
      continue;
    }
    const isIn = t.inflow > 0 && t.outflow === 0;
    const gross = isIn ? t.inflow : t.outflow;
    if (gross > 0) {
      pushTxnToGroup(
        getOrCreateGroup(groups, tgt.finalSubjectId, gross),
        isIn,
        t,
      );
    }
  }
  return groups;
}

function toOffsetCandidate(
  key: string,
  g: OffsetGroup,
  pairCount: number,
  confirmed: boolean,
): OffsetCandidate {
  return {
    key,
    subjectId: g.subjectId,
    amount: g.amount,
    pairCount,
    offsetTotal: g.amount * pairCount,
    inflowCount: g.inflow.length,
    outflowCount: g.outflow.length,
    inflowSamples: g.inSamples,
    outflowSamples: g.outSamples,
    confirmed,
  };
}

/**
 * 消込候補（資金繰り科目＋同額の入金/出金ペア）と、確認済の除外txn集合を構築。
 * 摘要は一致条件に含めない（科目＋金額のみ）。入金=出金 同額ペアのみ。
 */
function buildOffsetPlan(
  parsed: ParsedLedger,
  ctx: ResolveCtx,
  offsetKeys: Record<string, boolean>,
): { candidates: OffsetCandidate[]; excluded: Set<RawLedgerTxn> } {
  const groups = collectOffsetGroups(parsed, ctx);
  const candidates: OffsetCandidate[] = [];
  const excluded = new Set<RawLedgerTxn>();
  for (const [key, g] of groups) {
    const pairCount = Math.min(g.inflow.length, g.outflow.length);
    if (pairCount === 0) {
      continue;
    }
    const confirmed = offsetKeys[key] === true;
    candidates.push(toOffsetCandidate(key, g, pairCount, confirmed));
    if (confirmed) {
      for (let i = 0; i < pairCount; i++) {
        excluded.add(g.inflow[i]);
        excluded.add(g.outflow[i]);
      }
    }
  }
  candidates.sort((a, b) => b.offsetTotal - a.offsetTotal);
  return { candidates, excluded };
}

function makeResolveCtx(
  mapping: SubjectMappingEntry[],
  adjustments: PipelineAdjustments,
): ResolveCtx {
  return {
    entryByCp: new Map<string, SubjectMappingEntry>(
      mapping.map((m) => [m.counterpartyAccount, m]),
    ),
    overrides: adjustments.descriptionOverrides ?? {},
    cpDescAssignments: adjustments.cpDescAssignments ?? {},
  };
}

function runAccumulation(
  parsed: ParsedLedger,
  ctx: ResolveCtx,
  plan: { excluded: Set<RawLedgerTxn> },
  acc: Accumulators,
): void {
  for (const t of parsed.txns) {
    if (t.isOpeningCarry) {
      continue;
    }
    // 消込確定ペアは資金移動と同様に集計除外（原因一覧には出さない）
    if (plan.excluded.has(t)) {
      acc.excludedCount++;
    } else if (!accumulateTxn(t, ctx, acc)) {
      acc.excludedCount++;
      recordExcludedDiag(acc, t);
    }
  }
}

export function aggregatePipeline(
  parsed: ParsedLedger,
  mapping: SubjectMappingEntry[],
  adjustments: PipelineAdjustments = {},
): LedgerPipelineResult {
  const months = [...parsed.months];
  const ctx = makeResolveCtx(mapping, adjustments);
  const plan = buildOffsetPlan(parsed, ctx, adjustments.offsetKeys ?? {});

  const acc: Accumulators = {
    cellsBySubject: {},
    units: new Map<string, MeisaiUnit>(),
    leaks: new Map<string, LeakAcc>(),
    excludedDiag: new Map<string, ExcludedDiagAcc>(),
    excludedCount: 0,
    offsetCandidates: plan.candidates,
  };

  runAccumulation(parsed, ctx, plan, acc);

  return assembleResult(parsed, mapping, months, acc);
}

function assembleResult(
  parsed: ParsedLedger,
  mapping: SubjectMappingEntry[],
  months: MonthKey[],
  acc: Accumulators,
): LedgerPipelineResult {
  const nonZeroUnits = Array.from(acc.units.values()).filter((u) =>
    Object.values(u.amounts).some((v) => v !== 0),
  );
  const openingBalanceFirstMonth = sumOpeningBalance(
    parsed,
    months[0] ?? null,
  );
  return {
    months,
    cashflow: {
      months,
      cellsBySubject: acc.cellsBySubject,
      openingBalanceCandidate: openingBalanceFirstMonth,
      unknownLabels: [],
      unknownMonthHeaders: [],
    },
    meisai: {
      rows: unitsToStoreMeisai(nonZeroUnits),
      months,
      unknownLabels: [],
      unknownMonthHeaders: [],
    },
    meisaiPreview: buildMeisaiPreview(nonZeroUnits),
    reverseFlows: buildReverseFlows(acc.leaks),
    discrepancy: buildDiscrepancy(parsed, acc, openingBalanceFirstMonth),
    offsetCandidates: acc.offsetCandidates,
    intermediateRows: buildIntermediateRows(parsed.txns),
    mapping,
    excludedCount: acc.excludedCount,
    openingBalanceFirstMonth,
  };
}

// ---- CSV 直列化（UTF-8 BOM付・Excel互換） ----

const BOM = "﻿";

function csvCell(v: string | number): string {
  const s = String(v);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsv(rows: (string | number)[][]): string {
  return BOM + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/** 中間ファイル（総勘定元帳：アップロード用.csv） */
export function intermediateToCsv(rows: IntermediateRow[]): string {
  const out: (string | number)[][] = [
    ["取引日", "出金金額", "入金金額", "取引後残高", "摘要内容"],
  ];
  for (const r of rows) {
    out.push([r.date, r.outflow, r.inflow, r.balance, r.summary]);
  }
  return toCsv(out);
}

/** 資金繰り実績表.csv（科目×月、42科目 + 期首・期末現預金残高） */
export function cashflowResultToCsv(r: CashflowCsvImportResult): string {
  const out: (string | number)[][] = [
    ["科目", ...r.months.map(formatJpMonth)],
  ];
  for (const s of SUBJECTS) {
    const row = r.cellsBySubject[s.id] ?? {};
    out.push([s.label, ...r.months.map((m) => row[m] ?? 0)]);
  }
  // 期首・期末現預金残高: 先頭月のみ期首残高、以降は空欄
  const opening: (string | number)[] = [OPENING_BALANCE_LABEL];
  r.months.forEach((_, i) => {
    opening.push(i === 0 ? (r.openingBalanceCandidate ?? 0) : "");
  });
  out.push(opening);
  return toCsv(out);
}

/** 明細表.csv（科目×摘要×月） */
export function meisaiResultToCsv(r: MeisaiCsvImportResult): string {
  const out: (string | number)[][] = [
    ["科目", "摘要", ...r.months.map(formatJpMonth)],
  ];
  // 科目順 → 同一科目内は元の順序
  const orderById = new Map(SUBJECTS.map((s, i) => [s.id, i]));
  const sorted = [...r.rows].sort((a, b) => {
    const oa = orderById.get(a.subjectId) ?? 999;
    const ob = orderById.get(b.subjectId) ?? 999;
    return oa - ob;
  });
  for (const row of sorted) {
    const label = SUBJECT_BY_ID[row.subjectId]?.label ?? row.subjectId;
    out.push([
      label,
      row.description,
      ...r.months.map((m) => row.amounts[m] ?? 0),
    ]);
  }
  return toCsv(out);
}
