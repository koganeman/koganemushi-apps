import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { decodeLedgerBytes } from "../general-ledger-decode";
import { parseGeneralLedger } from "../general-ledger-parse";
import { buildMappingTable } from "../general-ledger-mapping";
import { aggregatePipeline } from "../general-ledger-pipeline";
import { reconcile, monthlyNet } from "../general-ledger-reconcile";

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

describe("general-ledger-reconcile", () => {
  const parsed = loadParsed();
  const mapping = buildMappingTable(parsed.txns);
  const result = aggregatePipeline(parsed, mapping);
  const rows = reconcile(result, parsed, null);

  it("行数は対象月数と一致し、初月の前月残高は期首残高", () => {
    expect(rows.length).toBe(result.months.length);
    expect(rows[0].openingOrPrev).toBe(result.openingBalanceFirstMonth);
  });

  it("算出期末は前月末＋当月収支で連鎖する", () => {
    for (let i = 0; i < rows.length; i++) {
      expect(rows[i].derivedClosing).toBe(
        rows[i].openingOrPrev + rows[i].net,
      );
      if (i > 0) {
        expect(rows[i].openingOrPrev).toBe(rows[i - 1].derivedClosing);
      }
    }
  });

  it("当月収支は収入加算・支出減算の合計", () => {
    const m = result.months[0];
    expect(rows[0].net).toBe(monthlyNet(result, m));
  });

  it("口座残高一覧表未アップロード時は uploaded 系が null", () => {
    expect(rows.every((r) => r.uploadedClosingTotal === null)).toBe(true);
    expect(rows.every((r) => r.diffUploaded === null)).toBe(true);
  });

  it("diffLedger = 算出期末 − 元帳期末合計", () => {
    for (const r of rows) {
      expect(r.diffLedger).toBe(r.derivedClosing - r.ledgerClosingTotal);
    }
  });
});
