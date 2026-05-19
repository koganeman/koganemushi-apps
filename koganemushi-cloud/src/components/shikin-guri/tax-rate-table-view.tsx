"use client";

import {
  RATE_TABLE_CURRENT,
  RATE_TABLE_DEFENSE,
  CORP_TAX_LOW,
  CORP_TAX_HIGH,
  BIZ_TAX_T1,
  BIZ_TAX_T2,
  BIZ_TAX_T3,
} from "@/lib/tax-forecast-rates";

const pct = (r: number) => `${(r * 100).toFixed(2)}%`;
const pct6 = (r: number) => `${(r * 100).toFixed(4)}%`;

/** 税引前利益階層別 合計税率表（表示専用・法人税率まとめ.png 準拠）。 */
export function TaxRateTableView() {
  return (
    <div className="text-xs space-y-4">
      <div>
        <h4 className="font-semibold mb-1">
          合計税率表（防衛特別法人税あり・2026/4 以降開始事業年度）
        </h4>
        <table className="border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="border px-2 py-1 text-left">階層</th>
              <th className="border px-2 py-1">法人税率</th>
              <th className="border px-2 py-1">事業税率</th>
              <th className="border px-2 py-1">合計税率</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border px-2 py-1">400万以下</td>
              <td className="border px-2 py-1 text-right">{pct(CORP_TAX_LOW)}</td>
              <td className="border px-2 py-1 text-right">{pct(BIZ_TAX_T1)}</td>
              <td className="border px-2 py-1 text-right font-semibold">
                {pct(RATE_TABLE_DEFENSE.t1)}
              </td>
            </tr>
            <tr>
              <td className="border px-2 py-1">400万超〜800万以下</td>
              <td className="border px-2 py-1 text-right">{pct(CORP_TAX_LOW)}</td>
              <td className="border px-2 py-1 text-right">{pct(BIZ_TAX_T2)}</td>
              <td className="border px-2 py-1 text-right font-semibold">
                {pct(RATE_TABLE_DEFENSE.t2)}
              </td>
            </tr>
            <tr>
              <td className="border px-2 py-1">800万超（法人税額500万以下）</td>
              <td className="border px-2 py-1 text-right">{pct(CORP_TAX_HIGH)}</td>
              <td className="border px-2 py-1 text-right">{pct(BIZ_TAX_T3)}</td>
              <td className="border px-2 py-1 text-right font-semibold">
                {pct(RATE_TABLE_DEFENSE.t3)}
              </td>
            </tr>
            <tr>
              <td className="border px-2 py-1">800万超（法人税額500万超部分）</td>
              <td className="border px-2 py-1 text-right">
                {pct6(CORP_TAX_HIGH * 1.04)}
              </td>
              <td className="border px-2 py-1 text-right">{pct(BIZ_TAX_T3)}</td>
              <td className="border px-2 py-1 text-right font-semibold">
                {pct6(RATE_TABLE_DEFENSE.t4)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div>
        <h4 className="font-semibold mb-1">合計税率表（防衛特別法人税なし・現行）</h4>
        <table className="border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="border px-2 py-1 text-left">階層</th>
              <th className="border px-2 py-1">法人税率</th>
              <th className="border px-2 py-1">事業税率</th>
              <th className="border px-2 py-1">合計税率</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border px-2 py-1">400万以下</td>
              <td className="border px-2 py-1 text-right">{pct(CORP_TAX_LOW)}</td>
              <td className="border px-2 py-1 text-right">{pct(BIZ_TAX_T1)}</td>
              <td className="border px-2 py-1 text-right font-semibold">
                {pct(RATE_TABLE_CURRENT.t1)}
              </td>
            </tr>
            <tr>
              <td className="border px-2 py-1">400万超〜800万以下</td>
              <td className="border px-2 py-1 text-right">{pct(CORP_TAX_LOW)}</td>
              <td className="border px-2 py-1 text-right">{pct(BIZ_TAX_T2)}</td>
              <td className="border px-2 py-1 text-right font-semibold">
                {pct(RATE_TABLE_CURRENT.t2)}
              </td>
            </tr>
            <tr>
              <td className="border px-2 py-1">800万超</td>
              <td className="border px-2 py-1 text-right">{pct(CORP_TAX_HIGH)}</td>
              <td className="border px-2 py-1 text-right">{pct(BIZ_TAX_T3)}</td>
              <td className="border px-2 py-1 text-right font-semibold">
                {pct(RATE_TABLE_CURRENT.t3)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
