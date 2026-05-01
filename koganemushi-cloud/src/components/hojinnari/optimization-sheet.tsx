"use client";

import { useCallback, useRef, useState } from "react";
import { useHojinnariStore } from "@/stores/hojinnari-store";
import { useShallow } from "zustand/react/shallow";
import {
  calcPlan1,
  calcPlan2,
  calcIndividual,
  applyDecisionMeasures,
  sumDecisionMeasures,
} from "@/lib/hojinnari-calc";
import { formatYen, parseYen } from "@/lib/format";
import { Input } from "@/components/ui/input";

function YenInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <Input
      className="w-full text-right text-sm h-7 px-2"
      value={value === 0 ? "" : formatYen(value)}
      onChange={(e) => onChange(Number(parseYen(e.target.value)) || 0)}
      placeholder="0"
    />
  );
}

export function OptimizationSheet() {
  const { input, rates, setInput, taxYear, decisionMeasures } = useHojinnariStore(
    useShallow((s) => ({
      input: s.input,
      rates: s.rates,
      setInput: s.setInput,
      taxYear: s.taxYear,
      decisionMeasures: s.decisionMeasures,
    }))
  );

  // 配偶者合算トグル（配偶者がいる場合のみ有効）
  const [combineSpouse, setCombineSpouse] = useState(false);

  if (input.businessIncome <= 0) {
    return (
      <div className="p-8 text-center text-gray-500 text-sm">
        シミュレーションタブで事業所得を入力してください。
      </div>
    );
  }

  // 現状（個人事業主）の手取り
  const individual = calcIndividual(input, taxYear);
  const useSpouse = combineSpouse && input.hasSpouse;
  const currentSpouseNet = useSpouse ? (individual.spouseResult?.netIncome ?? 0) : 0;
  const currentNetIncome = individual.netIncome + currentSpouseNet;

  // 決算対策の合計値（シミュレーションタブで入力）
  const decisionTotals = sumDecisionMeasures(decisionMeasures ?? []);
  const hasDecisionMeasures =
    decisionTotals.corporateExpense > 0 ||
    decisionTotals.taxDeductible > 0 ||
    decisionTotals.personalIncomeIncrease > 0;

  const step = 1000000;

  // PLAN1（完全法人成り）最適化: 役員報酬を変化させる + 決算対策反映 + 配偶者合算
  const plan2Points: Array<{
    salary: number;
    totalNetIncome: number;
    ownerNetIncome: number;
    corporateRetained: number;
  }> = [];
  for (let salary = 0; salary <= input.businessIncome; salary += step) {
    const modified = { ...input, plan2Salary: salary };
    const r = calcPlan2(modified, rates, taxYear);
    const adj = applyDecisionMeasures(r, decisionTotals, modified, rates);
    const spouseNet = useSpouse ? (r.spouseResult?.netIncome ?? 0) : 0;
    plan2Points.push({
      salary,
      totalNetIncome: adj.combinedNet + spouseNet,
      ownerNetIncome: adj.personalNet + spouseNet,
      corporateRetained: adj.corporateNet,
    });
  }

  // PLAN2（マイクロ法人成り）最適化: 法人移転売上は固定、役員報酬を変化させる + 決算対策反映 + 配偶者合算
  const plan1Points: Array<{
    salary: number;
    combinedNetIncome: number;
    ownerNetIncome: number;
    corporateRetained: number;
  }> = [];
  for (let sal = 0; sal <= input.businessIncome; sal += step) {
    const modified = { ...input, plan1MicroSalary: sal };
    const r = calcPlan1(modified, rates, taxYear);
    const adj = applyDecisionMeasures(r, decisionTotals, modified, rates);
    const spouseNet = useSpouse ? (r.spouseResult?.netIncome ?? 0) : 0;
    plan1Points.push({
      salary: sal,
      combinedNetIncome: adj.combinedNet + spouseNet,
      ownerNetIncome: adj.personalNet + spouseNet,
      corporateRetained: adj.corporateNet,
    });
  }

  // PDF出力（houkokusho-sheet と同じパターン）
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useCallback(() => {
    const el = printRef.current;
    if (!el) return;

    const pages = el.querySelectorAll(".print-page");
    if (pages.length === 0) return;

    const header = el.querySelector(".flex.items-center.gap-4.bg-white");

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.left = "-9999px";
    iframe.style.top = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument;
    if (!doc) { document.body.removeChild(iframe); return; }

    const styles = Array.from(document.styleSheets).map((ss) => {
      try { return Array.from(ss.cssRules).map((r) => r.cssText).join("\n"); }
      catch { return ""; }
    }).join("\n");

    doc.open();
    doc.write(`<!DOCTYPE html><html><head><style>
      ${styles}
      @page { margin: 5mm; size: A4 landscape; }
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      body { margin: 0; padding: 0; font-size: 9px; }
      .no-print { display: none !important; }
      .page { page-break-after: always; padding: 4px; transform: scale(0.78); transform-origin: top left; width: 128%; }
      .page:last-child { page-break-after: avoid; }
      td, th { padding: 1px 3px; }
      h2 { font-size: 11px; margin: 0 0 2px; }
      h3 { font-size: 10px; margin: 0 0 2px; }
    </style></head><body>`);

    pages.forEach((page) => {
      const clone = page.cloneNode(true) as HTMLElement;
      clone.querySelectorAll("input").forEach((inp) => {
        const span = document.createElement("span");
        span.textContent = inp.value;
        span.style.fontWeight = "bold";
        inp.replaceWith(span);
      });
      const headerClone = header?.cloneNode(true) as HTMLElement | undefined;
      if (headerClone) {
        headerClone.querySelectorAll(".no-print").forEach((n) => n.remove());
      }
      const wrapper = document.createElement("div");
      wrapper.className = "page";
      if (headerClone) wrapper.appendChild(headerClone);
      wrapper.appendChild(clone);
      doc.body.appendChild(wrapper);
    });

    doc.write("</body></html>");
    doc.close();

    iframe.contentWindow?.focus();
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 500);
  }, []);

  return (
    <div className="p-4 space-y-4" ref={printRef}>
      {/* ヘッダー（PDF出力ボタン＋配偶者合算トグル） */}
      <div className="flex items-center gap-4 bg-white rounded border p-3">
        <h2 className="font-bold text-sm">最適化シミュレーション</h2>
        <div className="flex items-center gap-2 no-print">
          <button
            onClick={handlePrint}
            className="text-xs border border-green-500 text-green-700 rounded px-3 py-1 hover:bg-green-50 transition-colors"
          >
            PDF出力
          </button>
        </div>
        {input.hasSpouse && (
          <div className="ml-auto flex items-center gap-1 text-xs no-print">
            <span className="text-gray-500">表示:</span>
            <div className="inline-flex border border-gray-300 rounded overflow-hidden">
              <button
                onClick={() => setCombineSpouse(false)}
                className={`px-2 py-1 ${
                  !combineSpouse ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                事業主のみ
              </button>
              <button
                onClick={() => setCombineSpouse(true)}
                className={`px-2 py-1 ${
                  combineSpouse ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                配偶者合算
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 配偶者合算モード説明（PDF時は非表示） */}
      {input.hasSpouse && (
        <div className="text-xs text-gray-500 px-1 no-print">
          {combineSpouse
            ? "（個人手取り・合算CFに配偶者の手取りを加算）"
            : "（事業主の手取りのみで試算）"}
        </div>
      )}

      {/* 決算対策の反映状況 */}
      <div
        className={`rounded border p-3 text-xs ${
          hasDecisionMeasures
            ? "bg-green-50 border-green-300 text-green-900"
            : "bg-gray-50 border-gray-200 text-gray-600"
        }`}
      >
        {hasDecisionMeasures ? (
          <div className="space-y-0.5">
            <p className="font-bold">
              シミュレーションタブの「決算対策」を反映した試算です
            </p>
            <p>
              法人支出額 合計:{" "}
              <span className="font-mono">{formatYen(decisionTotals.corporateExpense)}</span> /
              損金算入額 合計:{" "}
              <span className="font-mono">{formatYen(decisionTotals.taxDeductible)}</span> /
              個人手取り増加 合計:{" "}
              <span className="font-mono">{formatYen(decisionTotals.personalIncomeIncrease)}</span>
            </p>
          </div>
        ) : (
          <p>
            決算対策は未入力です（対策を反映するにはシミュレーションタブの「法人成り後に実施する決算対策」に金額を入力してください）。
          </p>
        )}
      </div>

      {/* PLAN1 完全法人成り 最適化 */}
      <div className="print-page bg-white rounded border p-4 space-y-3">
        <h2 className="font-bold text-sm border-b pb-2">
          <span className="inline-block bg-orange-500 text-white text-xs px-2 py-0.5 rounded mr-2">PLAN1</span>
          完全法人成り — 役員報酬の最適化
        </h2>
        <p className="text-xs text-gray-500">
          今、法人成りするといくら役員報酬がもらえるか？
        </p>

        <div className="flex flex-wrap gap-4 items-end mb-2">
          <div>
            <p className="text-xs text-gray-500">
              現在の{useSpouse ? "個人＋配偶者" : "個人"}手取額
            </p>
            <p className="text-xl font-bold text-gray-700">{formatYen(currentNetIncome)}</p>
          </div>
        </div>
        <p className="text-xs text-gray-400">※ 100万円刻みで試算</p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-xs">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-right py-1 px-2 font-medium text-gray-500 border-r">役員報酬</th>
                <th className="text-right py-1 px-2 font-medium text-gray-500 border-r">役員手取り</th>
                <th className="text-right py-1 px-2 font-medium text-gray-500 border-r">法人内部留保</th>
                <th className="text-right py-1 px-2 font-medium text-gray-500 border-r">合算CF手取り</th>
                <th className="text-right py-1 px-2 font-medium text-gray-500">現在との比較</th>
              </tr>
            </thead>
            <tbody>
              {plan2Points.map((p) => {
                const diff = p.totalNetIncome - currentNetIncome;
                return (
                  <tr
                    key={p.salary}
                    className={`border-b ${p.salary === input.plan2Salary ? "bg-blue-50" : ""}`}
                  >
                    <td className="py-1 px-2 text-right font-mono border-r">{formatYen(p.salary)}</td>
                    <td className="py-1 px-2 text-right font-mono border-r">{formatYen(p.ownerNetIncome)}</td>
                    <td className={`py-1 px-2 text-right font-mono border-r ${p.corporateRetained < 0 ? "text-red-600" : ""}`}>
                      {formatYen(p.corporateRetained)}
                    </td>
                    <td className="py-1 px-2 text-right font-mono border-r">{formatYen(p.totalNetIncome)}</td>
                    <td className={`py-1 px-2 text-right font-mono ${diff >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {diff >= 0 ? "+" : ""}{formatYen(diff)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* PLAN1 コメント */}
        {(() => {
          const best = plan2Points.reduce((a, b) =>
            (b.totalNetIncome - currentNetIncome) > (a.totalNetIncome - currentNetIncome) ? b : a
          );
          const bestDiff = best.totalNetIncome - currentNetIncome;
          const ownerDiff = best.ownerNetIncome - currentNetIncome;
          // 役員手取り >= 現在の個人手取額 かつ 合算CFがプラスになるケース
          const maintained = plan2Points.filter(
            (p) => p.ownerNetIncome >= currentNetIncome && p.totalNetIncome > currentNetIncome
          );
          // その中で合算CF差額が最大のもの
          const bestMaintained = maintained.length > 0
            ? maintained.reduce((a, b) =>
                (b.totalNetIncome - currentNetIncome) > (a.totalNetIncome - currentNetIncome) ? b : a
              )
            : null;
          return (
            <div className="bg-orange-50 border border-orange-200 rounded p-3 text-sm space-y-1">
              <p>
                合算CF手取りの現在との比較が最大になるのは、役員報酬
                <span className="font-bold text-orange-700"> {formatYen(best.salary)} </span>
                のときで、現在より
                <span className={`font-bold ${bestDiff >= 0 ? "text-green-700" : "text-red-600"}`}>
                  {" "}{bestDiff >= 0 ? "+" : ""}{formatYen(bestDiff)}
                </span>
                {bestDiff >= 0 ? " 有利" : " 不利"}になります。
              </p>
              <p>
                ただし、その場合の役員手取りは
                <span className="font-bold"> {formatYen(best.ownerNetIncome)} </span>
                となり、現在の個人手取額と比べると
                <span className={`font-bold ${ownerDiff >= 0 ? "text-green-700" : "text-red-600"}`}>
                  {" "}{ownerDiff >= 0 ? "+" : ""}{formatYen(ownerDiff)}
                </span>
                {ownerDiff < 0 ? "（個人の手取りは減少します）" : ""}。
              </p>
              {bestMaintained ? (
                <p>
                  現在の手取りを維持しつつ合算CFがプラスになるのは、役員報酬
                  <span className="font-bold text-orange-700"> {formatYen(bestMaintained.salary)} </span>
                  のときで、合算CF差額は
                  <span className="font-bold text-green-700">
                    {" "}+{formatYen(bestMaintained.totalNetIncome - currentNetIncome)}
                  </span>
                  です。
                </p>
              ) : (
                <p className="text-red-600">
                  現在の手取りを維持しつつ合算CFがプラスになる役員報酬額はありません。
                </p>
              )}
            </div>
          );
        })()}
      </div>

      {/* PLAN2 マイクロ法人成り 最適化 */}
      <div className="print-page bg-white rounded border p-4 space-y-3">
        <h2 className="font-bold text-sm border-b pb-2">
          <span className="inline-block bg-blue-600 text-white text-xs px-2 py-0.5 rounded mr-2">PLAN2</span>
          マイクロ法人成り — 移転売上の最適化
        </h2>
        <p className="text-xs text-gray-500">
          マイクロ法人成り　役員報酬をどれだけ抑えれば有利なのか？
        </p>

        <div className="flex flex-wrap gap-4 items-end mb-2">
          <div>
            <p className="text-xs text-gray-500">
              現在の{useSpouse ? "個人＋配偶者" : "個人"}手取額
            </p>
            <p className="text-xl font-bold text-gray-700">{formatYen(currentNetIncome)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">法人移転売上（固定）</p>
            <YenInput
              value={input.plan1MicroRevenue}
              onChange={(v) => setInput({ plan1MicroRevenue: v })}
            />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">配偶者給与（固定）</p>
            <YenInput
              value={input.plan1SpouseSalary}
              onChange={(v) => setInput({ plan1SpouseSalary: v })}
            />
          </div>
        </div>
        <p className="text-xs text-gray-400">※ 100万円刻みで試算</p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-xs">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-right py-1 px-2 font-medium text-gray-500 border-r">役員報酬</th>
                <th className="text-right py-1 px-2 font-medium text-gray-500 border-r">役員手取り</th>
                <th className="text-right py-1 px-2 font-medium text-gray-500 border-r">法人内部留保</th>
                <th className="text-right py-1 px-2 font-medium text-gray-500 border-r">合算CF手取り</th>
                <th className="text-right py-1 px-2 font-medium text-gray-500">現在との比較</th>
              </tr>
            </thead>
            <tbody>
              {plan1Points.map((p) => {
                const diff = p.combinedNetIncome - currentNetIncome;
                return (
                  <tr
                    key={p.salary}
                    className={`border-b ${p.salary === input.plan1MicroSalary ? "bg-blue-50" : ""}`}
                  >
                    <td className="py-1 px-2 text-right font-mono border-r">{formatYen(p.salary)}</td>
                    <td className="py-1 px-2 text-right font-mono border-r">{formatYen(p.ownerNetIncome)}</td>
                    <td className={`py-1 px-2 text-right font-mono border-r ${p.corporateRetained < 0 ? "text-red-600" : ""}`}>
                      {formatYen(p.corporateRetained)}
                    </td>
                    <td className="py-1 px-2 text-right font-mono border-r">{formatYen(p.combinedNetIncome)}</td>
                    <td className={`py-1 px-2 text-right font-mono ${diff >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {diff >= 0 ? "+" : ""}{formatYen(diff)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* PLAN2 コメント */}
        {(() => {
          const best = plan1Points.reduce((a, b) =>
            (b.combinedNetIncome - currentNetIncome) > (a.combinedNetIncome - currentNetIncome) ? b : a
          );
          const bestDiff = best.combinedNetIncome - currentNetIncome;
          const ownerDiff = best.ownerNetIncome - currentNetIncome;
          // 役員手取り >= 現在の個人手取額 かつ 合算CFがプラスになるケース
          const maintained = plan1Points.filter(
            (p) => p.ownerNetIncome >= currentNetIncome && p.combinedNetIncome > currentNetIncome
          );
          const bestMaintained = maintained.length > 0
            ? maintained.reduce((a, b) =>
                (b.combinedNetIncome - currentNetIncome) > (a.combinedNetIncome - currentNetIncome) ? b : a
              )
            : null;
          return (
            <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm space-y-1">
              <p>
                合算CF手取りの現在との比較が最大になるのは、役員報酬
                <span className="font-bold text-blue-700"> {formatYen(best.salary)} </span>
                のときで、現在より
                <span className={`font-bold ${bestDiff >= 0 ? "text-green-700" : "text-red-600"}`}>
                  {" "}{bestDiff >= 0 ? "+" : ""}{formatYen(bestDiff)}
                </span>
                {bestDiff >= 0 ? " 有利" : " 不利"}になります。
              </p>
              <p>
                ただし、その場合の役員手取りは
                <span className="font-bold"> {formatYen(best.ownerNetIncome)} </span>
                となり、現在の個人手取額と比べると
                <span className={`font-bold ${ownerDiff >= 0 ? "text-green-700" : "text-red-600"}`}>
                  {" "}{ownerDiff >= 0 ? "+" : ""}{formatYen(ownerDiff)}
                </span>
                {ownerDiff < 0 ? "（個人の手取りは減少します）" : ""}。
              </p>
              {bestMaintained ? (
                <p>
                  現在の手取りを維持しつつ合算CFがプラスになるのは、役員報酬
                  <span className="font-bold text-blue-700"> {formatYen(bestMaintained.salary)} </span>
                  のときで、合算CF差額は
                  <span className="font-bold text-green-700">
                    {" "}+{formatYen(bestMaintained.combinedNetIncome - currentNetIncome)}
                  </span>
                  です。
                </p>
              ) : (
                <p className="text-red-600">
                  現在の手取りを維持しつつ合算CFがプラスになる役員報酬額はありません。
                </p>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
