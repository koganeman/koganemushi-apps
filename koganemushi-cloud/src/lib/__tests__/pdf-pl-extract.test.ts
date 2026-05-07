import { describe, it, expect } from "vitest";
import {
  parsePLFromPdfLines,
  mapExtractedToInput,
  parseJpNumber,
  assembleLinesFromItems,
} from "../pdf-pl-extract";
import koganemushiLines from "./fixtures/koganemushi202506-lines.json";

describe("parseJpNumber", () => {
  it("カンマ区切り数値をパース", () => {
    expect(parseJpNumber("1,234,567")).toBe(1_234_567);
  });
  it("マイナス記号", () => {
    expect(parseJpNumber("-75,000")).toBe(-75_000);
  });
  it("△記号（赤字）", () => {
    expect(parseJpNumber("△1,234")).toBe(-1_234);
  });
  it("▲記号", () => {
    expect(parseJpNumber("▲1,234")).toBe(-1_234);
  });
  it("括弧囲み", () => {
    expect(parseJpNumber("(1,234)")).toBe(-1_234);
  });
  it("非数値はundefined", () => {
    expect(parseJpNumber("abc")).toBeUndefined();
  });
});

describe("assembleLinesFromItems", () => {
  it("Y座標±3px以内のアイテムを同一行にまとめる", () => {
    const items = [
      { str: "売上高", transform: [1, 0, 0, 1, 100, 500] },
      { str: "100", transform: [1, 0, 0, 1, 300, 502] },
      { str: "次の行", transform: [1, 0, 0, 1, 100, 480] },
    ];
    const lines = assembleLinesFromItems(items);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("売上高");
    expect(lines[0]).toContain("100");
    expect(lines[1]).toBe("次の行");
  });
  it("X座標で並び替えされる", () => {
    const items = [
      { str: "B", transform: [1, 0, 0, 1, 200, 500] },
      { str: "A", transform: [1, 0, 0, 1, 100, 500] },
    ];
    const lines = assembleLinesFromItems(items);
    expect(lines[0]).toBe("A B");
  });
});

describe("parsePLFromPdfLines (koganemushi202506確定申告)", () => {
  const result = parsePLFromPdfLines(koganemushiLines as string[]);

  it("会計期間の期末日を2025/6/30として抽出", () => {
    expect(result.raw.periodEnd).toBe("2025/6/30");
  });

  it("売上高計を抽出", () => {
    expect(result.raw.salesTotal).toBe(70_756_191);
  });

  it("売上原価計を抽出", () => {
    expect(result.raw.costOfSalesTotal).toBe(21_847_419);
  });

  it("人件費系（役員報酬・給料手当・法定福利費）を抽出", () => {
    expect(result.raw.executiveCompensation).toBe(15_200_000);
    expect(result.raw.salaryAllowance).toBe(412_740);
    expect(result.raw.legalWelfare).toBe(1_539_462);
  });

  it("人件費の未計上項目はundefined（役員賞与・雑給・賞与・退職金）", () => {
    expect(result.raw.executiveBonus).toBeUndefined();
    expect(result.raw.miscellaneousSalary).toBeUndefined();
    expect(result.raw.bonus).toBeUndefined();
    expect(result.raw.retirementBenefits).toBeUndefined();
  });

  it("販売管理費計を抽出", () => {
    expect(result.raw.sellingAdminTotal).toBe(48_148_868);
  });

  it("営業外損益・特別損益を抽出", () => {
    expect(result.raw.nonOperatingIncome).toBe(233_080);
    expect(result.raw.nonOperatingExpense).toBe(745_535);
    expect(result.raw.extraordinaryIncome).toBe(7_025);
    expect(result.raw.extraordinaryLoss).toBeUndefined(); // このPDFには特別損失なし
  });

  it("減価償却費を抽出", () => {
    expect(result.raw.depreciation).toBe(3_046_641);
  });

  it("法人税等計を抽出", () => {
    expect(result.raw.corporateTaxEtc).toBe(80_753);
  });

  it("税引前当期純利益を抽出（値が次行にあるケース対応）", () => {
    expect(result.raw.preTaxIncome).toBe(254_474);
  });

  it("必須項目はすべて抽出済みで警告なし", () => {
    const requiredWarnings = result.warnings.filter((w) => w.includes("必須"));
    expect(requiredWarnings).toEqual([]);
  });
});

describe("mapExtractedToInput Plan B 整合性", () => {
  it("粗利益 − (人件費 + sellingAdminOther) ≈ PDF上の税引前当期純利益", () => {
    const r = parsePLFromPdfLines(koganemushiLines as string[]);
    const m = mapExtractedToInput(r);
    // 人件費 = 15,200,000 + 412,740 + 1,539,462 = 17,152,202
    expect(m.derivation.personnelCost).toBe(17_152_202);
    // sellingAdminOther = 48,148,868 - 17,152,202 + (745,535 - 233,080) + (0 - 7,025)
    //                   = 30,996,666 + 512,455 - 7,025 = 31,502,096
    expect(m.derivation.sellingAdminOther).toBe(31_502_096);
    // expectedPreTax = 70,756,191 - 21,847,419 - (17,152,202 + 31,502,096)
    //                = 48,908,772 - 48,654,298 = 254,474
    expect(m.derivation.expectedPreTax).toBe(254_474);
    expect(m.derivation.expectedPreTax).toBe(r.raw.preTaxIncome);
  });

  it("PLPeriodInputのpersonnel系・sellingAdminOther・preTaxIncomeRefが正しくセットされる", () => {
    const r = parsePLFromPdfLines(koganemushiLines as string[]);
    const m = mapExtractedToInput(r);
    expect(m.input.periodLabel).toBe("2025/6/30");
    expect(m.input.sales).toBe(70_756_191);
    expect(m.input.costOfSales).toBe(21_847_419);
    expect(m.input.executiveCompensation).toBe(15_200_000);
    expect(m.input.salaryAllowance).toBe(412_740);
    expect(m.input.legalWelfare).toBe(1_539_462);
    expect(m.input.sellingAdminOther).toBe(31_502_096);
    expect(m.input.preTaxIncomeRef).toBe(254_474);
    expect(m.input.depreciation).toBe(3_046_641);
    expect(m.input.corporateTaxEtc).toBe(80_753);
    expect(m.input.loanRepayment).toBe(0);
  });
});

describe("欠落・エッジケース", () => {
  it("必須欄が見つからない場合は警告に追加", () => {
    const r = parsePLFromPdfLines(["なんでもない行"]);
    const reqWarnings = r.warnings.filter((w) => w.includes("必須"));
    expect(reqWarnings.length).toBeGreaterThanOrEqual(3);
  });

  it("△つき負数（赤字決算）を扱える", () => {
    const r = parsePLFromPdfLines([
      "2023年04月01日 〜 2024年03月31日",
      "売 上 高 計 50,000,000",
      "販 売 管 理 費 計 20,000,000",
      "税 引 前 当 期 純 損 失 △1,234,567",
    ]);
    expect(r.raw.preTaxIncome).toBe(-1_234_567);
    expect(r.raw.salesTotal).toBe(50_000_000);
    expect(r.raw.periodEnd).toBe("2024/3/31");
  });

  it("空入力は全フィールドundefined＋必須警告", () => {
    const r = parsePLFromPdfLines([]);
    expect(r.raw.salesTotal).toBeUndefined();
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});
