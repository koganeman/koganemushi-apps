import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { decodeLedgerBytes } from "../general-ledger-decode";
import { parseGeneralLedger } from "../general-ledger-parse";
import {
  buildMappingTable,
  resolveSubject,
  buildCpDescBreakdown,
} from "../general-ledger-mapping";
import {
  aggregatePipeline,
  buildIntermediateRows,
  cashflowResultToCsv,
  meisaiResultToCsv,
  intermediateToCsv,
  cpDescKey,
  meisaiOverrideKey,
} from "../general-ledger-pipeline";
import { OPENING_BALANCE_LABEL, SUBJECT_BY_ID } from "../shikin-guri-subjects";
import { formatJpMonth } from "../shikin-guri-months";
import type { RawLedgerTxn, SubjectMappingEntry } from "../../types/general-ledger";

function dirOf(t: RawLedgerTxn): "inflow" | "outflow" {
  return t.inflow > 0 && t.outflow === 0 ? "inflow" : "outflow";
}

/** aggregatePipeline と同じロジックで1txnの寄与額を再計算 */
function expectedFlow(
  t: RawLedgerTxn,
  mapping: SubjectMappingEntry[],
): number {
  if (t.isOpeningCarry) {
    return 0;
  }
  const entry = mapping.find(
    (e) => e.counterpartyAccount === (t.counterpartyAccount || "(空欄)"),
  );
  if (!entry) {
    return 0;
  }
  const sid =
    entry.source === "rule"
      ? resolveSubject(t.counterpartyAccount, dirOf(t)).subjectId
      : entry.subjectId;
  if (sid === null || !SUBJECT_BY_ID[sid]) {
    return 0;
  }
  return SUBJECT_BY_ID[sid].kind === "income" ? t.inflow : t.outflow;
}

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

describe("general-ledger-pipeline aggregatePipeline", () => {
  const parsed = loadParsed();
  const mapping = buildMappingTable(parsed.txns);
  const result = aggregatePipeline(parsed, mapping);

  it("月キーは2025-07から始まり連続昇順（データ存在分のみ）", () => {
    expect(result.months[0]).toBe("2025-07");
    expect(result.months).toEqual([...result.months].sort());
    expect(result.months.length).toBeGreaterThanOrEqual(1);
    expect(result.months.at(-1)! <= "2026-06").toBe(true);
  });

  it("資金諸口（資金移動）は集計から除外される", () => {
    expect(result.excludedCount).toBeGreaterThan(0);
    // 資金諸口txn数ぶんは少なくとも除外されている
    const shikinTxns = parsed.txns.filter(
      (t) => t.counterpartyAccount === "資金諸口" && !t.isOpeningCarry,
    ).length;
    expect(result.excludedCount).toBeGreaterThanOrEqual(shikinTxns);
  });

  it("売上入金は売上系相手勘定科目の入金合計と一致する（元帳再計算ベース）", () => {
    const expected = parsed.txns
      .filter((t) => {
        if (t.isOpeningCarry) {
          return false;
        }
        const dir = t.inflow > 0 && t.outflow === 0 ? "inflow" : "outflow";
        return (
          resolveSubject(t.counterpartyAccount, dir).subjectId ===
          "uriageNyukin"
        );
      })
      .reduce((s, t) => s + t.inflow, 0);
    const got = Object.values(
      result.cashflow.cellsBySubject["uriageNyukin"] ?? {},
    ).reduce((s, v) => s + v, 0);
    expect(got).toBe(expected);
  });

  it("非除外トランザクションのフロー合計と資金繰り表の総合計が一致する", () => {
    const cellTotal = Object.values(result.cashflow.cellsBySubject)
      .flatMap((row) => Object.values(row))
      .reduce((s, v) => s + v, 0);
    const flowTotal = parsed.txns.reduce(
      (sum, t) => sum + expectedFlow(t, mapping),
      0,
    );
    expect(cellTotal).toBe(flowTotal);
  });

  it("期首残高は前期繰越合計", () => {
    const expected = parsed.openingBalances
      .filter((o) => o.monthKey <= result.months[0])
      .reduce((s, o) => s + o.balance, 0);
    expect(result.openingBalanceFirstMonth).toBe(expected);
    expect(result.cashflow.openingBalanceCandidate).toBe(expected);
  });

  it("明細表の全ゼロ行は除外される", () => {
    for (const row of result.meisai.rows) {
      expect(Object.values(row.amounts).some((v) => v !== 0)).toBe(true);
    }
  });

  it("逆方向フローを検出し overrideKey/件数/金額を持つ", () => {
    expect(result.reverseFlows.length).toBeGreaterThan(0);
    for (const r of result.reverseFlows) {
      expect(r.overrideKey.startsWith(r.baseSubjectId)).toBe(true);
      expect(r.overrideKey).toContain(r.description);
      expect(r.txnCount).toBeGreaterThan(0);
      expect(r.leakedAmount).toBeGreaterThan(0);
      expect(["income", "expense"]).toContain(r.kind);
    }
    // 金額降順
    for (let i = 1; i < result.reverseFlows.length; i++) {
      expect(result.reverseFlows[i - 1].leakedAmount).toBeGreaterThanOrEqual(
        result.reverseFlows[i].leakedAmount,
      );
    }
  });

  it("逆方向フローを正方向科目へ上書きすると検出から消え集計に反映", () => {
    const target = result.reverseFlows[0];
    // 漏れているのは出金(income科目に出金) or 入金(expense科目に入金)
    const fixSid =
      target.kind === "income" ? "sonotaKeijouShishutsu" : "sonotaKeijouShunyuu";
    const fixed = aggregatePipeline(parsed, mapping, {
      descriptionOverrides: { [target.overrideKey]: fixSid },
    });
    expect(
      fixed.reverseFlows.some((r) => r.overrideKey === target.overrideKey),
    ).toBe(false);
    const sum = (c: Record<string, Record<string, number>>) =>
      Object.values(c)
        .flatMap((r) => Object.values(r))
        .reduce((s, v) => s + v, 0);
    expect(sum(fixed.cashflow.cellsBySubject)).toBeGreaterThan(
      sum(result.cashflow.cellsBySubject),
    );
  });

  it("残高不一致診断: 元帳整合0・要因合計が最終差異を説明", () => {
    const d = result.discrepancy;
    expect(d.ledgerIntegrityDiff).toBe(0);
    // 説明分 + 残差 = 最終差異（恒等式）
    expect(d.explained + d.residual).toBe(d.finalDiff);
    expect(
      d.transferContribution +
        d.excludedContribution +
        d.reverseContribution,
    ).toBe(d.explained);
    // 未割当(諸口/未払金 等)があるので除外寄与が存在し、グループも非空
    expect(d.groups.length).toBeGreaterThan(0);
    for (const g of d.groups) {
      expect(g.diffContribution).toBe(-g.leakedSigned);
      expect(["transfer", "excluded", "reverse"]).toContain(g.category);
    }
    // 寄与は絶対値降順
    for (let i = 1; i < d.groups.length; i++) {
      expect(Math.abs(d.groups[i - 1].diffContribution)).toBeGreaterThanOrEqual(
        Math.abs(d.groups[i].diffContribution),
      );
    }
  });

  it("残高不一致診断: 全要因を方向適合科目へ割り当てると最終差異が縮小", () => {
    const ov: Record<string, string> = {};
    for (const g of result.discrepancy.groups) {
      if (g.category === "transfer") {
        continue; // 資金移動はそのまま
      }
      // 未計上が出金超過(leakedSigned<0)なら支出科目、入金超過なら収入科目
      ov[g.cpDescKey] =
        g.leakedSigned < 0 ? "sonotaKeijouShishutsu" : "sonotaKeijouShunyuu";
    }
    const fixed = aggregatePipeline(parsed, mapping, {
      cpDescAssignments: ov,
    });
    expect(Math.abs(fixed.discrepancy.finalDiff)).toBeLessThan(
      Math.abs(result.discrepancy.finalDiff),
    );
  });

  it("meisaiPreview は overrideKey/baseSubjectId を持ち科目順", () => {
    expect(result.meisaiPreview.length).toBeGreaterThan(0);
    for (const p of result.meisaiPreview) {
      expect(p.overrideKey).toBe(`${p.baseSubjectId}${p.description}`);
      // 上書き無しなら実効科目＝既定科目
      expect(p.subjectId).toBe(p.baseSubjectId);
    }
  });
});

describe("general-ledger-pipeline MFクラウド総勘定元帳", () => {
  function loadMfParsed() {
    const buf = readFileSync(
      join(SAMPLE_DIR, "MF総勘定元帳_20260517_1515.csv"),
    );
    const ab = buf.buffer.slice(
      buf.byteOffset,
      buf.byteOffset + buf.byteLength,
    );
    return parseGeneralLedger(decodeLedgerBytes(ab as ArrayBuffer));
  }
  const parsed = loadMfParsed();
  const mapping = buildMappingTable(parsed.txns);
  const result = aggregatePipeline(parsed, mapping);

  it("MF形式として検出され集計がエラーなく完走する", () => {
    expect(parsed.formatId).toBe("mfcloud");
    expect(result.months.length).toBeGreaterThanOrEqual(1);
    expect(result.months).toEqual([...result.months].sort());
  });

  it("期首は逆算 openingBalances 合計（初月以前分）と一致", () => {
    const expected = parsed.openingBalances
      .filter((o) => o.monthKey <= result.months[0])
      .reduce((s, o) => s + o.balance, 0);
    expect(result.openingBalanceFirstMonth).toBe(expected);
    expect(result.cashflow.openingBalanceCandidate).toBe(expected);
  });

  it("逆算期首により元帳整合差0（残高連続性が保たれている）", () => {
    expect(result.discrepancy.ledgerIntegrityDiff).toBe(0);
  });
});

describe("general-ledger-pipeline 明細行単位の科目上書き", () => {
  const parsed = loadParsed();
  const mapping = buildMappingTable(parsed.txns);
  const base = aggregatePipeline(parsed, mapping);

  it("特定明細行を別科目へ移動するとセル合計が保存される", () => {
    const target = base.meisaiPreview.find(
      (p) => p.subjectId === "uriageNyukin",
    );
    expect(target).toBeTruthy();
    const moved = aggregatePipeline(parsed, mapping, {
      descriptionOverrides: { [target!.overrideKey]: "sonotaKeijouShunyuu" },
    });
    const sum = (cells: Record<string, Record<string, number>>) =>
      Object.values(cells)
        .flatMap((r) => Object.values(r))
        .reduce((s, v) => s + v, 0);
    // 収入→収入の移動なので総額は不変
    expect(sum(moved.cashflow.cellsBySubject)).toBe(
      sum(base.cashflow.cellsBySubject),
    );
    // 対象行は other 経常収入側に出現
    const movedRow = moved.meisaiPreview.find(
      (p) => p.overrideKey === target!.overrideKey,
    );
    expect(movedRow?.subjectId).toBe("sonotaKeijouShunyuu");
    expect(movedRow?.baseSubjectId).toBe("uriageNyukin");
  });

  it("明細行を除外(null)すると集計から外れ excludedCount が増える", () => {
    const target = base.meisaiPreview[0];
    const excluded = aggregatePipeline(parsed, mapping, {
      descriptionOverrides: { [target.overrideKey]: null },
    });
    expect(excluded.excludedCount).toBeGreaterThan(base.excludedCount);
    expect(
      excluded.meisaiPreview.some(
        (p) => p.overrideKey === target.overrideKey,
      ),
    ).toBe(false);
  });
});

describe("general-ledger-pipeline 摘要単位の分解割当 (cpDescAssignments)", () => {
  const parsed = loadParsed();
  const mapping = buildMappingTable(parsed.txns);
  const breakdown = buildCpDescBreakdown(parsed.txns);
  const base = aggregatePipeline(parsed, mapping);

  it("未割当cp(諸口)の1摘要を科目割当するとその分のみ集計に出現", () => {
    const groups = breakdown.get("諸口");
    expect(groups && groups.length > 0).toBe(true);
    const g = groups![0];
    // 金額が出るよう優勢方向に合う科目を割当（収入↔inflow / 支出↔outflow）
    const sid =
      g.dominantDirection === "inflow"
        ? "sonotaKeijouShunyuu"
        : "sonotaKeijouShishutsu";
    const assigned = aggregatePipeline(parsed, mapping, {
      cpDescAssignments: { [cpDescKey("諸口", g.description)]: sid },
    });
    // 除外が減る（諸口は元 unmapped で全除外だった）
    expect(assigned.excludedCount).toBeLessThan(base.excludedCount);
    const row = assigned.meisaiPreview.find(
      (p) => p.subjectId === sid && p.description === g.description,
    );
    expect(row).toBeTruthy();
  });

  it("同cpの未設定摘要は依然除外（部分割当）", () => {
    const groups = breakdown.get("諸口")!;
    const assigned = aggregatePipeline(parsed, mapping, {
      cpDescAssignments: {
        [cpDescKey("諸口", groups[0].description)]: "sonotaKeijouShunyuu",
      },
    });
    if (groups.length > 1) {
      const other = groups[1];
      expect(
        assigned.meisaiPreview.some(
          (p) => p.description === other.description,
        ),
      ).toBe(false);
    }
  });

  it("cpDescAssignments は相手勘定科目マッピングより優先（rule済cpの1摘要を別科目へ）", () => {
    const groups = breakdown.get("売掛金");
    expect(groups && groups.length > 0).toBe(true);
    const g = groups![0];
    const moved = aggregatePipeline(parsed, mapping, {
      cpDescAssignments: {
        [cpDescKey("売掛金", g.description)]: "sonotaKeijouShunyuu",
      },
    });
    const row = moved.meisaiPreview.find(
      (p) => p.description === g.description && p.baseSubjectId === "sonotaKeijouShunyuu",
    );
    expect(row?.subjectId).toBe("sonotaKeijouShunyuu");
  });

  it("null 割当で明示除外", () => {
    const groups = breakdown.get("売掛金")!;
    const g = groups[0];
    const excluded = aggregatePipeline(parsed, mapping, {
      cpDescAssignments: { [cpDescKey("売掛金", g.description)]: null },
    });
    expect(excluded.excludedCount).toBeGreaterThan(base.excludedCount);
  });

  it("調整引数デフォルトで既存挙動と一致（回帰なし）", () => {
    const a = aggregatePipeline(parsed, mapping);
    const b = aggregatePipeline(parsed, mapping, {});
    expect(a.excludedCount).toBe(b.excludedCount);
    expect(a.meisaiPreview.length).toBe(b.meisaiPreview.length);
  });
});

describe("general-ledger-pipeline CSV直列化", () => {
  const parsed = loadParsed();
  const mapping = buildMappingTable(parsed.txns);
  const result = aggregatePipeline(parsed, mapping);

  it("資金繰り実績表CSVは BOM + 科目,年月... ヘッダー + 期首残高行を持つ", () => {
    const csv = cashflowResultToCsv(result.cashflow);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const firstLine = csv.replace(/^﻿/, "").split("\r\n")[0];
    expect(firstLine).toBe(
      "科目," + result.months.map(formatJpMonth).join(","),
    );
    expect(firstLine.startsWith("科目,2025年7月,2025年8月,")).toBe(true);
    expect(csv).toContain(`${OPENING_BALANCE_LABEL},`);
    expect(csv).toContain("売上入金,");
  });

  it("明細表CSVは 科目,摘要,月... ヘッダー", () => {
    const csv = meisaiResultToCsv(result.meisai);
    const firstLine = csv.replace(/^﻿/, "").split("\r\n")[0];
    expect(firstLine.startsWith("科目,摘要,2025年7月")).toBe(true);
  });

  it("中間ファイルCSVは規定ヘッダーで、資金諸口は資金移動表記", () => {
    const rows = buildIntermediateRows(parsed.txns);
    const csv = intermediateToCsv(rows);
    const firstLine = csv.replace(/^﻿/, "").split("\r\n")[0];
    expect(firstLine).toBe("取引日,出金金額,入金金額,取引後残高,摘要内容");
    expect(csv).toContain("資金移動");
    expect(rows.every((r) => !r.summary.includes("資金諸口"))).toBe(true);
  });
});

describe("逆方向フロー上書きの基底科目衝突回避", () => {
  // 売掛金(入金) と 売上戻り高(出金) はともに base=売上入金。
  // 同じ摘要だと明細上書き(基底科目+摘要)は衝突するが、
  // 摘要分解(相手勘定科目+摘要)なら相手勘定科目で分離され衝突しない。
  function mkTxn(p: Partial<RawLedgerTxn>): RawLedgerTxn {
    return {
      accountLedger: "口座A",
      date: "2025/7/1",
      monthKey: "2025-07",
      counterpartyAccount: "",
      description: "AMEMO",
      inflow: 0,
      outflow: 0,
      balance: 0,
      isOpeningCarry: false,
      ...p,
    };
  }
  const txns: RawLedgerTxn[] = [
    mkTxn({ counterpartyAccount: "売掛金", inflow: 100000 }),
    mkTxn({ counterpartyAccount: "売上戻り高", outflow: 30000 }),
  ];
  const parsed = {
    txns,
    openingBalances: [],
    months: ["2025-07"],
    accountLedgers: ["口座A"],
    skippedRows: 0,
    headerFound: true,
    formatId: "freee" as const,
    formatName: "freee",
  };
  const mapping = buildMappingTable(txns);

  it("既定では売上戻り高の出金が逆方向フローとして検出される", () => {
    const r = aggregatePipeline(parsed, mapping);
    const rf = r.reverseFlows.find(
      (x) => x.counterpartyAccount === "売上戻り高",
    );
    expect(rf).toBeTruthy();
    expect(rf!.leakedAmount).toBe(30000);
  });

  it("明細上書き(基底科目+摘要)は衝突し逆方向フローが解消しない", () => {
    // base=売上入金 + 同一摘要を支出科目へ → 売掛金/売上戻り高 双方を巻き込む
    const key = meisaiOverrideKey("uriageNyukin", "AMEMO");
    const r = aggregatePipeline(parsed, mapping, {
      descriptionOverrides: { [key]: "sonotaKeijouShishutsu" },
    });
    // 売掛金の入金(100000)が支出科目に入り逆方向フローが残る（衝突）
    expect(
      r.reverseFlows.some((x) => x.counterpartyAccount === "売掛金"),
    ).toBe(true);
  });

  it("摘要分解(相手勘定科目+摘要)なら売掛金を壊さず逆方向フローが解消", () => {
    const fixed = aggregatePipeline(parsed, mapping, {
      cpDescAssignments: {
        [cpDescKey("売上戻り高", "AMEMO")]: "sonotaKeijouShishutsu",
      },
    });
    // 逆方向フロー消滅
    expect(
      fixed.reverseFlows.some(
        (x) => x.counterpartyAccount === "売上戻り高",
      ),
    ).toBe(false);
    // 売掛金の入金は売上入金のまま保持
    const uri = fixed.cashflow.cellsBySubject["uriageNyukin"] ?? {};
    expect(uri["2025-07"]).toBe(100000);
    // 売上戻り高の出金は支出科目へ計上
    const exp = fixed.cashflow.cellsBySubject["sonotaKeijouShishutsu"] ?? {};
    expect(exp["2025-07"]).toBe(30000);
  });
});

describe("消込（科目＋同額の入金/出金ペア）", () => {
  function mkTxn(p: Partial<RawLedgerTxn>): RawLedgerTxn {
    return {
      accountLedger: "口座A",
      date: "2025/7/1",
      monthKey: "2025-07",
      counterpartyAccount: "外注費",
      description: "X",
      inflow: 0,
      outflow: 0,
      balance: 0,
      isOpeningCarry: false,
      ...p,
    };
  }
  // 外注費(rule→gaichuuhi)で 同額50000 の入金/出金（摘要は別）＋通常出金70000
  const txns: RawLedgerTxn[] = [
    mkTxn({ description: "返金 A社", inflow: 50000 }),
    mkTxn({ description: "外注 B社", outflow: 50000 }),
    mkTxn({ description: "外注 C社", outflow: 70000 }),
  ];
  const parsed = {
    txns,
    openingBalances: [],
    months: ["2025-07"],
    accountLedgers: ["口座A"],
    skippedRows: 0,
    headerFound: true,
    formatId: "freee" as const,
    formatName: "freee",
  };
  const mapping = buildMappingTable(txns);

  it("科目＋同額の入金/出金が消込候補に出る（摘要不問）", () => {
    const r = aggregatePipeline(parsed, mapping);
    const c = r.offsetCandidates.find((x) => x.subjectId === "gaichuuhi");
    expect(c).toBeTruthy();
    expect(c!.amount).toBe(50000);
    expect(c!.pairCount).toBe(1);
    expect(c!.offsetTotal).toBe(50000);
    expect(c!.confirmed).toBe(false);
  });

  it("消込確定でそのペアは資金移動同様に除外（純額0）、残り70000は計上", () => {
    const r0 = aggregatePipeline(parsed, mapping);
    const cand = r0.offsetCandidates.find(
      (x) => x.subjectId === "gaichuuhi",
    )!;
    const r = aggregatePipeline(parsed, mapping, {
      offsetKeys: { [cand.key]: true },
    });
    // 50000 ペアは除外（excludedCount 2件増）
    expect(r.excludedCount).toBe(r0.excludedCount + 2);
    // gaichuuhi は通常出金70000のみ
    const g = r.cashflow.cellsBySubject["gaichuuhi"] ?? {};
    expect(g["2025-07"]).toBe(70000);
    // 候補は confirmed=true として残る（再消込解除可能）
    expect(
      r.offsetCandidates.find((x) => x.key === cand.key)?.confirmed,
    ).toBe(true);
  });

  it("未確認では従来通り集計（消込されない）", () => {
    const r = aggregatePipeline(parsed, mapping);
    const g = r.cashflow.cellsBySubject["gaichuuhi"] ?? {};
    // 外注費(expense)は出金合計 50000+70000=120000、入金50000は逆方向で別途検出
    expect(g["2025-07"]).toBe(120000);
    expect(
      r.reverseFlows.some((x) => x.counterpartyAccount === "外注費"),
    ).toBe(true);
  });
});
