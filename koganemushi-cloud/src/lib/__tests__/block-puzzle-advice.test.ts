import { describe, it, expect } from "vitest";
import { buildAdvicePrompt, ADVICE_SYSTEM_PROMPT } from "../block-puzzle-advice";
import { calcBlockPuzzle, createSamplePLPeriods, createEmptyPLPeriod } from "../block-puzzle-calc";

describe("ADVICE_SYSTEM_PROMPT", () => {
  it("出力フォーマット指示が含まれる", () => {
    expect(ADVICE_SYSTEM_PROMPT).toContain("概観");
    expect(ADVICE_SYSTEM_PROMPT).toContain("注目すべきトレンド");
    expect(ADVICE_SYSTEM_PROMPT).toContain("改善アクションの提案");
  });

  it("文字数制約が含まれる", () => {
    expect(ADVICE_SYSTEM_PROMPT).toContain("1000〜1500文字");
  });
});

describe("buildAdvicePrompt", () => {
  it("サンプル5期データから整形されたプロンプトを返す", () => {
    const results = createSamplePLPeriods().map(calcBlockPuzzle);
    const prompt = buildAdvicePrompt(results);

    // 期数の言及
    expect(prompt).toContain("5期分");
    // 期末日の引用
    expect(prompt).toContain("2028/1/31");
    expect(prompt).toContain("2024/1/31");
    // 数値（粗利益率・労働分配率）の引用
    expect(prompt).toContain("粗利益率");
    expect(prompt).toContain("労働分配率");
    // 期は左ほど最新
    expect(prompt).toContain("左ほど最新");
  });

  it("売上ゼロの期はスキップされる", () => {
    const sample = createSamplePLPeriods().map(calcBlockPuzzle);
    // 1期だけ実データ + 残り4期は空
    const empty = calcBlockPuzzle(createEmptyPLPeriod("空"));
    const mixed = [sample[0], empty, empty, empty, empty];

    const prompt = buildAdvicePrompt(mixed);
    expect(prompt).toContain("1期分");
    expect(prompt).toContain("入力欄5期のうち");
  });

  it("全期未入力の場合はガイダンスメッセージを返す", () => {
    const empty = calcBlockPuzzle(createEmptyPLPeriod("空"));
    const all = [empty, empty, empty, empty, empty];
    const prompt = buildAdvicePrompt(all);
    expect(prompt).toContain("P/Lデータが入力されていません");
  });

  it("赤字期は「税引前当期損失」と「税引後損失」のラベルが使われる", () => {
    const results = createSamplePLPeriods().map(calcBlockPuzzle);
    const prompt = buildAdvicePrompt(results);
    // 2028/1/31 と 2025/1/31 は赤字（-1,450,000）
    expect(prompt).toContain("税引前当期損失");
  });

  it("黒字期は「税引前当期利益」のラベルが使われる", () => {
    const results = createSamplePLPeriods().map(calcBlockPuzzle);
    const prompt = buildAdvicePrompt(results);
    expect(prompt).toContain("税引前当期利益");
  });

  it("円単位でカンマ区切りされた数値が含まれる", () => {
    const results = createSamplePLPeriods().map(calcBlockPuzzle);
    const prompt = buildAdvicePrompt(results);
    // 売上 100,000,000円 など
    expect(prompt).toMatch(/\d{1,3}(?:,\d{3})+円/);
  });
});
