/**
 * 納税予定（納税予測.xlsx 移植）の料率・定数。
 *
 * すべて Excel `docs/shikingurihyou/Excel-data/納税予測.xlsx` の既定値を ground truth
 * として転記したもの。料率は小数（CLAUDE.md 規約）、金額は整数（円）。
 */

/** Excel FLOOR(x, sig) 相当（sig の倍数へ切り捨て）。 */
export function floorTo(x: number, sig: number): number {
  return Math.floor(x / sig) * sig;
}

/** 消費税率（概算は 10%） */
export const CONSUMPTION_TAX_RATE = 0.1;
/** 消費税対象額の切り捨て単位（千円） */
export const CONSUMPTION_BASE_FLOOR = 1000;
/** 国税分の割合（消費税中間判定 ctax = 概算 × 0.78、国税7.8%/10%） */
export const CONSUMPTION_NATIONAL_RATIO = 0.78;

/** 法人税本体率（所得 800万以下 / 800万超） */
export const CORP_TAX_LOW = 0.15;
export const CORP_TAX_HIGH = 0.232;

/** 事業税（所得割）率（400万以下 / 400万超800万以下 / 800万超） */
export const BIZ_TAX_T1 = 0.07;
export const BIZ_TAX_T2 = 0.085;
export const BIZ_TAX_T3 = 0.1;
/** 特別法人事業税（事業税所得割への上乗せ。1 + 0.375 で乗算） */
export const BIZ_TAX_SURCHARGE = 0.375;

/** 地方法人税率（法人税額に乗ずる国税） */
export const LOCAL_CORP_TAX_RATE = 0.104;

/** 防衛特別法人税率（法人税額 500万超部分。2026/4/1 以降開始事業年度） */
export const DEFENSE_TAX_RATE = 0.04;
/** 防衛特別法人税の基礎法人税控除（500万円までは課税対象外） */
export const DEFENSE_CORP_TAX_THRESHOLD = 5_000_000;

/** 法人住民税 法人税割（都道府県民税 0.01 + 市町村民税 0.06）。法人税額に乗ずる */
export const RESIDENT_TAX_CORP_RATE = 0.07;

/** 住民税均等割の既定値 */
export const PER_CAPITA_LEVY_DEFAULT = 70000;

/** 所得階層の境界 */
export const INCOME_BAND_400 = 4_000_000;
export const INCOME_BAND_800 = 8_000_000;

/**
 * 合計税率テーブル（年税額算出用）。
 * 構成式（Excel O21..O24 / T21..T23）:
 *   法人税率 × (1 + 地方法人特別0.104 + 都道府県民0.01 + 市町村民0.06)
 *   + 事業税率 × (1 + 特別法人事業0.375)
 * 防衛4段目の法人税率は 0.232 × 1.04。
 */
export const RATE_TABLE_CURRENT = {
  /** 400万以下 */
  t1: 0.27235,
  /** 400万超〜800万以下 */
  t2: 0.292975,
  /** 800万超 */
  t3: 0.409868,
} as const;

export const RATE_TABLE_DEFENSE = {
  /** 400万以下 */
  t1: 0.27235,
  /** 400万超〜800万以下 */
  t2: 0.292975,
  /** 800万超（法人税額 500万以下部分） */
  t3: 0.409868,
  /** 800万超（法人税額 500万超部分） */
  t4: 0.42076272,
} as const;

/**
 * 防衛 r3→r4 の境界（所得ベース）。
 * Excel: MIN(MAX(所得-8e6,0), 5e6/0.232 - 4e6)
 * 8,000,000 を超えた所得のうち、ここまでが t3、超過が t4。
 */
export const DEFENSE_BAND_LIMIT =
  DEFENSE_CORP_TAX_THRESHOLD / CORP_TAX_HIGH - INCOME_BAND_400;

/** 法人税中間申告の要否しきい値（法人税額 > 200,000 で中間納付あり） */
export const CORP_INTERIM_THRESHOLD = 200000;

/** 消費税中間申告の判定しきい値（ctax = 概算 × 0.78 に対して）。法令準拠（4,800万 / 400万 / 48万） */
export const CONSUMPTION_INTERIM_MONTHLY = 48_000_000;
export const CONSUMPTION_INTERIM_QUARTERLY = 4_000_000;
export const CONSUMPTION_INTERIM_SEMIANNUAL = 480_000;

/** 防衛特別法人税の適用開始（事業年度開始日がこの年月以降なら適用） */
export const DEFENSE_START_YEAR = 2026;
export const DEFENSE_START_MONTH = 4;
