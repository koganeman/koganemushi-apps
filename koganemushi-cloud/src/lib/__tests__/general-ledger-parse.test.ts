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
