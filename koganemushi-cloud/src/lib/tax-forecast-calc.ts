/**
 * 納税予定（納税予測.xlsx 完全移植）の純粋計算。
 *
 * Excel `docs/shikingurihyou/Excel-data/納税予測.xlsx` の数式をリバースエンジニアリング
 * して逐語移植したもの（ground truth）。副作用なし・UI 非依存（CLAUDE.md 設計原則）。
 * 金額は整数（円）、料率は小数。
 */
import type {
  AppliedTaxTranscription,
  ConsumptionTaxInput,
  CorporateTaxInput,
  DefenseTaxMode,
  FiscalPeriodConfig,
  MonthKey,
  TaxForecastState,
} from "@/types/shikin-guri";
import { eomonth } from "@/lib/shikin-guri-months";
import {
  BIZ_TAX_SURCHARGE,
  BIZ_TAX_T1,
  BIZ_TAX_T2,
  BIZ_TAX_T3,
  CONSUMPTION_BASE_FLOOR,
  CONSUMPTION_INTERIM_MONTHLY,
  CONSUMPTION_INTERIM_QUARTERLY,
  CONSUMPTION_INTERIM_SEMIANNUAL,
  CONSUMPTION_NATIONAL_RATIO,
  CONSUMPTION_TAX_RATE,
  CORP_INTERIM_THRESHOLD,
  CORP_TAX_HIGH,
  CORP_TAX_LOW,
  DEFENSE_BAND_LIMIT,
  DEFENSE_CORP_TAX_THRESHOLD,
  DEFENSE_START_MONTH,
  DEFENSE_START_YEAR,
  DEFENSE_TAX_RATE,
  INCOME_BAND_400,
  INCOME_BAND_800,
  LOCAL_CORP_TAX_RATE,
  RATE_TABLE_CURRENT,
  RATE_TABLE_DEFENSE,
  RESIDENT_TAX_CORP_RATE,
  floorTo,
} from "@/lib/tax-forecast-rates";

/** 確定申告は決算月の2ヶ月後（EOMONTH +2）から。納税予定表は 36 行（=3決算期）。 */
const SCHEDULE_OFFSET = 2;
const SCHEDULE_LENGTH = 36;
/** 1決算期=12ヶ月。確定 node は k%12===0、法人税中間 node は k%12===6。 */
const PERIOD_MONTHS = 12;

/** ───────────────── 消費税概算 ───────────────── */

export function calcConsumptionTax(p: ConsumptionTaxInput): {
  base: number;
  tax: number;
} {
  const plus =
    p.officerCompensation +
    p.otherSalary +
    p.legalWelfare +
    p.depreciation +
    p.insurance +
    p.interestPaid +
    p.otherNonTaxablePurchase;
  const minus =
    p.interestReceived + p.dividendReceived + p.otherNonTaxableSales;
  const base = floorTo(p.preTaxProfit + plus - minus, CONSUMPTION_BASE_FLOOR);
  const tax = base * CONSUMPTION_TAX_RATE;
  return { base, tax };
}

/** ───────────────── 法人税概算 ───────────────── */

export function calcCorporateIncome(
  preTaxProfit: number,
  carryForwardLoss: number,
  prevBusinessTaxDeduction: number
): number {
  return preTaxProfit - carryForwardLoss - prevBusinessTaxDeduction;
}

/** 法人税額 = FLOOR(MIN(所得,8e6)*0.15 + MAX(所得-8e6,0)*0.232, 100) */
export function calcCorporateTaxAmount(income: number): number {
  const taxable = Math.max(income, 0);
  const v =
    Math.min(taxable, INCOME_BAND_800) * CORP_TAX_LOW +
    Math.max(taxable - INCOME_BAND_800, 0) * CORP_TAX_HIGH;
  return floorTo(v, 100);
}

/** 法人住民税 法人税割 = FLOOR(法人税額 × 0.07, 100)。均等割は別途。 */
export function calcResidentTaxAmount(corporateTaxAmount: number): number {
  return floorTo(corporateTaxAmount * RESIDENT_TAX_CORP_RATE, 100);
}

/** 地方法人税 = FLOOR(法人税額 × 0.104, 100)。国税。 */
export function calcLocalCorporateTaxAmount(corporateTaxAmount: number): number {
  return floorTo(corporateTaxAmount * LOCAL_CORP_TAX_RATE, 100);
}

/**
 * 防衛特別法人税 = FLOOR(MAX(法人税額 − 500万, 0) × 0.04, 100)。
 * defenseApplied=false のときは 0。
 */
export function calcDefenseTaxAmount(
  corporateTaxAmount: number,
  defenseApplied: boolean
): number {
  if (!defenseApplied) {
    return 0;
  }
  const taxable = Math.max(
    corporateTaxAmount - DEFENSE_CORP_TAX_THRESHOLD,
    0
  );
  return floorTo(taxable * DEFENSE_TAX_RATE, 100);
}

/**
 * 事業税額 = FLOOR((MIN(所得,4e6)*0.07 + MIN(MAX(所得-4e6,0),4e6)*0.085
 *           + MAX(所得-8e6,0)*0.10) * (1+0.375), 100)
 */
export function calcBusinessTaxAmount(income: number): number {
  const inc = Math.max(income, 0);
  const shotokuwari =
    Math.min(inc, INCOME_BAND_400) * BIZ_TAX_T1 +
    Math.min(Math.max(inc - INCOME_BAND_400, 0), INCOME_BAND_400) * BIZ_TAX_T2 +
    Math.max(inc - INCOME_BAND_800, 0) * BIZ_TAX_T3;
  return floorTo(shotokuwari * (1 + BIZ_TAX_SURCHARGE), 100);
}

/**
 * 年税額 = 合計税率テーブルを所得階層に適用し FLOOR(,100)。
 * defense=true で 800万超を法人税額500万で分割（4段）。
 */
export function calcAnnualTaxAmount(income: number, defense: boolean): number {
  const inc = Math.max(income, 0);
  const t1 = Math.min(inc, INCOME_BAND_400);
  const t2 = Math.min(Math.max(inc - INCOME_BAND_400, 0), INCOME_BAND_400);
  if (!defense) {
    const r = RATE_TABLE_CURRENT;
    const t3 = Math.max(inc - INCOME_BAND_800, 0);
    return floorTo(t1 * r.t1 + t2 * r.t2 + t3 * r.t3, 100);
  }
  const r = RATE_TABLE_DEFENSE;
  const over800 = Math.max(inc - INCOME_BAND_800, 0);
  const t3 = Math.min(over800, DEFENSE_BAND_LIMIT);
  const t4 = Math.max(over800 - DEFENSE_BAND_LIMIT, 0);
  return floorTo(t1 * r.t1 + t2 * r.t2 + t3 * r.t3 + t4 * r.t4, 100);
}

/**
 * 防衛特別法人税の適用判定。auto は事業年度開始日
 * （= 決算月の11ヶ月前の月初）が 2026/4/1 以降なら適用。
 * 比較は year*12+month の整数で行い Date 非依存。
 */
export function resolveDefenseMode(
  mode: DefenseTaxMode,
  fiscalPeriod: FiscalPeriodConfig,
  periodIndex: number
): boolean {
  if (mode === "on") {
    return true;
  }
  if (mode === "off") {
    return false;
  }
  const closing = eomonth(
    fiscalPeriod.closingYear,
    fiscalPeriod.closingMonth,
    PERIOD_MONTHS * periodIndex
  );
  // 事業年度開始 = 決算月 - 11ヶ月（0-based 月インデックスで比較）
  const startIndex = closing.year * 12 + (closing.month - 1) - 11;
  const defenseIndex = DEFENSE_START_YEAR * 12 + (DEFENSE_START_MONTH - 1);
  return startIndex >= defenseIndex;
}

/** ───────────────── 期別計算 ───────────────── */

export interface PeriodTaxResult {
  periodIndex: 0 | 1 | 2;
  closing: { year: number; month: number; day: number };
  /** 消費税対象額（FLOOR 千円） */
  consumptionTaxableBase: number;
  /** 概算消費税額（対象額 × 10%） */
  estimatedConsumptionTax: number;
  /** 自動連鎖解決後の前期事業税減算（UI 表示用） */
  resolvedPrevBizTaxDeduction: number;
  /** 法人所得 */
  corporateIncome: number;
  /** 法人税額 */
  corporateTaxAmount: number;
  /** 地方法人税 = FLOOR(法人税額 × 0.104, 100)（国税） */
  localCorporateTaxAmount: number;
  /** 法人住民税 法人税割 = FLOOR(法人税額 × 0.07, 100)（均等割は含めない） */
  residentTaxAmount: number;
  /** 防衛特別法人税 = FLOOR(MAX(法人税額 − 500万, 0) × 0.04, 100)。非適用期は 0 */
  defenseTaxAmount: number;
  /** 事業税額 */
  businessTaxAmount: number;
  /** 年税額 */
  annualTaxAmount: number;
  /** 防衛特別法人税が適用されたか（auto 解決後） */
  defenseApplied: boolean;
}

export type TaxScheduleKind =
  | "kakutei"
  | "corp-chukan"
  | "consumption-interim"
  | "withholding";

export interface TaxScheduleRow {
  /** 行の月末日 */
  date: { year: number; month: number; day: number };
  /** 転記先 MonthKey（= "YYYY-MM"） */
  month: MonthKey;
  /** この行に含まれるノード種別（表示用） */
  kinds: TaxScheduleKind[];
  /** 法人税等（→ houjinzeiTou へ加算） */
  corporateTaxAmount: number;
  /** 消費税等（→ shouhizeiSozeiKouka へ加算） */
  consumptionTaxAmount: number;
  /** 源泉所得税 納期特例（→ shakaiHokenGensenJuumin へ加算。手入力由来） */
  withholdingTaxAmount: number;
  /** この行が源泉所得税の手入力対象（毎年 1月末/7月末） */
  isWithholdingInputRow: boolean;
}

export interface TaxForecastResult {
  periods: [PeriodTaxResult, PeriodTaxResult, PeriodTaxResult];
  schedule: TaxScheduleRow[];
}

function calcPeriods(
  input: TaxForecastState
): [PeriodTaxResult, PeriodTaxResult, PeriodTaxResult] {
  const results: PeriodTaxResult[] = [];
  for (let p = 0; p < 3; p++) {
    const cons = input.consumptionTax[p];
    const corp = input.corporateTax[p];
    const { base, tax } = calcConsumptionTax(cons);

    // 前期事業税減算: 1期目=手入力、2/3期目=前期事業税額（手入力上書き可）
    let prevBiz: number;
    if (p === 0 || corp.prevBusinessTaxDeductionManual) {
      prevBiz = corp.prevBusinessTaxDeduction;
    } else {
      prevBiz = results[p - 1].businessTaxAmount;
    }

    const income = calcCorporateIncome(
      cons.preTaxProfit,
      corp.carryForwardLoss,
      prevBiz
    );
    const defenseApplied = resolveDefenseMode(
      input.defenseTaxMode,
      input.fiscalPeriod,
      p
    );
    const closing = eomonth(
      input.fiscalPeriod.closingYear,
      input.fiscalPeriod.closingMonth,
      PERIOD_MONTHS * p
    );

    const corpTaxAmount = calcCorporateTaxAmount(income);
    results.push({
      periodIndex: p as 0 | 1 | 2,
      closing,
      consumptionTaxableBase: base,
      estimatedConsumptionTax: tax,
      resolvedPrevBizTaxDeduction: prevBiz,
      corporateIncome: income,
      corporateTaxAmount: corpTaxAmount,
      localCorporateTaxAmount: calcLocalCorporateTaxAmount(corpTaxAmount),
      residentTaxAmount: calcResidentTaxAmount(corpTaxAmount),
      defenseTaxAmount: calcDefenseTaxAmount(corpTaxAmount, defenseApplied),
      businessTaxAmount: calcBusinessTaxAmount(income),
      annualTaxAmount: calcAnnualTaxAmount(income, defenseApplied),
      defenseApplied,
    });
  }
  return results as [PeriodTaxResult, PeriodTaxResult, PeriodTaxResult];
}

/** 法人税中間納付額（IF(法人税額>200000, FLOOR(年税額/2,100), 0)） */
function corpInterim(period: PeriodTaxResult): number {
  return period.corporateTaxAmount > CORP_INTERIM_THRESHOLD
    ? floorTo(period.annualTaxAmount / 2, 100)
    : 0;
}

/**
 * 消費税中間納付額。ctaxBase×0.78 のしきい値で頻度を決め、amountBase を配賦。
 * rel: 確定 node からの相対位置（1..11）。3/9=四半期 node、6=半期 node、他=毎月。
 */
function consumptionInterim(
  rel: number,
  ctaxBase: number,
  amountBase: number
): number {
  const ctax = ctaxBase * CONSUMPTION_NATIONAL_RATIO;
  let v = 0;
  if (rel === 6) {
    // 半期 node
    if (ctax > CONSUMPTION_INTERIM_MONTHLY) {
      v = amountBase / 12;
    } else if (ctax > CONSUMPTION_INTERIM_QUARTERLY) {
      v = amountBase / 4;
    } else if (ctax > CONSUMPTION_INTERIM_SEMIANNUAL) {
      v = amountBase / 2;
    }
  } else if (rel === 3 || rel === 9) {
    // 四半期 node
    if (ctax > CONSUMPTION_INTERIM_MONTHLY) {
      v = amountBase / 12;
    } else if (ctax > CONSUMPTION_INTERIM_QUARTERLY) {
      v = amountBase / 4;
    }
  } else {
    // 毎月 node
    if (ctax > CONSUMPTION_INTERIM_MONTHLY) {
      v = amountBase / 12;
    }
  }
  return floorTo(v, 100);
}

/**
 * 納税予定表（36行）を生成。各確定申告はその期自身の概算消費税で精算する。
 *
 * 確定 node: k%12===0（k/12 = 決算期 p）。
 *  - p===0: 法人税 = 年税額0 − 既納付0 ; 消費税 = FLOOR(概算消費税0 − 期中納付済0, 100)
 *  - p>=1 : 法人税 = 年税額p − 法人税中間(p-1) ; 消費税 = 概算消費税p − Σ当期中間
 * 法人税中間 node: k%12===6（ci=(k-6)/12）= IF(法人税額ci>20万, FLOOR(年税額ci/2,100), 0)
 * 消費税中間サイクル ci（確定#p と #(p+1) の間の k。第(p+1)期の中間）。
 * 中間納付は税法どおり **直前期の確定（=ここではシミュレーション値）消費税** ベース:
 *  - ci=0(k1..11)  = 第2期中間: ctaxBase=概算0, amountBase=概算0 → 確定#1で精算
 *  - ci=1(k13..23) = 第3期中間: ctaxBase=概算1, amountBase=概算1 → 確定#2で精算
 *  - ci=2(k25..35) = 第4期中間(窓外): ctaxBase=概算2, amountBase=概算2
 * 第1期(p=0)中の中間納付は窓外で発生するため、ユーザー手入力 prepaidTax で確定#0から控除する。
 * 源泉所得税(納期特例): その行の月が 1月/7月 のとき手入力（withholdingTax[month]）。
 */
export function buildTaxSchedule(
  periods: [PeriodTaxResult, PeriodTaxResult, PeriodTaxResult],
  input: TaxForecastState
): TaxScheduleRow[] {
  const est = periods.map((p) => p.estimatedConsumptionTax);
  const consumPrepaid0 = input.consumptionTax[0].prepaidTax;
  const corpPrepaid0 = input.corporateTax[0].prepaidTax;

  // 消費税中間サイクル設定（ci=0,1,2）。税法どおり「直前期の確定消費税」ベースで配賦。
  // 本ツールはシミュレーションなので、直前期の確定額を直前期の概算消費税で代用する。
  // ci=0(k1..11)=第2期中間→est[0] / ci=1(k13..23)=第3期中間→est[1] / ci=2(k25..35)=第4期中間(窓外)→est[2]
  const cycles = [
    { ctaxBase: est[0], amountBase: est[0] },
    { ctaxBase: est[1], amountBase: est[1] },
    { ctaxBase: est[2], amountBase: est[2] },
  ];

  // まず全行の消費税中間を計算（確定 node でサイクル合計を引くため先に出す）
  const consInterim = new Array<number>(SCHEDULE_LENGTH).fill(0);
  for (let k = 1; k < SCHEDULE_LENGTH; k++) {
    if (k % PERIOD_MONTHS === 0) {
      continue; // 確定 node
    }
    const ci = Math.floor(k / PERIOD_MONTHS); // 0,1,2
    const rel = k - ci * PERIOD_MONTHS; // 1..11
    const cyc = cycles[ci];
    consInterim[k] = consumptionInterim(rel, cyc.ctaxBase, cyc.amountBase);
  }

  const rows: TaxScheduleRow[] = [];
  for (let k = 0; k < SCHEDULE_LENGTH; k++) {
    const date = eomonth(
      input.fiscalPeriod.closingYear,
      input.fiscalPeriod.closingMonth,
      SCHEDULE_OFFSET + k
    );
    const month: MonthKey = `${date.year}-${String(date.month).padStart(2, "0")}`;
    const kinds: TaxScheduleKind[] = [];
    let corpAmount = 0;
    let consAmount = 0;

    // ── 確定申告 node ──
    if (k % PERIOD_MONTHS === 0) {
      const p = (k / PERIOD_MONTHS) as 0 | 1 | 2;
      kinds.push("kakutei");
      if (p === 0) {
        corpAmount = periods[0].annualTaxAmount - corpPrepaid0;
        // 第1期の確定 = 第1期概算 − 第1期 期中納付済 予定納税
        consAmount = floorTo(est[0] - consumPrepaid0, 100);
      } else {
        corpAmount = periods[p].annualTaxAmount - corpInterim(periods[p - 1]);
        // 概算消費税p − 直前サイクル(ci=p-1)の中間合計
        let sumPrev = 0;
        for (let j = (p - 1) * PERIOD_MONTHS + 1; j < p * PERIOD_MONTHS; j++) {
          sumPrev += consInterim[j];
        }
        consAmount = est[p] - sumPrev;
      }
    }

    // ── 法人税中間申告 node ──
    if (k % PERIOD_MONTHS === 6) {
      const ci = (k - 6) / PERIOD_MONTHS; // 0,1,2
      const v = corpInterim(periods[ci]);
      if (v !== 0) {
        corpAmount += v;
        kinds.push("corp-chukan");
      }
    }

    // ── 消費税中間 ──
    if (consInterim[k] !== 0) {
      consAmount += consInterim[k];
      kinds.push("consumption-interim");
    }

    // ── 源泉所得税(納期特例): 毎年 1月末 / 7月末 ──
    const isWithholdingInputRow = date.month === 1 || date.month === 7;
    let withholdingTaxAmount = 0;
    if (isWithholdingInputRow) {
      withholdingTaxAmount = input.withholdingTax[month] ?? 0;
      kinds.push("withholding");
    }

    rows.push({
      date,
      month,
      kinds,
      corporateTaxAmount: corpAmount,
      consumptionTaxAmount: consAmount,
      withholdingTaxAmount,
      isWithholdingInputRow,
    });
  }
  return rows;
}

/** 入力 → 全結果（純粋関数）。 */
export function calcTaxForecast(input: TaxForecastState): TaxForecastResult {
  const periods = calcPeriods(input);
  return { periods, schedule: buildTaxSchedule(periods, input) };
}

/** ───────────────── 冪等転記 ───────────────── */

/** 転記先科目（企画書で確定） */
const SUBJECT_CORP = "houjinzeiTou";
const SUBJECT_CONSUMPTION = "shouhizeiSozeiKouka";
const SUBJECT_WITHHOLDING = "shakaiHokenGensenJuumin";

type DeltaMap = Record<string, Record<MonthKey, number>>;

/**
 * 納税予定行 → 資金繰り cells への冪等加算転記。
 *
 * 新セル = 現セル − 前回delta + 新delta。prev∪next の全 (科目,月) を走査し、
 * 「前回 X → 今回 0」も引き戻す。0 は次回 deltas に残さない。
 * cells はディープコピーして返す（呼び出し側で原子置換）。
 */
export function computeTranscriptionCells(
  cells: Record<string, Record<MonthKey, number>>,
  prevDeltas: DeltaMap,
  rows: TaxScheduleRow[]
): { cells: Record<string, Record<MonthKey, number>>; nextDeltas: DeltaMap } {
  const next: DeltaMap = {};
  const addDelta = (sid: string, m: MonthKey, v: number) => {
    if (!v) {
      return;
    }
    (next[sid] ??= {});
    next[sid][m] = (next[sid][m] ?? 0) + v;
  };
  for (const r of rows) {
    addDelta(SUBJECT_CORP, r.month, r.corporateTaxAmount);
    addDelta(SUBJECT_CONSUMPTION, r.month, r.consumptionTaxAmount);
    addDelta(SUBJECT_WITHHOLDING, r.month, r.withholdingTaxAmount);
  }

  // ディープコピー
  const out: Record<string, Record<MonthKey, number>> = {};
  for (const [sid, row] of Object.entries(cells)) {
    out[sid] = { ...row };
  }

  // prev ∪ next の全キーを走査
  const sids = new Set<string>([
    ...Object.keys(prevDeltas),
    ...Object.keys(next),
  ]);
  for (const sid of sids) {
    const months = new Set<MonthKey>([
      ...Object.keys(prevDeltas[sid] ?? {}),
      ...Object.keys(next[sid] ?? {}),
    ]);
    for (const m of months) {
      const cur = out[sid]?.[m] ?? 0;
      const pd = prevDeltas[sid]?.[m] ?? 0;
      const nd = next[sid]?.[m] ?? 0;
      const v = cur - pd + nd;
      (out[sid] ??= {});
      out[sid][m] = v;
    }
  }
  return { cells: out, nextDeltas: next };
}

/** 転記取消: prev deltas を全セルから引き戻す。 */
export function revertTranscriptionCells(
  cells: Record<string, Record<MonthKey, number>>,
  prevDeltas: DeltaMap
): Record<string, Record<MonthKey, number>> {
  const out: Record<string, Record<MonthKey, number>> = {};
  for (const [sid, row] of Object.entries(cells)) {
    out[sid] = { ...row };
  }
  for (const [sid, row] of Object.entries(prevDeltas)) {
    for (const [m, v] of Object.entries(row)) {
      const cur = out[sid]?.[m] ?? 0;
      (out[sid] ??= {});
      out[sid][m] = cur - v;
    }
  }
  return out;
}

/** 既定の空転記スナップショット */
export function emptyAppliedTaxTranscription(): AppliedTaxTranscription {
  return { appliedAt: null, deltas: {} };
}
