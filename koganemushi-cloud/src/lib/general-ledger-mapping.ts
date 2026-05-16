/**
 * 相手勘定科目 → 資金繰り科目(subjectId) の決定論的ルール表と解決ロジック。
 *
 * 元帳サンプル年間の相手勘定科目は46種類のみ。大半はルールでカバーし、
 * 過負荷・曖昧な科目（未払金/諸口/仮払金 等）は "unmapped" として
 * 編集UI・AI補完で必ず表面化させる。
 * 自社口座間移動（資金諸口）・繰越（前期繰越）は null = 資金繰りから除外。
 */
import type {
  CpDescGroup,
  RawLedgerTxn,
  SubjectMappingEntry,
} from "@/types/general-ledger";

const EMPTY_CP_LABEL = "(空欄)";

type FlowDirection = "inflow" | "outflow";

/** 入出金で行先科目が変わる相手勘定科目（借入金など） */
interface DirectionRule {
  inflow: string;
  outflow: string;
}

type RuleValue = string | null | DirectionRule;

function isDirectionRule(v: RuleValue): v is DirectionRule {
  return typeof v === "object" && v !== null;
}

/**
 * 相手勘定科目 → subjectId。
 * - string: 単一科目
 * - null: 資金繰りから除外（資金移動・繰越）
 * - { inflow, outflow }: 入出金方向で振り分け
 * - 未登録: 解決時 "unmapped"
 */
export const COUNTERPARTY_RULES: Record<string, RuleValue> = {
  // 収入系
  売掛金: "uriageNyukin",
  売上高その他: "uriageNyukin",
  売上高フィーノ: "uriageNyukin",
  売上高口座振替: "uriageNyukin",
  売上戻り高: "uriageNyukin",
  雑収入: "sonotaKeijouShunyuu",
  受取利息: "uketoriRisokuHaitou",
  // 仕入・外注
  買掛金: "shiireShiharai",
  外注費: "gaichuuhi",
  業務委託料: "gaichuuhi",
  // 人件費・社保
  未払給与: "kyuuyoShouyo",
  法定福利費: "shakaiHokenGensenJuumin",
  預り金: "shakaiHokenGensenJuumin",
  // 販管費
  広告宣伝費: "koukokuHanbai",
  販売ロイヤリティ: "koukokuHanbai",
  交際費: "kousaiFukuri",
  旅費交通費: "ryohiKoutsuuShayou",
  賃借料: "chidaiYachinKounetsu",
  保険料: "hokenryou",
  支払手数料: "kaihiKomonTesuuryouSystem",
  支払報酬料: "kaihiKomonTesuuryouSystem",
  システム利用料: "kaihiKomonTesuuryouSystem",
  保守料: "kaihiKomonTesuuryouSystem",
  諸会費: "kaihiKomonTesuuryouSystem",
  研究開発費: "kenshuuKenkyuu",
  セミナー費用: "kenshuuKenkyuu",
  // 税金
  租税公課: "shouhizeiSozeiKouka",
  未払消費税等: "shouhizeiSozeiKouka",
  未払法人税等: "houjinzeiTou",
  // クレジットカード
  楽天カード: "creditCardShiharai",
  セゾンカード: "creditCardShiharai",
  JCBカード: "creditCardShiharai",
  // 投資・固定資産
  保険積立金: "teikiYokinToushi",
  ソフトウェア: "koteiShisanShutoku",
  // 財務
  支払利息: "shiharaiRisokuHoshou",
  短期借入金: { inflow: "tankiKariire", outflow: "tankiKariireHensai" },
  長期借入金: { inflow: "choukiKariire", outflow: "choukiKariireHensai" },
  役員借入金: {
    inflow: "yakuinKankeiKaishaKara",
    outflow: "yakuinKankeiKaishaHe",
  },
  // 除外（自社口座間移動・繰越）
  資金諸口: null,
  前期繰越: null,
  // 曖昧・過負荷な科目（諸口/未払金/長期未払金/短期貸付金/長期前払費用/
  // 仮受金/仮払金 等）は意図的に未登録 → resolveSubject で "unmapped" となり
  // 編集UI・AI補完で必ず判断させる。
};

export interface ResolveResult {
  subjectId: string | null;
  source: "rule" | "excluded" | "unmapped";
}

/** 相手勘定科目＋入出金方向から subjectId を解決 */
export function resolveSubject(
  counterparty: string,
  direction: FlowDirection,
): ResolveResult {
  if (!(counterparty in COUNTERPARTY_RULES)) {
    return { subjectId: null, source: "unmapped" };
  }
  const rule = COUNTERPARTY_RULES[counterparty];
  if (rule === null) {
    return { subjectId: null, source: "excluded" };
  }
  if (isDirectionRule(rule)) {
    return { subjectId: rule[direction], source: "rule" };
  }
  return { subjectId: rule, source: "rule" };
}

function txnDirection(t: RawLedgerTxn): FlowDirection {
  return t.inflow > 0 && t.outflow === 0 ? "inflow" : "outflow";
}

interface CpAcc {
  samples: string[];
  sampleSet: Set<string>;
  txnCount: number;
  totalAmount: number;
  inflowCount: number;
  outflowCount: number;
}

function newCpAcc(): CpAcc {
  return {
    samples: [],
    sampleSet: new Set(),
    txnCount: 0,
    totalAmount: 0,
    inflowCount: 0,
    outflowCount: 0,
  };
}

function addToCpAcc(acc: CpAcc, t: RawLedgerTxn): void {
  acc.txnCount++;
  acc.totalAmount += Math.abs(t.inflow) + Math.abs(t.outflow);
  if (txnDirection(t) === "inflow") {
    acc.inflowCount++;
  } else {
    acc.outflowCount++;
  }
  const desc = t.description.trim();
  if (desc && !acc.sampleSet.has(desc) && acc.samples.length < 5) {
    acc.sampleSet.add(desc);
    acc.samples.push(desc);
  }
}

/**
 * 非繰越トランザクションを相手勘定科目でグルーピングし、
 * ルール解決済みの編集可能マッピング表を生成。
 */
export function buildMappingTable(
  txns: RawLedgerTxn[],
): SubjectMappingEntry[] {
  const byCp = new Map<string, CpAcc>();
  const order: string[] = [];

  for (const t of txns) {
    if (t.isOpeningCarry) {
      continue;
    }
    const cp = t.counterpartyAccount || "(空欄)";
    let acc = byCp.get(cp);
    if (!acc) {
      acc = newCpAcc();
      byCp.set(cp, acc);
      order.push(cp);
    }
    addToCpAcc(acc, t);
  }

  const entries: SubjectMappingEntry[] = order.map((cp) => {
    const acc = byCp.get(cp)!;
    const dominant: FlowDirection =
      acc.inflowCount >= acc.outflowCount ? "inflow" : "outflow";
    const resolved = resolveSubject(cp, dominant);
    return {
      counterpartyAccount: cp,
      subjectId: resolved.subjectId,
      source: resolved.source,
      sampleDescriptions: acc.samples,
      txnCount: acc.txnCount,
      totalAmount: acc.totalAmount,
    };
  });

  return sortMappingEntries(entries);
}

/** 未割当(unmapped) を上に、その後 金額降順 */
function sortMappingEntries(
  entries: SubjectMappingEntry[],
): SubjectMappingEntry[] {
  return entries.sort((a, b) => {
    const au = a.source === "unmapped" ? 0 : 1;
    const bu = b.source === "unmapped" ? 0 : 1;
    if (au !== bu) {
      return au - bu;
    }
    return b.totalAmount - a.totalAmount;
  });
}

/**
 * 学習済みの相手勘定科目ルールをマッピング表に適用。
 * learnedCp[cp] があれば subjectId を上書きし source を "learned" に。
 * 適用後、既存コンパレータで再ソート。
 */
export function applyLearnedCp(
  mapping: SubjectMappingEntry[],
  learnedCp: Record<string, string | null>,
): SubjectMappingEntry[] {
  const applied = mapping.map((m) => {
    if (!Object.prototype.hasOwnProperty.call(learnedCp, m.counterpartyAccount)) {
      return m;
    }
    return {
      ...m,
      subjectId: learnedCp[m.counterpartyAccount],
      source: "learned" as const,
    };
  });
  return sortMappingEntries(applied);
}

interface DescAcc {
  txnCount: number;
  totalAmount: number;
  inflowCount: number;
  outflowCount: number;
}

/**
 * 非繰越トランザクションを 相手勘定科目 → 摘要(trim) で分解。
 * 諸口/未払金 等、摘要によって科目が異なる相手勘定科目を摘要単位で割り当てるための内訳。
 * 各 cp の配列は金額降順。
 */
export function buildCpDescBreakdown(
  txns: RawLedgerTxn[],
): Map<string, CpDescGroup[]> {
  const byCp = new Map<string, Map<string, DescAcc>>();

  for (const t of txns) {
    if (t.isOpeningCarry) {
      continue;
    }
    const cp = t.counterpartyAccount || EMPTY_CP_LABEL;
    const desc = t.description.trim();
    let descMap = byCp.get(cp);
    if (!descMap) {
      descMap = new Map();
      byCp.set(cp, descMap);
    }
    let acc = descMap.get(desc);
    if (!acc) {
      acc = { txnCount: 0, totalAmount: 0, inflowCount: 0, outflowCount: 0 };
      descMap.set(desc, acc);
    }
    acc.txnCount++;
    acc.totalAmount += Math.abs(t.inflow) + Math.abs(t.outflow);
    if (txnDirection(t) === "inflow") {
      acc.inflowCount++;
    } else {
      acc.outflowCount++;
    }
  }

  const result = new Map<string, CpDescGroup[]>();
  for (const [cp, descMap] of byCp) {
    const groups: CpDescGroup[] = Array.from(descMap.entries())
      .map(([description, a]) => ({
        description,
        txnCount: a.txnCount,
        totalAmount: a.totalAmount,
        dominantDirection:
          a.inflowCount >= a.outflowCount
            ? ("inflow" as const)
            : ("outflow" as const),
      }))
      .sort((x, y) => y.totalAmount - x.totalAmount);
    result.set(cp, groups);
  }
  return result;
}
