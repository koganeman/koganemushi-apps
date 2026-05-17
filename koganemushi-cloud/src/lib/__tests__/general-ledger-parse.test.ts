import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { decodeLedgerBytes } from "../general-ledger-decode";
import { parseGeneralLedger } from "../general-ledger-parse";

const SAMPLE_DIR = join(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "docs",
  "shikinguri_jisseki",
  "sample_csv",
);

function loadRawLedger(): string {
  const buf = readFileSync(
    join(SAMPLE_DIR, "総勘定元帳 （2025年07月~2026年06月）.csv"),
  );
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return decodeLedgerBytes(ab as ArrayBuffer);
}

describe("general-ledger-decode", () => {
  it("Shift-JIS元帳を正しくデコードしヘッダー列が読める", () => {
    const text = loadRawLedger();
    expect(text).toContain("勘定科目,取引日");
    expect(text).toContain("相手勘定科目");
    expect(text).toContain("借方金額,貸方金額,残高");
  });
});

describe("general-ledger-parse", () => {
  const parsed = parseGeneralLedger(loadRawLedger());

  it("タイトル行・ヘッダー行はスキップされトランザクションが抽出される", () => {
    expect(parsed.txns.length).toBeGreaterThan(700);
    expect(parsed.skippedRows).toBeGreaterThanOrEqual(2);
  });

  it("複数の台帳（口座）が出現順で取得される", () => {
    expect(parsed.accountLedgers.length).toBeGreaterThan(1);
    expect(parsed.accountLedgers).toContain("現金");
  });

  it("前期繰越行は isOpeningCarry=true かつ openingBalances に入る", () => {
    const carries = parsed.txns.filter((t) => t.isOpeningCarry);
    expect(carries.length).toBeGreaterThan(0);
    expect(parsed.openingBalances.length).toBe(carries.length);
    const paypay = parsed.openingBalances.find(
      (o) => o.accountLedger.includes("ＰａｙＰａｙ") && o.balance === 793199,
    );
    expect(paypay).toBeTruthy();
  });

  it("月キーは2025-07始まりの昇順（データ存在分のみ・〜2026-06内）", () => {
    expect(parsed.months[0]).toBe("2025-07");
    expect(parsed.months[parsed.months.length - 1] <= "2026-06").toBe(true);
    expect(parsed.months).toEqual([...parsed.months].sort());
  });

  it("入金行は inflow に金額、残高は整数で取れる", () => {
    const t = parsed.txns.find(
      (x) => x.inflow === 82500 && x.counterpartyAccount === "売掛金",
    );
    expect(t).toBeTruthy();
    expect(t!.outflow).toBe(0);
    expect(Number.isInteger(t!.balance)).toBe(true);
  });

  it("負残高（現金マイナス）も符号付きで取れる", () => {
    const neg = parsed.txns.find((t) => t.balance < 0);
    expect(neg).toBeTruthy();
  });
});

describe("general-ledger-parse 日付区切り・ヘッダー判定", () => {
  const HEADER =
    '"勘定科目","取引日","決算整理仕訳","相手勘定科目","税区分","取引先",' +
    '"品目","部門","管理番号","メモタグ","備考","勘定科目コード","相手取引先",' +
    '"相手品目","相手部門","相手メモタグ","相手備考","相手勘定科目コード",' +
    '"取引内容","発行元","借方金額","貸方金額","残高"';
  const TITLE = '"総勘定元帳 (2025年07月~2026年06月）"';
  const rowWith = (date: string) =>
    `"現金","${date}","0","売掛金","対象外","テスト","","","","","","",` +
    `"テスト","","","","","142","振込 テスト","","50000","","50000"`;

  it("ハイフン日付 YYYY-MM-DD（全項目クォート）を解釈できる", () => {
    const csv = [TITLE, HEADER, rowWith("2025-08-10")].join("\r\n");
    const p = parseGeneralLedger(csv);
    expect(p.headerFound).toBe(true);
    expect(p.txns.length).toBe(1);
    expect(p.txns[0].monthKey).toBe("2025-08");
    expect(p.txns[0].inflow).toBe(50000);
  });

  it("スラッシュ/ドット日付も従来通り解釈できる", () => {
    const slash = parseGeneralLedger(
      [TITLE, HEADER, rowWith("2025/8/10")].join("\r\n"),
    );
    expect(slash.txns[0]?.monthKey).toBe("2025-08");
    const dot = parseGeneralLedger(
      [TITLE, HEADER, rowWith("2025.8.10")].join("\r\n"),
    );
    expect(dot.txns[0]?.monthKey).toBe("2025-08");
  });

  it("ヘッダー無しは headerFound=false", () => {
    const p = parseGeneralLedger("a,b,c\r\n1,2,3");
    expect(p.headerFound).toBe(false);
    expect(p.txns.length).toBe(0);
  });

  it("ヘッダー有・日付不正は headerFound=true だが txns 0", () => {
    const p = parseGeneralLedger(
      [TITLE, HEADER, rowWith("2025年8月10日")].join("\r\n"),
    );
    expect(p.headerFound).toBe(true);
    expect(p.txns.length).toBe(0);
  });
});

function loadMfLedger(): string {
  const buf = readFileSync(
    join(SAMPLE_DIR, "MF総勘定元帳_20260517_1515.csv"),
  );
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return decodeLedgerBytes(ab as ArrayBuffer);
}

describe("フォーマット自動判定", () => {
  it("freeeサンプルは formatId=freee", () => {
    const p = parseGeneralLedger(loadRawLedger());
    expect(p.formatId).toBe("freee");
    expect(p.formatName).toBe("freee");
    expect(p.headerFound).toBe(true);
  });

  it("MFクラウドサンプルは formatId=mfcloud", () => {
    const p = parseGeneralLedger(loadMfLedger());
    expect(p.formatId).toBe("mfcloud");
    expect(p.formatName).toBe("MFクラウド");
    expect(p.headerFound).toBe(true);
  });

  it("どのプロファイルにも該当しないCSVは unknown / headerFound=false", () => {
    const p = parseGeneralLedger("a,b,c\r\n1,2,3");
    expect(p.formatId).toBe("unknown");
    expect(p.formatName).toBe(null);
    expect(p.headerFound).toBe(false);
    expect(p.txns.length).toBe(0);
  });

  it("freee は繰越行前提のため期首逆算は発火しない（openingBalances=繰越件数）", () => {
    const p = parseGeneralLedger(loadRawLedger());
    const carries = p.txns.filter((t) => t.isOpeningCarry);
    expect(p.openingBalances.length).toBe(carries.length);
  });
});

describe("MFクラウド総勘定元帳パース", () => {
  const p = parseGeneralLedger(loadMfLedger());

  it("206データ行を抽出（ヘッダー1行スキップ）", () => {
    expect(p.txns.length).toBe(206);
    expect(p.skippedRows).toBeGreaterThanOrEqual(1);
  });

  it("台帳名は勘定科目単位（補助科目で分割しない＝残高連続性を保つ）", () => {
    expect(p.accountLedgers.length).toBeGreaterThan(1);
    expect(p.accountLedgers).toContain("普通預金");
    expect(p.accountLedgers).toContain("当座預金");
    expect(p.accountLedgers.some((l) => l.includes(" / "))).toBe(false);
  });

  it("入金行は col13→inflow / col15→balance（取引No 2: 1,075,637）", () => {
    const t = p.txns.find((x) => x.inflow === 1075637);
    expect(t).toBeTruthy();
    expect(t!.outflow).toBe(0);
    expect(t!.balance).toBe(1159224);
    expect(t!.counterpartyAccount).not.toBe("");
  });

  it("出金行は col14→outflow（残高が前行から減少）", () => {
    const t = p.txns.find((x) => x.outflow === 280000);
    expect(t).toBeTruthy();
    expect(t!.inflow).toBe(0);
  });

  it("繰越行が無いので全台帳で期首を逆算（台帳数=openingBalances数）", () => {
    expect(p.txns.every((t) => !t.isOpeningCarry)).toBe(true);
    expect(p.openingBalances.length).toBe(p.accountLedgers.length);
  });

  it("台帳ごと 期首 + Σ(入金−出金) == 最終残高（列マッピング整合）", () => {
    const ord = (d: string): number => {
      const m = /^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})$/.exec(d.trim());
      return m
        ? parseInt(m[1], 10) * 10000 +
            parseInt(m[2], 10) * 100 +
            parseInt(m[3], 10)
        : -1;
    };
    for (const ledger of p.accountLedgers) {
      const rows = p.txns.filter((t) => t.accountLedger === ledger);
      const opening = p.openingBalances.find(
        (o) => o.accountLedger === ledger,
      )!.balance;
      const net = rows.reduce((s, t) => s + t.inflow - t.outflow, 0);
      // 取引日最大（同日はファイル末尾）の行の残高
      const last = rows.reduce(
        (acc, t) => {
          const o = ord(t.date);
          return o >= acc.ord ? { ord: o, bal: t.balance } : acc;
        },
        { ord: -1, bal: 0 },
      );
      expect(opening + net).toBe(last.bal);
    }
  });
});
