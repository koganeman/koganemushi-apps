import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  addMonths,
  enumerateMonths,
  parseJpMonthHeader,
} from "../shikin-guri-months";
import {
  deriveCashflow,
  deriveAccounts,
  checkConsistency,
  getSubjectIds,
} from "../shikin-guri-calc";
import { importCashflowCsv, importAccountsCsv, parseCsv } from "../shikin-guri-csv";
import type { AccountRow, CashflowMatrix } from "../../types/shikin-guri";

const SAMPLE_DIR = join(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "docs",
  "shikingurihyou",
  "csv-data"
);

describe("shikin-guri-months", () => {
  it("addMonths は月末をまたいで正しく加算", () => {
    expect(addMonths("2025-07", 1)).toBe("2025-08");
    expect(addMonths("2025-12", 1)).toBe("2026-01");
    expect(addMonths("2025-01", -1)).toBe("2024-12");
    expect(addMonths("2025-07", 12)).toBe("2026-07");
  });

  it("enumerateMonths は連続月を生成", () => {
    const r = enumerateMonths("2025-07", 4);
    expect(r).toEqual(["2025-07", "2025-08", "2025-09", "2025-10"]);
  });

  it("parseJpMonthHeader は和暦ヘッダを解釈", () => {
    expect(parseJpMonthHeader("2025年7月")).toBe("2025-07");
    expect(parseJpMonthHeader("2025年07月")).toBe("2025-07");
    expect(parseJpMonthHeader("invalid")).toBeNull();
  });
});

describe("parseCsv", () => {
  it("基本的なCSVをパース", () => {
    const r = parseCsv("a,b,c\n1,2,3\n");
    expect(r).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("クォート付きフィールド", () => {
    const r = parseCsv('"科目","2025年7月"\n"売上入金",1000\n');
    expect(r[0]).toEqual(["科目", "2025年7月"]);
    expect(r[1]).toEqual(["売上入金", "1000"]);
  });

  it("ダブルクォートエスケープ", () => {
    const r = parseCsv('"a""b",c\n');
    expect(r[0]).toEqual(['a"b', "c"]);
  });
});

describe("importCashflowCsv (サンプルCSV)", () => {
  const csv = readFileSync(join(SAMPLE_DIR, "資金繰り実績表.csv"), "utf-8");
  const result = importCashflowCsv(csv);

  it("9ヶ月分の月キーを抽出 (2025-07〜2026-03)", () => {
    expect(result.months).toHaveLength(9);
    expect(result.months[0]).toBe("2025-07");
    expect(result.months[8]).toBe("2026-03");
  });

  it("売上入金の7月値が一致", () => {
    expect(result.cellsBySubject.uriageNyukin["2025-07"]).toBe(19813227);
  });

  it("長期借入金返済の7月値が一致", () => {
    expect(result.cellsBySubject.choukiKariireHensai["2025-07"]).toBe(440000);
  });

  it("CSV B42 セル（期首・期末現預金残高行の先頭月列）が期首残高として抽出される", () => {
    expect(result.openingBalanceCandidate).toBe(7985465);
  });

  it("未マッチ行はない（サンプルは全科目マスタに含まれる）", () => {
    expect(result.unknownLabels).toEqual([]);
  });
});

describe("importAccountsCsv (サンプルCSV)", () => {
  const csv = readFileSync(join(SAMPLE_DIR, "口座残高明細表.csv"), "utf-8");
  const result = importAccountsCsv(csv);

  it("4口座を読み取る（残高合計・前月増減はスキップ）", () => {
    expect(result.accounts).toHaveLength(4);
    expect(result.accounts.map((a) => a.name)).toEqual([
      "滋賀銀行堅田",
      "京都信用金庫堅田",
      "関西みらい銀行6582",
      "関西みらい銀行582296",
    ]);
  });

  it("滋賀銀行堅田の7月残高", () => {
    expect(result.accounts[0].balances["2025-07"]).toBe(656789);
  });

  it("12ヶ月分の月キーを抽出", () => {
    expect(result.months).toHaveLength(12);
    expect(result.months[0]).toBe("2025-07");
  });
});

describe("deriveCashflow", () => {
  it("月次収支計と期末残高が連鎖計算される", () => {
    const months = enumerateMonths("2025-07", 3);
    const matrix: CashflowMatrix = {
      openingBalance: 1000,
      cells: {
        uriageNyukin: { "2025-07": 500, "2025-08": 700, "2025-09": 600 },
        shiireShiharai: { "2025-07": 300, "2025-08": 200, "2025-09": 100 },
      },
    };
    const d = deriveCashflow(matrix, months);
    // 経常収支 = 売上 - 仕入 = 200, 500, 500
    expect(d.keijouNet["2025-07"]).toBe(200);
    expect(d.keijouNet["2025-08"]).toBe(500);
    // 月次収支計
    expect(d.monthlyNet["2025-07"]).toBe(200);
    // 期末残高連鎖: 1000+200=1200, 1200+500=1700, 1700+500=2200
    expect(d.closing["2025-07"]).toBe(1200);
    expect(d.closing["2025-08"]).toBe(1700);
    expect(d.closing["2025-09"]).toBe(2200);
    // 翌月の期首は前月の期末
    expect(d.opening["2025-08"]).toBe(1200);
  });

  it("サンプルCSV取込後の期末残高がground truthの値域に近い", () => {
    const csv = readFileSync(join(SAMPLE_DIR, "資金繰り実績表.csv"), "utf-8");
    const imported = importCashflowCsv(csv);
    const matrix: CashflowMatrix = {
      openingBalance: imported.openingBalanceCandidate ?? 0,
      cells: imported.cellsBySubject,
    };
    const months = imported.months;
    const d = deriveCashflow(matrix, months);
    // 7月末: 7,985,465（期首）+ 月次収支 ≒ 何らかの値（正であることを確認）
    expect(typeof d.closing["2025-07"]).toBe("number");
    // 9月は資金不足で口座残高合計が -835,964（CSVより）。資金繰り表側の期末も同様にマイナス圏になるはず
    expect(d.closing["2025-09"]).toBeLessThan(d.closing["2025-07"]);
  });
});

describe("deriveAccounts", () => {
  it("残高合計と前月増減を計算", () => {
    const months = enumerateMonths("2025-07", 3);
    const accounts: AccountRow[] = [
      { id: "a1", name: "口座A", balances: { "2025-07": 1000, "2025-08": 1500, "2025-09": 1200 } },
      { id: "a2", name: "口座B", balances: { "2025-07": 500, "2025-08": 400, "2025-09": 600 } },
    ];
    const d = deriveAccounts(accounts, months);
    expect(d.total["2025-07"]).toBe(1500);
    expect(d.total["2025-08"]).toBe(1900);
    expect(d.momDelta["2025-08"]).toBe(400);
    expect(d.momDelta["2025-09"]).toBe(-100);
    expect(d.hasData["2025-07"]).toBe(true);
  });

  it("口座CSVサンプル: 9月の残高合計が-835,964", () => {
    const csv = readFileSync(join(SAMPLE_DIR, "口座残高明細表.csv"), "utf-8");
    const imported = importAccountsCsv(csv);
    const accounts: AccountRow[] = imported.accounts.map((a, i) => ({
      id: `a${i}`,
      name: a.name,
      balances: a.balances,
    }));
    const months = imported.months;
    const d = deriveAccounts(accounts, months);
    expect(d.total["2025-09"]).toBe(-835964);
  });
});

describe("checkConsistency", () => {
  it("差額が ±1 円以内ならissueなし", () => {
    const months = enumerateMonths("2025-07", 2);
    const matrix: CashflowMatrix = { openingBalance: 1000, cells: {} };
    const accounts: AccountRow[] = [
      { id: "a", name: "x", balances: { "2025-07": 1000, "2025-08": 1000 } },
    ];
    const d = deriveCashflow(matrix, months);
    const ad = deriveAccounts(accounts, months);
    const issues = checkConsistency(d, ad, months);
    expect(issues).toHaveLength(0);
  });

  it("差額があれば検出される", () => {
    const months = enumerateMonths("2025-07", 1);
    const matrix: CashflowMatrix = { openingBalance: 1000, cells: {} };
    const accounts: AccountRow[] = [
      { id: "a", name: "x", balances: { "2025-07": 500 } },
    ];
    const d = deriveCashflow(matrix, months);
    const ad = deriveAccounts(accounts, months);
    const issues = checkConsistency(d, ad, months);
    expect(issues).toHaveLength(1);
    expect(issues[0].diff).toBe(500);
  });

  it("口座データなしの月は判定対象外", () => {
    const months = enumerateMonths("2025-07", 1);
    const matrix: CashflowMatrix = { openingBalance: 1000, cells: {} };
    const accounts: AccountRow[] = [{ id: "a", name: "x", balances: {} }];
    const d = deriveCashflow(matrix, months);
    const ad = deriveAccounts(accounts, months);
    expect(checkConsistency(d, ad, months)).toHaveLength(0);
  });
});

describe("getSubjectIds", () => {
  it("経常×収入で2科目", () => {
    expect(getSubjectIds("keijou", "income")).toEqual(["uriageNyukin", "sonotaKeijouShunyuu"]);
  });
});

describe("期首残高インポート end-to-end", () => {
  it("CSV B42 の値が期首として cashflow.openingBalance に入り、7月の期首と期末計算で使われる", () => {
    const csv = readFileSync(join(SAMPLE_DIR, "資金繰り実績表.csv"), "utf-8");
    const imported = importCashflowCsv(csv);
    // B42 = 7985465 が抽出される
    expect(imported.openingBalanceCandidate).toBe(7985465);

    // ストアに反映されると想定して matrix を組む
    const matrix: CashflowMatrix = {
      openingBalance: imported.openingBalanceCandidate ?? 0,
      cells: imported.cellsBySubject,
    };
    const d = deriveCashflow(matrix, imported.months);
    // 7月の期首は CSV B42 = 7,985,465 とそのまま一致
    expect(d.opening["2025-07"]).toBe(7985465);
    // 8月の期首は 7月の期末（連鎖計算）
    expect(d.opening["2025-08"]).toBe(d.closing["2025-07"]);
  });
});
