/**
 * 総勘定元帳（会計ソフトエクスポート）→ 資金繰り実績表 / 明細表 変換パイプライン 型定義
 */
import type { MonthKey } from "@/types/shikin-guri";

/** 元帳1行を正規化したトランザクション */
export interface RawLedgerTxn {
  /** col0 勘定科目（= 現金 / 銀行口座などの台帳名） */
  accountLedger: string;
  /** col1 取引日 "YYYY/M/D"（原文のまま） */
  date: string;
  /** 取引日から導出した月キー "YYYY-MM" */
  monthKey: MonthKey;
  /** col3 相手勘定科目 */
  counterpartyAccount: string;
  /** col18 取引内容（明細表の摘要ベース。空なら取引先等にフォールバック） */
  description: string;
  /** col20 借方金額（資産台帳では入金） */
  inflow: number;
  /** col21 貸方金額（資産台帳では出金） */
  outflow: number;
  /** col22 残高（取引後残高） */
  balance: number;
  /** 相手勘定科目==="前期繰越" の繰越行 */
  isOpeningCarry: boolean;
}

/** 各台帳の前期繰越（期首残高）。繰越行が無い台帳は先頭行から逆算 */
export interface OpeningBalance {
  accountLedger: string;
  monthKey: MonthKey;
  balance: number;
}

/** 検出した総勘定元帳フォーマット */
export type LedgerFormatId = "freee" | "mfcloud" | "yayoi" | "unknown";

export interface ParsedLedger {
  txns: RawLedgerTxn[];
  openingBalances: OpeningBalance[];
  /** 非繰越トランザクションの月キー昇順ユニーク */
  months: MonthKey[];
  /** 出現した台帳名（出現順） */
  accountLedgers: string[];
  /** スキップした行数（タイトル・ヘッダー・不正行） */
  skippedRows: number;
  /** いずれかのプロファイルのヘッダー署名を検出したか */
  headerFound: boolean;
  /** 検出フォーマットID（未検出は "unknown"） */
  formatId: LedgerFormatId;
  /** 検出フォーマット表示名（未検出は null） */
  formatName: string | null;
}

/** マッピングの由来 */
export type MappingSource =
  | "rule"
  | "ai"
  | "manual"
  | "excluded"
  | "unmapped"
  | "learned";

/**
 * 学習ルール（手動/AI修正を永続化し次回取込で自動適用）。
 * cp: 相手勘定科目 → subjectId|null（null=除外）
 * cpDesc: cpDescKey(相手勘定科目,摘要) → subjectId|null
 */
export interface LearnedRules {
  version: 1;
  cp: Record<string, string | null>;
  cpDesc: Record<string, string | null>;
}

/** 相手勘定科目 → 資金繰り科目 の1エントリ（UIで編集可能） */
export interface SubjectMappingEntry {
  counterpartyAccount: string;
  /** null = 除外（資金移動等） or 未割当 */
  subjectId: string | null;
  source: MappingSource;
  /** AI推定時のみ 0..1 */
  confidence?: number;
  /** UI表示・AIプロンプト用の摘要サンプル（最大5件） */
  sampleDescriptions: string[];
  txnCount: number;
  /** 入出金の絶対額合計（参考表示用） */
  totalAmount: number;
}

/** 中間ファイル（アップロード用.csv）1行 */
export interface IntermediateRow {
  /** 取引日 "YYYY/M/D" */
  date: string;
  /** 出金金額 */
  outflow: number;
  /** 入金金額 */
  inflow: number;
  /** 取引後残高 */
  balance: number;
  /** 摘要内容 = 取引内容 + " " + 相手勘定科目 */
  summary: string;
}

/** AIマッピングAPI 入力1件 */
export interface AiMappingRequestItem {
  counterpartyAccount: string;
  sampleDescriptions: string[];
  /** 指定時は (相手勘定科目, 摘要) 単位で分類（摘要分解用） */
  description?: string;
}

/** AIマッピングAPI 出力1件 */
export interface AiMappingResultItem {
  counterpartyAccount: string;
  /** 入力に description があればエコー（摘要分解の照合用） */
  description?: string;
  /** SUBJECTS の id。判断不能/資金移動は null */
  subjectId: string | null;
  confidence: number;
  reason: string;
}

/**
 * 摘要単位の科目分解割当。
 * key = `${counterpartyAccount}${description}`（相手勘定科目＋摘要）。
 * value = 割当 subjectId（null = 除外）。未登録なら相手勘定科目マッピングに従う。
 * 相手勘定科目マッピングより優先される（解決の最優先層）。
 */
export type CpDescAssignments = Record<string, string | null>;

/**
 * 逆方向フロー検出1行。
 * 割り当てた科目の収支区分(kind)と実際の入出金方向が逆のため、
 * 集計では金額0計上となり現金移動が残高チェックに漏れている明細。
 */
export interface ReverseFlowRow {
  counterpartyAccount: string;
  description: string;
  /** 明細行上書きキー（baseSubjectId + 摘要）。ワンクリック上書きに使用 */
  overrideKey: string;
  /** マッピング/分解で決まる科目（上書き前） */
  baseSubjectId: string;
  /** 現在の実効科目 */
  subjectId: string;
  /** 実効科目の収支区分 */
  kind: "income" | "expense";
  txnCount: number;
  /** 集計から漏れている逆方向の金額合計 */
  leakedAmount: number;
}

/**
 * 消込確定キー集合。key = `${subjectId}${amount}`（資金繰り科目＋金額）。
 * true のキーは入金=出金 同額ペアを資金移動同様に集計除外する。
 */
export type OffsetKeys = Record<string, boolean>;

/** 消込候補（資金繰り科目＋同額の入金/出金ペア） */
export interface OffsetCandidate {
  /** offsetKeys のキー（subjectId + 金額） */
  key: string;
  subjectId: string;
  /** 1件あたりの金額（入金=出金 同額） */
  amount: number;
  /** 消込可能ペア数 = min(入金件数, 出金件数) */
  pairCount: number;
  /** 消込総額 = amount × pairCount（片側合計） */
  offsetTotal: number;
  /** 入金側件数 / 出金側件数（同額・同科目内） */
  inflowCount: number;
  outflowCount: number;
  /** 摘要サンプル（入金側・出金側、各最大3） */
  inflowSamples: string[];
  outflowSamples: string[];
  /** ユーザーが消込確定済か */
  confirmed: boolean;
}

/** aggregatePipeline の調整入力 */
export interface PipelineAdjustments {
  descriptionOverrides?: DescriptionOverrides;
  cpDescAssignments?: CpDescAssignments;
  offsetKeys?: OffsetKeys;
}

/** 残高不一致の原因分類 */
export type DiscrepancyCategory = "transfer" | "excluded" | "reverse";

/** 残高不一致への寄与グループ（相手勘定科目＋摘要単位） */
export interface DiscrepancyGroup {
  category: DiscrepancyCategory;
  counterpartyAccount: string;
  description: string;
  /** 摘要分解の上書きキー（cpDescKey） */
  cpDescKey: string;
  txnCount: number;
  /** 集計に反映されていない署名フロー Σ(入-出 のうち未計上分) */
  leakedSigned: number;
  /** 差異(算出期末−元帳期末)への寄与額 = -leakedSigned */
  diffContribution: number;
}

/** 残高不一致の自動診断結果 */
export interface DiscrepancyDiagnosis {
  /** 期首+Σ全署名フロー − 台帳最終残高合計（0なら元帳・パーサ健全） */
  ledgerIntegrityDiff: number;
  /** 最終月の差異（算出期末 − 元帳期末合計） */
  finalDiff: number;
  /** 資金移動(資金諸口)として除外された純額の差異寄与 */
  transferContribution: number;
  /** その他除外（未割当等）の差異寄与 */
  excludedContribution: number;
  /** 逆方向フローの差異寄与 */
  reverseContribution: number;
  /** 上記3要素で説明できる合計 */
  explained: number;
  /** finalDiff − explained（0付近なら全要因を説明済） */
  residual: number;
  /** 寄与の大きい順グループ（|diffContribution| 降順） */
  groups: DiscrepancyGroup[];
}

/** 相手勘定科目を摘要で分解した1グループ */
export interface CpDescGroup {
  description: string;
  txnCount: number;
  /** 入出金の絶対額合計 */
  totalAmount: number;
  dominantDirection: "inflow" | "outflow";
}

/**
 * 明細行単位の科目上書き。
 * key = `${baseSubjectId}${description}`（マッピング既定で決まる科目＋摘要）。
 * value = 上書き先 subjectId（null = 除外）。未登録ならマッピング既定に従う。
 */
export type DescriptionOverrides = Record<string, string | null>;

/** 明細表プレビュー1行（科目上書きUI用） */
export interface MeisaiPreviewRow {
  /** 上書きマップのキー（マッピング既定科目＋摘要で安定） */
  overrideKey: string;
  /** マッピング既定で決まる科目（上書き前） */
  baseSubjectId: string;
  /** 実効科目（上書き適用後） */
  subjectId: string;
  description: string;
  amounts: Record<MonthKey, number>;
}

/** 収支整合性リコンサイル1行 */
export interface ReconcileRow {
  monthKey: MonthKey;
  /** 前月末（初月は期首現預金残高） */
  openingOrPrev: number;
  /** 当月収支（収入－支出） */
  net: number;
  /** 算出期末 = openingOrPrev + net */
  derivedClosing: number;
  /** 元帳の当月末残高合計（全台帳・繰越込み） */
  ledgerClosingTotal: number;
  /** 口座残高一覧表の当月末残高合計（未アップロードは null） */
  uploadedClosingTotal: number | null;
  /** derivedClosing - ledgerClosingTotal */
  diffLedger: number;
  /** derivedClosing - uploadedClosingTotal（uploaded が null なら null） */
  diffUploaded: number | null;
}

/** 口座残高一覧表との突合結果1行 */
export interface BalanceCheckRow {
  accountLedger: string;
  monthKey: MonthKey;
  /** 元帳から算出した当月末残高 */
  ledgerBalance: number;
  /** アップロードされた口座残高一覧表の当月末残高（無ければ null） */
  uploadedBalance: number | null;
  /** ledgerBalance - uploadedBalance（uploadedBalance が null なら null） */
  diff: number | null;
  matched: boolean;
}
