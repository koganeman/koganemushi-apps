import type { LedgerWorkState } from "@/stores/shikin-guri-store";
import type { ParsedLedger } from "@/types/general-ledger";

/** 取引0件時の原因別エラーメッセージ */
export function ledgerEmptyMessage(p: ParsedLedger): string {
  if (p.headerFound) {
    return "ヘッダー行は見つかりましたが有効な取引行がありません。日付列の形式（YYYY/M/D・YYYY-MM-DD 等）や列構成をご確認ください。";
  }
  return "総勘定元帳として解釈できませんでした（freee / MFクラウド / 弥生会計のヘッダー行を検出できません）。文字コードや出力形式をご確認ください。";
}

/** 期間内の月だけに絞った cellsBySubject を返す */
export function filterCellsToPeriod(
  cellsBySubject: Record<string, Record<string, number>>,
  periodMonths: Set<string>,
): Record<string, Record<string, number>> {
  const filtered: Record<string, Record<string, number>> = {};
  for (const [subjectId, row] of Object.entries(cellsBySubject)) {
    const inRow: Record<string, number> = {};
    for (const [m, v] of Object.entries(row)) {
      if (periodMonths.has(m)) {
        inRow[m] = v;
      }
    }
    if (Object.keys(inRow).length > 0) {
      filtered[subjectId] = inRow;
    }
  }
  return filtered;
}

export function errMessage(prefix: string, err: unknown): string {
  return `${prefix}: ${err instanceof Error ? err.message : String(err)}`;
}

const EMPTY_MAPPING: LedgerWorkState["mapping"] = [];
const EMPTY_OVERRIDES: LedgerWorkState["overrides"] = {};
const EMPTY_CPDESC: LedgerWorkState["cpDescAssignments"] = {};
const EMPTY_OFFSET: LedgerWorkState["offsetKeys"] = {};

/** ledgerWork から各部分を取り出す（null時は安定した空参照） */
export function piecesOf(work: LedgerWorkState | null) {
  if (!work) {
    return {
      parsed: null,
      mapping: EMPTY_MAPPING,
      overrides: EMPTY_OVERRIDES,
      cpDescAssignments: EMPTY_CPDESC,
      offsetKeys: EMPTY_OFFSET,
      accountsCsv: null,
    };
  }
  return {
    parsed: work.parsed,
    mapping: work.mapping,
    overrides: work.overrides,
    cpDescAssignments: work.cpDescAssignments,
    offsetKeys: work.offsetKeys,
    accountsCsv: work.accountsCsv,
  };
}
