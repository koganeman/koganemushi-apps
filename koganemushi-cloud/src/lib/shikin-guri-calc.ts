import type {
  AccountRow,
  CashflowMatrix,
  MonthKey,
  SubjectSection,
  SubjectKind,
} from "@/types/shikin-guri";
import { SUBJECTS } from "@/lib/shikin-guri-subjects";

export const BALANCE_TOLERANCE = 1;

function getCell(matrix: CashflowMatrix, subjectId: string, month: MonthKey): number {
  return matrix.cells[subjectId]?.[month] ?? 0;
}

/**
 * 金融機関用資金繰り表（Excel "金融機関用" シート逐語）の行定義。
 * アプリ45科目を約20行へ集約する。各 row.subjectIds は合算対象の科目IDs。
 * 空配列はアプリ側に対応する科目がない（手形・現金売上等）→常に 0。
 */
export interface BankFormatRowDef {
  id: string;
  label: string;
  /** "income" or "expense"。表示と合計の符号判定に使用 */
  kind: "income" | "expense";
  /** 合算する科目ID（空ならアプリに該当科目なし） */
  subjectIds: string[];
}

export interface BankFormatSection {
  id: "keijou" | "keijouGai" | "zaimu";
  label: string;
  incomeRows: BankFormatRowDef[];
  expenseRows: BankFormatRowDef[];
}

/** Excel "金融機関用" シートの行構造（逐語移植） */
export const BANK_FORMAT_SECTIONS: BankFormatSection[] = [
  {
    id: "keijou",
    label: "経常収支",
    incomeRows: [
      { id: "gk_genkin_uriage", label: "現金売上", kind: "income", subjectIds: [] },
      { id: "gk_uri_kaishu", label: "売掛金現金回収", kind: "income", subjectIds: ["uriageNyukin"] },
      { id: "gk_tegata_kijitsu", label: "手形期日落", kind: "income", subjectIds: [] },
      { id: "gk_tegata_waribiki", label: "手形割引", kind: "income", subjectIds: [] },
      { id: "gk_sonota_shunyuu", label: "その他収入", kind: "income", subjectIds: ["sonotaKeijouShunyuu"] },
    ],
    expenseRows: [
      { id: "gk_genkin_shiire", label: "現金仕入", kind: "expense", subjectIds: [] },
      { id: "gk_kai_shiharai", label: "買掛金支払", kind: "expense", subjectIds: ["shiireShiharai"] },
      { id: "gk_tegata_kessai", label: "手形決済", kind: "expense", subjectIds: [] },
      { id: "gk_chingin_kyuuyo", label: "賃金給与", kind: "expense", subjectIds: ["kyuuyoShouyo"] },
      {
        id: "gk_sonota_keihi",
        label: "その他経費",
        kind: "expense",
        subjectIds: [
          "gaichuuhi",
          "shakaiHokenGensenJuumin",
          "koukokuHanbai",
          "kousaiFukuri",
          "ryohiKoutsuuShayou",
          "chidaiYachinKounetsu",
          "hokenryou",
          "kaihiKomonTesuuryouSystem",
          "kenshuuKenkyuu",
          "leaseKappu",
          "shuuzenSetsubiShoumouhin",
          "zappiGinkouTesuuryou",
          "sonotaHankanhi",
          "sonotaKeijouShishutsu",
          "genkinHikidashiQR",
          "creditCardShiharai",
          "shouhizeiSozeiKouka",
          "jigyoushuKashi",
        ],
      },
      { id: "gk_shiharai_risoku", label: "支払利息・割引料", kind: "expense", subjectIds: ["shiharaiRisokuHoshou"] },
    ],
  },
  {
    id: "keijouGai",
    label: "経常外収支",
    incomeRows: [
      { id: "gj_koteisisan_baikyaku", label: "固定資産等売却収入", kind: "income", subjectIds: ["koteiShisanBaikyaku"] },
      {
        id: "gj_sonota_keijougai_shunyuu",
        label: "その他経常外収入",
        kind: "income",
        subjectIds: ["hojokinJoseikin", "sonotaKeijouGaiShunyuu"],
      },
    ],
    expenseRows: [
      { id: "gj_zeikin", label: "税金", kind: "expense", subjectIds: ["houjinzeiTou"] },
      { id: "gj_koteisisan_shutoku", label: "固定資産等購入支払", kind: "expense", subjectIds: ["koteiShisanShutoku"] },
      { id: "gj_sonota_keijougai_shishutsu", label: "その他経常外支出", kind: "expense", subjectIds: ["sonotaKeijouGaiShishutsu"] },
    ],
  },
  {
    id: "zaimu",
    label: "財務収支",
    incomeRows: [
      { id: "zm_chouki_chotatsu", label: "長期借入金調達", kind: "income", subjectIds: ["choukiKariire"] },
      { id: "zm_tanki_chotatsu", label: "短期借入金調達", kind: "income", subjectIds: ["tankiKariire"] },
      { id: "zm_teikiyokin_kuzushi", label: "定期性預金取り崩し", kind: "income", subjectIds: ["teikiYokinKaiyaku"] },
      {
        id: "zm_sonota_zaimu_shunyuu",
        label: "その他財務収入",
        kind: "income",
        subjectIds: ["yakuinKankeiKaishaKara", "uketoriRisokuHaitou", "sonotaZaimuShunyuu"],
      },
    ],
    expenseRows: [
      { id: "zm_chouki_hensai", label: "長期借入金返済", kind: "expense", subjectIds: ["choukiKariireHensai"] },
      { id: "zm_tanki_hensai", label: "短期借入金返済", kind: "expense", subjectIds: ["tankiKariireHensai"] },
      { id: "zm_teikiyokin_azuke", label: "定期性預金預け入れ", kind: "expense", subjectIds: ["teikiYokinToushi"] },
      {
        id: "zm_sonota_zaimu_shishutsu",
        label: "その他財務支出",
        kind: "expense",
        subjectIds: ["yakuinKankeiKaishaHe", "sonotaZaimuShishutsu"],
      },
    ],
  },
];

/** 1セクションの月次集計結果 */
export interface BankFormatSectionResult {
  /** 行ID -> 月次値 */
  rowValues: Record<string, Record<MonthKey, number>>;
  /** 月次の収入合計 */
  incomeTotal: Record<MonthKey, number>;
  /** 月次の支出合計 */
  expenseTotal: Record<MonthKey, number>;
  /** 月次の純額（収入 - 支出） */
  net: Record<MonthKey, number>;
}

export interface BankFormatResult {
  sections: Record<"keijou" | "keijouGai" | "zaimu", BankFormatSectionResult>;
  /** 売上高 (情報行): 売掛金現金回収 と同じ（=uriageNyukin。アプリは accrual basis を持たないため cash basis で代用） */
  uriageDaka: Record<MonthKey, number>;
  /** 仕入・外注費 (情報行): 買掛金支払 + 外注費 */
  shiireGaichuu: Record<MonthKey, number>;
  /** 総合収支（経常+経常外+財務 の純額） */
  totalNet: Record<MonthKey, number>;
  /** 前月繰越現金（月の opening） */
  opening: Record<MonthKey, number>;
  /** 翌月繰越現金（月の closing） */
  closing: Record<MonthKey, number>;
}

/**
 * 金融機関用資金繰り表の月次集計。
 * 売上高 / 仕入・外注費 は発生主義のためアプリ側に値を持たない。
 * manualInput が渡されればその値を使う。未指定または値が無い月は 0。
 */
export function calcBankFormat(
  matrix: CashflowMatrix,
  months: MonthKey[],
  manualInput?: {
    uriageDaka?: Record<MonthKey, number>;
    shiireGaichuu?: Record<MonthKey, number>;
  }
): BankFormatResult {
  const sumIds = (ids: string[], m: MonthKey): number => {
    let s = 0;
    for (const id of ids) {
      s += getCell(matrix, id, m);
    }
    return s;
  };

  const sections = {} as BankFormatResult["sections"];
  for (const sec of BANK_FORMAT_SECTIONS) {
    const rowValues: Record<string, Record<MonthKey, number>> = {};
    const incomeTotal: Record<MonthKey, number> = {};
    const expenseTotal: Record<MonthKey, number> = {};
    const net: Record<MonthKey, number> = {};
    for (const m of months) {
      let inc = 0;
      let exp = 0;
      for (const row of sec.incomeRows) {
        const v = sumIds(row.subjectIds, m);
        (rowValues[row.id] ??= {})[m] = v;
        inc += v;
      }
      for (const row of sec.expenseRows) {
        const v = sumIds(row.subjectIds, m);
        (rowValues[row.id] ??= {})[m] = v;
        exp += v;
      }
      incomeTotal[m] = inc;
      expenseTotal[m] = exp;
      net[m] = inc - exp;
    }
    sections[sec.id] = { rowValues, incomeTotal, expenseTotal, net };
  }

  const uriageDaka: Record<MonthKey, number> = {};
  const shiireGaichuu: Record<MonthKey, number> = {};
  const totalNet: Record<MonthKey, number> = {};
  const opening: Record<MonthKey, number> = {};
  const closing: Record<MonthKey, number> = {};
  let prevClosing = matrix.openingBalance;
  for (let i = 0; i < months.length; i++) {
    const m = months[i];
    uriageDaka[m] = manualInput?.uriageDaka?.[m] ?? 0;
    shiireGaichuu[m] = manualInput?.shiireGaichuu?.[m] ?? 0;
    totalNet[m] = sections.keijou.net[m] + sections.keijouGai.net[m] + sections.zaimu.net[m];
    const op = i === 0 ? matrix.openingBalance : prevClosing;
    opening[m] = op;
    const cl = op + totalNet[m];
    closing[m] = cl;
    prevClosing = cl;
  }

  return {
    sections,
    uriageDaka,
    shiireGaichuu,
    totalNet,
    opening,
    closing,
  };
}

/** 残高グラフの2本の基準線（資金余裕残高 / 危機対応可能残高）と算出根拠 */
export interface BalanceChartReferenceLines {
  /** 資金余裕残高 = 売上入金 月平均 × 2 */
  adequateCash: number;
  /** 危機対応可能残高 = 固定費 月平均合計 × 3 */
  crisisResilientCash: number;
  /** 売上入金の月平均（算出根拠表示用） */
  salesMonthlyAvg: number;
  /** 固定費の月平均合計（算出根拠表示用） */
  fixedCostMonthlyAvg: number;
  /** 平均算出に使ったサンプル月数（最大: 売上 or 固定費のどちらか多い方） */
  sampleMonthCount: number;
  /** 過去実績ゼロでフォールバック（全月平均）を使った場合 true */
  usedForecastFallback: boolean;
}

/**
 * 残高グラフ用の基準線を算出。
 * - 売上入金: 過去（m <= currentMonth）の非ゼロ月の平均。0件なら全月へフォールバック。
 * - 固定費: 各科目の月平均（同上）を合算。
 */
export function calcBalanceChartReferenceLines(
  cashflow: CashflowMatrix,
  months: MonthKey[],
  currentMonth: MonthKey,
  fixedCostSubjectIds: string[]
): BalanceChartReferenceLines {
  const pastMonths = months.filter((m) => m <= currentMonth);

  const avgForSubject = (
    subjectId: string,
    candidateMonths: MonthKey[]
  ): { avg: number; count: number } => {
    const nonZero = candidateMonths
      .map((m) => getCell(cashflow, subjectId, m))
      .filter((v) => v !== 0);
    if (nonZero.length === 0) {
      return { avg: 0, count: 0 };
    }
    const sum = nonZero.reduce((a, b) => a + b, 0);
    return { avg: sum / nonZero.length, count: nonZero.length };
  };

  let usedForecastFallback = false;

  let salesResult = avgForSubject("uriageNyukin", pastMonths);
  if (salesResult.count === 0) {
    salesResult = avgForSubject("uriageNyukin", months);
    if (salesResult.count > 0) {
      usedForecastFallback = true;
    }
  }

  let fixedTotal = 0;
  let fixedSampleCount = 0;
  for (const sid of fixedCostSubjectIds) {
    let r = avgForSubject(sid, pastMonths);
    if (r.count === 0) {
      r = avgForSubject(sid, months);
      if (r.count > 0) {
        usedForecastFallback = true;
      }
    }
    fixedTotal += r.avg;
    if (r.count > fixedSampleCount) {
      fixedSampleCount = r.count;
    }
  }

  return {
    adequateCash: salesResult.avg * 2,
    crisisResilientCash: fixedTotal * 3,
    salesMonthlyAvg: salesResult.avg,
    fixedCostMonthlyAvg: fixedTotal,
    sampleMonthCount: Math.max(salesResult.count, fixedSampleCount),
    usedForecastFallback,
  };
}

/** 指定セクション・種別の科目IDを取得 */
export function getSubjectIds(section: SubjectSection, kind: SubjectKind): string[] {
  return SUBJECTS.filter((s) => s.section === section && s.kind === kind).map((s) => s.id);
}

/** 月ごとの (セクション × 種別) 合計 */
export function sumSection(
  matrix: CashflowMatrix,
  months: MonthKey[],
  section: SubjectSection,
  kind: SubjectKind
): Record<MonthKey, number> {
  const ids = getSubjectIds(section, kind);
  const result: Record<MonthKey, number> = {};
  for (const m of months) {
    let total = 0;
    for (const id of ids) {
      total += getCell(matrix, id, m);
    }
    result[m] = total;
  }
  return result;
}

/** 収入 - 支出 */
export function subtractMonthly(
  income: Record<MonthKey, number>,
  expense: Record<MonthKey, number>,
  months: MonthKey[]
): Record<MonthKey, number> {
  const r: Record<MonthKey, number> = {};
  for (const m of months) {
    r[m] = (income[m] ?? 0) - (expense[m] ?? 0);
  }
  return r;
}

/** 3つのセクション収支の和 */
export function sumNetMonthly(
  ...nets: Record<MonthKey, number>[]
): Record<MonthKey, number> {
  const r: Record<MonthKey, number> = {};
  for (const net of nets) {
    for (const [k, v] of Object.entries(net)) {
      r[k] = (r[k] ?? 0) + v;
    }
  }
  return r;
}

export interface CashflowDerived {
  keijouIncome: Record<MonthKey, number>;
  keijouExpense: Record<MonthKey, number>;
  keijouNet: Record<MonthKey, number>;
  keijouGaiIncome: Record<MonthKey, number>;
  keijouGaiExpense: Record<MonthKey, number>;
  keijouGaiNet: Record<MonthKey, number>;
  zaimuIncome: Record<MonthKey, number>;
  zaimuExpense: Record<MonthKey, number>;
  zaimuNet: Record<MonthKey, number>;
  monthlyNet: Record<MonthKey, number>;
  opening: Record<MonthKey, number>;
  closing: Record<MonthKey, number>;
}

/** 資金繰り表の全派生値を一括計算 */
export function deriveCashflow(matrix: CashflowMatrix, months: MonthKey[]): CashflowDerived {
  const keijouIncome = sumSection(matrix, months, "keijou", "income");
  const keijouExpense = sumSection(matrix, months, "keijou", "expense");
  const keijouNet = subtractMonthly(keijouIncome, keijouExpense, months);

  const keijouGaiIncome = sumSection(matrix, months, "keijouGai", "income");
  const keijouGaiExpense = sumSection(matrix, months, "keijouGai", "expense");
  const keijouGaiNet = subtractMonthly(keijouGaiIncome, keijouGaiExpense, months);

  const zaimuIncome = sumSection(matrix, months, "zaimu", "income");
  const zaimuExpense = sumSection(matrix, months, "zaimu", "expense");
  const zaimuNet = subtractMonthly(zaimuIncome, zaimuExpense, months);

  const monthlyNet: Record<MonthKey, number> = {};
  for (const m of months) {
    monthlyNet[m] = (keijouNet[m] ?? 0) + (keijouGaiNet[m] ?? 0) + (zaimuNet[m] ?? 0);
  }

  const opening: Record<MonthKey, number> = {};
  const closing: Record<MonthKey, number> = {};
  let prevClosing = matrix.openingBalance;
  for (let i = 0; i < months.length; i++) {
    const m = months[i];
    const op = i === 0 ? matrix.openingBalance : prevClosing;
    opening[m] = op;
    const cl = op + (monthlyNet[m] ?? 0);
    closing[m] = cl;
    prevClosing = cl;
  }

  return {
    keijouIncome,
    keijouExpense,
    keijouNet,
    keijouGaiIncome,
    keijouGaiExpense,
    keijouGaiNet,
    zaimuIncome,
    zaimuExpense,
    zaimuNet,
    monthlyNet,
    opening,
    closing,
  };
}

export interface AccountDerived {
  total: Record<MonthKey, number>;
  /** その月に1口座でも残高入力がある */
  hasData: Record<MonthKey, boolean>;
  /** 前月との差 */
  momDelta: Record<MonthKey, number>;
}

export function deriveAccounts(accounts: AccountRow[], months: MonthKey[]): AccountDerived {
  const total: Record<MonthKey, number> = {};
  const hasData: Record<MonthKey, boolean> = {};
  const momDelta: Record<MonthKey, number> = {};
  for (const m of months) {
    let sum = 0;
    let any = false;
    for (const acc of accounts) {
      if (acc.balances[m] !== undefined) {
        sum += acc.balances[m];
        any = true;
      }
    }
    total[m] = sum;
    hasData[m] = any;
  }
  for (let i = 0; i < months.length; i++) {
    const m = months[i];
    const prev = i === 0 ? 0 : total[months[i - 1]] ?? 0;
    momDelta[m] = (total[m] ?? 0) - prev;
  }
  return { total, hasData, momDelta };
}

export interface ConsistencyIssue {
  month: MonthKey;
  closing: number;
  accountTotal: number;
  diff: number;
}

/** 期末現預金残高と口座残高合計の不一致月を返す */
export function checkConsistency(
  derived: CashflowDerived,
  accounts: AccountDerived,
  months: MonthKey[],
  tolerance: number = BALANCE_TOLERANCE
): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];
  for (const m of months) {
    if (!accounts.hasData[m]) { continue; }
    const closing = derived.closing[m] ?? 0;
    const total = accounts.total[m] ?? 0;
    const diff = closing - total;
    if (Math.abs(diff) > tolerance) {
      issues.push({ month: m, closing, accountTotal: total, diff });
    }
  }
  return issues;
}

/** 月が予測月（current より後）か */
export function isForecastMonth(month: MonthKey, currentMonth: MonthKey): boolean {
  return month > currentMonth;
}
