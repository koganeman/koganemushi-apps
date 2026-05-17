/**
 * 総勘定元帳フォーマットプロファイル層。
 *
 * 会計ソフトごとに列構成・ヘッダー署名が異なるため、各ソフトを
 * LedgerFormatProfile として定義し、parseGeneralLedger がヘッダー署名で
 * 自動判定・ディスパッチする。現状 freee / MFクラウド の2プロファイル。
 * 弥生/TKC/JDL/MJS/ICS は実サンプル入手時に LEDGER_PROFILES へ追加する。
 */
import { monthKey } from "@/lib/shikin-guri-months";
import type { MonthKey } from "@/types/shikin-guri";
import type { LedgerFormatId, RawLedgerTxn } from "@/types/general-ledger";

export const OPENING_CARRY_LABEL = "前期繰越";

/** 1データ行をプロファイルで解釈した結果（= RawLedgerTxn と同形） */
export type ProfileRowFields = RawLedgerTxn;

export interface LedgerFormatProfile {
  id: LedgerFormatId;
  name: string;
  /** 必要最小列数 */
  minCols: number;
  /** ヘッダー署名行のインデックス。無ければ -1 */
  findHeaderIndex(rows: string[][]): number;
  /** 判定スコア（0=不一致、大きいほど確度が高い） */
  detectScore(rows: string[][]): number;
  /** データ行を解釈。無効行（ヘッダー・合計・日付不正等）は null */
  parseRow(row: string[]): ProfileRowFields | null;
  /** 繰越行が無い台帳の期首を先頭行から逆算するか（freeeは繰越行前提でfalse） */
  deriveOpeningWhenMissing: boolean;
}

/** row[i] を安全に取り出してトリム（未定義は ""） */
function cell(row: string[], i: number): string {
  return (row[i] ?? "").trim();
}

/** "1,234" / "▲145" 等 → 整数。符号付き。空・不正は 0 */
export function parseAmount(s: string | undefined): number {
  if (s === undefined) {
    return 0;
  }
  const cleaned = s.replace(/,/g, "").replace(/[^\d.\-]/g, "");
  if (cleaned === "" || cleaned === "-") {
    return 0;
  }
  const n = parseInt(cleaned, 10);
  return isNaN(n) ? 0 : n;
}

/**
 * "YYYY/M/D" / "YYYY-MM-DD" / "YYYY.M.D" → MonthKey。解釈不能なら null。
 * 区切りは / - . のいずれも許容（会計ソフトによりスラッシュ/ハイフン差あり）。
 */
export function dateToMonthKey(s: string): MonthKey | null {
  const m = /^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})$/.exec(s.trim());
  if (!m) {
    return null;
  }
  return monthKey(parseInt(m[1], 10), parseInt(m[2], 10));
}

/** "YYYY/M/D" 等 → 比較用整数 YYYYMMDD。解釈不能なら null */
export function dateToOrdinal(s: string): number | null {
  const m = /^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})$/.exec(s.trim());
  if (!m) {
    return null;
  }
  return (
    parseInt(m[1], 10) * 10000 +
    parseInt(m[2], 10) * 100 +
    parseInt(m[3], 10)
  );
}

// ---------------------------------------------------------------------------
// freee プロファイル（23列・ヘッダー1列目="勘定科目"）
//   0 勘定科目 / 1 取引日 / 2 決算整理仕訳 / 3 相手勘定科目 / 4 税区分 /
//   5 取引先 / 6 品目 / 7 部門 / 8 管理番号 / 9 メモタグ / 10 備考 /
//   11 勘定科目コード / 12 相手取引先 / 13 相手品目 / 14 相手部門 /
//   15 相手メモタグ / 16 相手備考 / 17 相手勘定科目コード / 18 取引内容 /
//   19 発行元 / 20 借方金額 / 21 貸方金額 / 22 残高
// ---------------------------------------------------------------------------
const FREEE_COL = {
  accountLedger: 0,
  date: 1,
  counterpartyAccount: 3,
  torihikisaki: 5,
  description: 18,
  hakkomoto: 19,
  inflow: 20,
  outflow: 21,
  balance: 22,
} as const;
const FREEE_MIN_COLS = 23;

function freeePickDescription(
  row: string[],
  counterpartyAccount: string,
): string {
  const candidates = [
    cell(row, FREEE_COL.description),
    cell(row, FREEE_COL.torihikisaki),
    cell(row, FREEE_COL.hakkomoto),
  ];
  for (const v of candidates) {
    if (v !== "") {
      return v;
    }
  }
  return counterpartyAccount;
}

const freeeProfile: LedgerFormatProfile = {
  id: "freee",
  name: "freee",
  minCols: FREEE_MIN_COLS,
  deriveOpeningWhenMissing: false,
  findHeaderIndex(rows) {
    for (let i = 0; i < rows.length; i++) {
      if (cell(rows[i], 0) === "勘定科目") {
        return i;
      }
    }
    return -1;
  },
  detectScore(rows) {
    const idx = this.findHeaderIndex(rows);
    if (idx < 0) {
      return 0;
    }
    return cell(rows[idx], 1) === "取引日" ? 2 : 1;
  },
  parseRow(row) {
    if (row.length < FREEE_MIN_COLS) {
      return null;
    }
    const accountLedger = cell(row, FREEE_COL.accountLedger);
    const date = cell(row, FREEE_COL.date);
    const mk = dateToMonthKey(date);
    if (!accountLedger || !mk) {
      return null;
    }
    const counterpartyAccount = cell(row, FREEE_COL.counterpartyAccount);
    return {
      accountLedger,
      date,
      monthKey: mk,
      counterpartyAccount,
      description: freeePickDescription(row, counterpartyAccount),
      inflow: parseAmount(row[FREEE_COL.inflow]),
      outflow: parseAmount(row[FREEE_COL.outflow]),
      balance: parseAmount(row[FREEE_COL.balance]),
      isOpeningCarry: counterpartyAccount === OPENING_CARRY_LABEL,
    };
  },
};

// ---------------------------------------------------------------------------
// MFクラウド 総勘定元帳プロファイル（18列・ヘッダー1列目="取引No"）
//   0 取引No / 1 取引日 / 2 勘定科目 / 3 補助科目 / 4 取引先 / 5 税区分 /
//   6 インボイス / 7 相手勘定科目 / 8 相手補助科目 / 9 相手取引先 /
//   10 相手税区分 / 11 相手インボイス / 12 摘要 / 13 借方金額 /
//   14 貸方金額 / 15 残高 / 16 メモ / 17 タグ
//
// 単一勘定の総勘定元帳エクスポート: col2(勘定科目)=閲覧中の台帳、
// col7(相手勘定科目)=相手科目、col13/14=台帳の入金/出金、col15=取引後残高。
// 台帳名は勘定科目のみ（補助科目で分けない）。MFの残高列は勘定科目単位の
// 連続残高で補助科目をまたぐため、補助で分割すると残高整合が崩れるため。
// freeeも台帳=勘定科目単位なので整合する。
// ---------------------------------------------------------------------------
const MF_COL = {
  date: 1,
  account: 2,
  counterparty: 7,
  description: 12,
  inflow: 13,
  outflow: 14,
  balance: 15,
} as const;
const MF_MIN_COLS = 18;

const mfCloudProfile: LedgerFormatProfile = {
  id: "mfcloud",
  name: "MFクラウド",
  minCols: MF_MIN_COLS,
  deriveOpeningWhenMissing: true,
  findHeaderIndex(rows) {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (
        cell(r, 0) === "取引No" &&
        cell(r, MF_COL.account) === "勘定科目" &&
        cell(r, MF_COL.counterparty) === "相手勘定科目"
      ) {
        return i;
      }
    }
    return -1;
  },
  detectScore(rows) {
    return this.findHeaderIndex(rows) >= 0 ? 3 : 0;
  },
  parseRow(row) {
    if (row.length < MF_MIN_COLS) {
      return null;
    }
    const accountLedger = cell(row, MF_COL.account);
    const date = cell(row, MF_COL.date);
    const mk = dateToMonthKey(date);
    if (!accountLedger || !mk) {
      return null;
    }
    const counterpartyAccount = cell(row, MF_COL.counterparty);
    const desc = cell(row, MF_COL.description);
    return {
      accountLedger,
      date,
      monthKey: mk,
      counterpartyAccount,
      description: desc || counterpartyAccount,
      inflow: parseAmount(row[MF_COL.inflow]),
      outflow: parseAmount(row[MF_COL.outflow]),
      balance: parseAmount(row[MF_COL.balance]),
      // MFは繰越行が摘要="前期繰越"。未検出でも0フロー先頭行の逆算で期首一致
      isOpeningCarry: desc === OPENING_CARRY_LABEL,
    };
  },
};

// ---------------------------------------------------------------------------
// 弥生会計 総勘定元帳プロファイル（汎用形式・33列）
// 先頭は複数行のメタ情報。col0 が行種別マーカー:
//   [表題行]=ヘッダー / [前期繰越行] / [明細行]=データ /
//   [月度合計行] [累計行] [翌期繰越行]=スキップ。
// [表題行] の列（col0除く実体）:
//   1部門 2勘定科目 3補助科目 4日付 5伝票No. 6作業日付 7仕訳番号 8決算
//   9調整 10付箋1 11付箋2 12タイプ 13生成元 14部門 15税区分 16税計算区分
//   17相手勘定科目 18相手補助科目 19相手部門 20相手税区分 21相手税計算区分
//   22借方金額 23借方税額 24貸方金額 25貸方税額 26残高 27摘要 28請求書区分
//   29仕入税額控除 30期日 31番号 32仕訳メモ
//
// 残高(col26)は勘定科目単位の連続残高で補助科目をまたぐため、台帳名は
// 勘定科目(col2)のみ（補助で分割すると残高整合が崩れる。MFと同じ）。
// [前期繰越行]は日付列が空のためtxn化されない。期首は先頭明細行から
// 逆算（deriveOpeningWhenMissing=true。先頭明細の残高は繰越込みなので
// opening=残高−(入−出) が正しい期首になる）。
// ---------------------------------------------------------------------------
const YAYOI_COL = {
  account: 2,
  sub: 3,
  date: 4,
  counterparty: 17,
  inflow: 22,
  outflow: 24,
  balance: 26,
  description: 27,
} as const;
const YAYOI_MIN_COLS = 28;
const YAYOI_HEADER_MARK = "[表題行]";
const YAYOI_DETAIL_MARK = "[明細行]";

const yayoiProfile: LedgerFormatProfile = {
  id: "yayoi",
  name: "弥生会計",
  minCols: YAYOI_MIN_COLS,
  deriveOpeningWhenMissing: true,
  findHeaderIndex(rows) {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (
        cell(r, 0) === YAYOI_HEADER_MARK &&
        cell(r, YAYOI_COL.account) === "勘定科目" &&
        cell(r, YAYOI_COL.counterparty) === "相手勘定科目"
      ) {
        return i;
      }
    }
    return -1;
  },
  detectScore(rows) {
    return this.findHeaderIndex(rows) >= 0 ? 3 : 0;
  },
  parseRow(row) {
    if (row.length < YAYOI_MIN_COLS || cell(row, 0) !== YAYOI_DETAIL_MARK) {
      return null;
    }
    const accountLedger = cell(row, YAYOI_COL.account);
    const date = cell(row, YAYOI_COL.date);
    const mk = dateToMonthKey(date);
    if (!accountLedger || !mk) {
      return null;
    }
    const counterpartyAccount = cell(row, YAYOI_COL.counterparty);
    const desc = cell(row, YAYOI_COL.description);
    return {
      accountLedger,
      date,
      monthKey: mk,
      counterpartyAccount,
      description: desc || counterpartyAccount,
      inflow: parseAmount(row[YAYOI_COL.inflow]),
      outflow: parseAmount(row[YAYOI_COL.outflow]),
      balance: parseAmount(row[YAYOI_COL.balance]),
      // 繰越は[前期繰越行](日付空でtxn化されない)＋逆算で対応
      isOpeningCarry: false,
    };
  },
};

/** 判定順（同点は配列順で優先） */
export const LEDGER_PROFILES: LedgerFormatProfile[] = [
  mfCloudProfile,
  yayoiProfile,
  freeeProfile,
];

/**
 * 全プロファイルを試し、ヘッダー署名が見つかった中で detectScore 最大の
 * プロファイルを返す。どれも該当しなければ null。
 */
export function detectProfile(
  rows: string[][],
): { profile: LedgerFormatProfile; headerIdx: number } | null {
  let best: { profile: LedgerFormatProfile; headerIdx: number; score: number } | null =
    null;
  for (const profile of LEDGER_PROFILES) {
    const headerIdx = profile.findHeaderIndex(rows);
    if (headerIdx < 0) {
      continue;
    }
    const score = profile.detectScore(rows);
    if (score <= 0) {
      continue;
    }
    if (!best || score > best.score) {
      best = { profile, headerIdx, score };
    }
  }
  return best ? { profile: best.profile, headerIdx: best.headerIdx } : null;
}
