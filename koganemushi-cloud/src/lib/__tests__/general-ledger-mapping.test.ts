import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { decodeLedgerBytes } from "../general-ledger-decode";
import { parseGeneralLedger } from "../general-ledger-parse";
import {
  resolveSubject,
  buildMappingTable,
  buildCpDescBreakdown,
  applyLearnedCp,
} from "../general-ledger-mapping";
import { SUBJECT_BY_ID } from "../shikin-guri-subjects";

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

function loadParsed() {
  const buf = readFileSync(
    join(SAMPLE_DIR, "総勘定元帳 （2025年07月~2026年06月）.csv"),
  );
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return parseGeneralLedger(decodeLedgerBytes(ab as ArrayBuffer));
}

describe("general-ledger-mapping resolveSubject", () => {
  it("売掛金は売上入金にルール解決される", () => {
    expect(resolveSubject("売掛金", "inflow")).toEqual({
      subjectId: "uriageNyukin",
      source: "rule",
    });
  });

  it("資金諸口・前期繰越は除外(excluded)", () => {
    expect(resolveSubject("資金諸口", "outflow").source).toBe("excluded");
    expect(resolveSubject("資金諸口", "outflow").subjectId).toBeNull();
    expect(resolveSubject("前期繰越", "inflow").source).toBe("excluded");
  });

  it("長期借入金は入出金方向で科目が切り替わる", () => {
    expect(resolveSubject("長期借入金", "inflow").subjectId).toBe(
      "choukiKariire",
    );
    expect(resolveSubject("長期借入金", "outflow").subjectId).toBe(
      "choukiKariireHensai",
    );
  });

  it("曖昧・未登録の相手勘定科目は unmapped", () => {
    expect(resolveSubject("諸口", "outflow").source).toBe("unmapped");
    expect(resolveSubject("未払金", "outflow").source).toBe("unmapped");
    expect(resolveSubject("存在しない科目", "inflow").source).toBe("unmapped");
  });

  it("ルールが返す subjectId は全て実在の科目", () => {
    const parsed = loadParsed();
    const cps = new Set(
      parsed.txns
        .filter((t) => !t.isOpeningCarry)
        .map((t) => t.counterpartyAccount),
    );
    for (const cp of cps) {
      for (const dir of ["inflow", "outflow"] as const) {
        const r = resolveSubject(cp, dir);
        if (r.subjectId !== null) {
          expect(SUBJECT_BY_ID[r.subjectId]).toBeTruthy();
        }
      }
    }
  });
});

describe("general-ledger-mapping buildMappingTable", () => {
  it("全相手勘定科目が表に現れ、未割当が先頭に並ぶ", () => {
    const parsed = loadParsed();
    const table = buildMappingTable(parsed.txns);
    expect(table.length).toBeGreaterThan(30);
    // 未割当が存在し、先頭グループに固まる
    const firstMapped = table.findIndex((e) => e.source !== "unmapped");
    const lastUnmapped =
      table.length -
      1 -
      [...table].reverse().findIndex((e) => e.source === "unmapped");
    if (firstMapped >= 0 && table.some((e) => e.source === "unmapped")) {
      expect(lastUnmapped).toBeLessThan(firstMapped);
    }
    const uriage = table.find((e) => e.counterpartyAccount === "売掛金");
    expect(uriage?.subjectId).toBe("uriageNyukin");
    expect(uriage?.sampleDescriptions.length).toBeGreaterThan(0);
    expect(uriage!.sampleDescriptions.length).toBeLessThanOrEqual(5);
  });
});

describe("general-ledger-mapping buildCpDescBreakdown", () => {
  const parsed = loadParsed();
  const breakdown = buildCpDescBreakdown(parsed.txns);

  it("諸口・未払金は複数の distinct 摘要に分解される", () => {
    const shokuchi = breakdown.get("諸口");
    expect(shokuchi && shokuchi.length).toBeGreaterThan(1);
    const mibarai = breakdown.get("未払金");
    expect(mibarai && mibarai.length).toBeGreaterThanOrEqual(1);
  });

  it("各グループは件数・金額・優勢方向を持ち金額降順", () => {
    const groups = breakdown.get("諸口")!;
    for (const g of groups) {
      expect(g.txnCount).toBeGreaterThan(0);
      expect(g.totalAmount).toBeGreaterThanOrEqual(0);
      expect(["inflow", "outflow"]).toContain(g.dominantDirection);
    }
    for (let i = 1; i < groups.length; i++) {
      expect(groups[i - 1].totalAmount).toBeGreaterThanOrEqual(
        groups[i].totalAmount,
      );
    }
  });

  it("cp内の摘要件数合計はマッピング表の件数と一致", () => {
    const table = buildMappingTable(parsed.txns);
    const entry = table.find((e) => e.counterpartyAccount === "諸口");
    const groups = breakdown.get("諸口")!;
    const sum = groups.reduce((s, g) => s + g.txnCount, 0);
    expect(sum).toBe(entry?.txnCount);
  });
});

describe("applyLearnedCp", () => {
  const parsed = loadParsed();

  it("学習cpルールが subjectId を上書きし source=learned に", () => {
    const base = buildMappingTable(parsed.txns);
    // 未割当の諸口を学習で sonotaKeijouShishutsu に
    const learned = { 諸口: "sonotaKeijouShishutsu", 仮受金: null };
    const applied = applyLearnedCp(base, learned);
    const shoguchi = applied.find((e) => e.counterpartyAccount === "諸口");
    expect(shoguchi?.subjectId).toBe("sonotaKeijouShishutsu");
    expect(shoguchi?.source).toBe("learned");
    const kari = applied.find((e) => e.counterpartyAccount === "仮受金");
    expect(kari?.subjectId).toBeNull();
    expect(kari?.source).toBe("learned");
  });

  it("学習が無いエントリは不変、件数も保持", () => {
    const base = buildMappingTable(parsed.txns);
    const applied = applyLearnedCp(base, { 諸口: "sonotaKeijouShishutsu" });
    expect(applied.length).toBe(base.length);
    const uri = applied.find((e) => e.counterpartyAccount === "売掛金");
    expect(uri?.subjectId).toBe("uriageNyukin");
    expect(uri?.source).toBe("rule");
  });

  it("空の学習ルールでは実質不変", () => {
    const base = buildMappingTable(parsed.txns);
    const applied = applyLearnedCp(base, {});
    expect(applied.map((e) => e.counterpartyAccount)).toEqual(
      base.map((e) => e.counterpartyAccount),
    );
  });
});
