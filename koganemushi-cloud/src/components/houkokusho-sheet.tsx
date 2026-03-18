"use client";

import type { CorporateTaxParams, ExecutiveInput, ExecutiveResult } from "@/types/simulation";

interface HoukokushoSheetProps {
  corporateTaxParams: CorporateTaxParams;
  currentExecutives: ExecutiveInput[];
  currentTotals: ExecutiveResult;
  currentCorporateTax: number;
  currentCorporateIncome: number;
  comparisonExecutives: ExecutiveInput[];
  comparisonTotals: ExecutiveResult;
  comparisonCorporateTax: number;
  comparisonCorporateIncome: number;
  plan2Executives: ExecutiveInput[];
  plan2Totals: ExecutiveResult;
  plan2CorporateTax: number;
  plan2CorporateIncome: number;
  onCopyToPlan2: () => void;
}

/** 差引表示用: 正負両方に対応したフォーマット（0は空白） */
function fmtDiff(value: number): string {
  if (value === 0) return "";
  if (value < 0) return `△${Math.abs(Math.round(value)).toLocaleString("ja-JP")}`;
  return Math.round(value).toLocaleString("ja-JP");
}

/** 符号付きフォーマット（赤字マーカー用クラスも返す） */
function diffClass(value: number): string {
  return value < 0 ? "text-red-600" : "";
}

/** 0 を空白にしないバージョン */
function fmtVal(value: number): string {
  if (value === 0) return "";
  return Math.round(value).toLocaleString("ja-JP");
}

// 個人欄の行定義
interface PersonalRow {
  label: string;
  getValue: (execs: ExecutiveInput[], totals: ExecutiveResult) => number;
  bold?: boolean;
  showSign?: boolean;  // 差引に正負表示を使う
}

const PERSONAL_ROWS: PersonalRow[] = [
  {
    label: "役員報酬",
    getValue: (execs) =>
      execs.reduce((s, e) => s + e.regularSalary, 0),
  },
  {
    label: "事前確定届出給与",
    getValue: (execs) =>
      execs.reduce((s, e) => s + e.predeterminedBonus1 + e.predeterminedBonus2 + e.predeterminedBonus3, 0),
  },
  {
    label: "他の給与収入",
    getValue: (execs) => execs.reduce((s, e) => s + e.otherSalaryIncome, 0),
  },
  {
    label: "確定給付年金掛金",
    getValue: (execs) => execs.reduce((s, e) => s + e.definedBenefitPension, 0),
  },
  {
    label: "配当所得",
    getValue: (execs) => execs.reduce((s, e) => s + e.dividendIncome, 0),
  },
  {
    label: "他の所得金額",
    getValue: (execs) => execs.reduce((s, e) => s + e.otherIncome, 0),
  },
  {
    label: "所得税等",
    getValue: (_, totals) => totals.totalPersonalTax,
  },
  {
    label: "社会保険料等",
    getValue: (_, totals) => totals.totalSocialInsurance,
  },
  {
    label: "個人手取り額",
    getValue: (_, totals) => totals.netIncome,
    bold: true,
  },
];

// 法人欄の行定義
interface CorporateRow {
  label: string;
  // execs, totals, corporateTax, preTaxIncome を受け取る
  getValue: (
    execs: ExecutiveInput[],
    totals: ExecutiveResult,
    corporateTax: number,
    preTaxIncome: number
  ) => number;
  bold?: boolean;
  noCurrentCol?: boolean; // 「差引」列のみの場合
}

function calcRetained(
  execs: ExecutiveInput[],
  totals: ExecutiveResult,
  corporateTax: number,
  preTaxIncome: number
): number {
  const execPay = execs.reduce(
    (s, e) =>
      s + e.regularSalary + e.predeterminedBonus1 + e.predeterminedBonus2 + e.predeterminedBonus3,
    0
  );
  const dividendTotal = execs.reduce((s, e) => s + e.dividendIncome, 0);
  return preTaxIncome - execPay - dividendTotal - corporateTax - totals.employerSocialInsurance;
}

const CORPORATE_ROWS: CorporateRow[] = [
  {
    label: "役員報酬前所得金額",
    getValue: (_, __, ___, preTaxIncome) => preTaxIncome,
  },
  {
    label: "役員報酬",
    getValue: (execs) =>
      execs.reduce(
        (s, e) =>
          s + e.regularSalary + e.predeterminedBonus1 + e.predeterminedBonus2 + e.predeterminedBonus3,
        0
      ),
  },
  {
    label: "配当金支払い",
    getValue: (execs) => execs.reduce((s, e) => s + e.dividendIncome, 0),
  },
  {
    label: "法人税等",
    getValue: (_, __, corporateTax) => corporateTax,
  },
  {
    label: "社保会社負担",
    getValue: (_, totals) => totals.employerSocialInsurance,
  },
  {
    label: "法人内部留保額",
    getValue: calcRetained,
    bold: true,
  },
];

// 計画ブロック1つを描画するコンポーネント
interface PlanBlockProps {
  label: string;
  corporateTaxParams: CorporateTaxParams;
  currentExecutives: ExecutiveInput[];
  currentTotals: ExecutiveResult;
  currentCorporateTax: number;
  comparisonExecutives: ExecutiveInput[];
  comparisonTotals: ExecutiveResult;
  comparisonCorporateTax: number;
}

function PlanBlock({
  label,
  corporateTaxParams,
  currentExecutives,
  currentTotals,
  currentCorporateTax,
  comparisonExecutives,
  comparisonTotals,
  comparisonCorporateTax,
}: PlanBlockProps) {
  const preTaxIncome = corporateTaxParams.preTaxCorporateIncome;

  // 積立額（確定給付年金掛金合計）
  const currentSavings = currentExecutives.reduce((s, e) => s + e.definedBenefitPension, 0);
  const compSavings = comparisonExecutives.reduce((s, e) => s + e.definedBenefitPension, 0);
  const savingsDiff = compSavings - currentSavings;

  // 法人内部留保
  const currentRetained = calcRetained(currentExecutives, currentTotals, currentCorporateTax, preTaxIncome);
  const compRetained = calcRetained(comparisonExecutives, comparisonTotals, comparisonCorporateTax, preTaxIncome);

  // 法人・個人合計CF
  const currentCF = currentTotals.netIncome + currentRetained;
  const compCF = comparisonTotals.netIncome + compRetained;
  const cfDiff = compCF - currentCF;

  // 増減計算
  const taxIncrease = comparisonTotals.totalPersonalTax - currentTotals.totalPersonalTax;
  const socialIncrease =
    (comparisonTotals.totalSocialInsurance + comparisonTotals.employerSocialInsurance) -
    (currentTotals.totalSocialInsurance + currentTotals.employerSocialInsurance);
  const burdenChange = taxIncrease + socialIncrease;
  const corpTaxChange = comparisonCorporateTax - currentCorporateTax;
  const netBurdenChange = burdenChange + corpTaxChange;

  const thCls = "border border-gray-400 px-2 py-0.5 text-center text-[11px] font-bold bg-[#1f5fad] text-white";
  const tdLabelCls = "border border-gray-300 px-2 py-0.5 text-[11px]";
  const tdValCls = "border border-gray-300 px-2 py-0.5 text-[11px] text-right";

  return (
    <div className="flex-1 min-w-[480px]">
      {/* PLANヘッダー */}
      <div className="bg-yellow-50 border border-yellow-400 px-3 py-1 mb-2 text-sm font-bold">
        {label}
      </div>
      <div className="text-xs font-bold mb-1 pl-1">役員報酬の変更：</div>

      <table className="border-collapse w-full text-[11px]">
        <thead>
          <tr>
            <th className={`${thCls} w-[160px]`}></th>
            <th className={thCls}>現状</th>
            <th className={thCls}>役員報酬変更</th>
            <th className={thCls}>差引</th>
          </tr>
        </thead>
        <tbody>
          {/* 個人手取り額ヘッダー */}
          <tr>
            <td colSpan={4} className="border border-gray-300 px-2 py-0.5 text-[11px] font-bold bg-gray-50">
              個人手取り額：
            </td>
          </tr>

          {/* 個人欄 */}
          {PERSONAL_ROWS.map((row) => {
            const currVal = row.getValue(currentExecutives, currentTotals);
            const compVal = row.getValue(comparisonExecutives, comparisonTotals);
            // 確定給付年金掛金は「取られる額」なのでマイナス表示
            const diff = compVal - currVal;
            return (
              <tr key={row.label} className={row.bold ? "bg-blue-50" : ""}>
                <td className={`${tdLabelCls} ${row.bold ? "font-bold" : ""}`}>{row.label}</td>
                <td className={`${tdValCls} ${row.bold ? "font-bold" : ""}`}>{fmtVal(currVal)}</td>
                <td className={`${tdValCls} ${row.bold ? "font-bold" : ""}`}>{fmtVal(compVal)}</td>
                <td className={`${tdValCls} ${diffClass(diff)} ${row.bold ? "font-bold" : ""}`}>
                  {fmtDiff(diff)}
                </td>
              </tr>
            );
          })}

          {/* 積立額（個人欄末尾） */}
          <tr>
            <td className={tdLabelCls}>積立額</td>
            <td className={tdValCls}></td>
            <td className={tdValCls}></td>
            <td className={`${tdValCls} ${diffClass(savingsDiff)}`}>{fmtDiff(savingsDiff)}</td>
          </tr>

          {/* 法人内部留保ヘッダー */}
          <tr>
            <td colSpan={4} className="border border-gray-300 px-2 py-0.5 text-[11px] font-bold bg-gray-50">
              法人内部留保額：
            </td>
          </tr>

          {/* 法人欄 */}
          {CORPORATE_ROWS.map((row) => {
            const currVal = row.getValue(currentExecutives, currentTotals, currentCorporateTax, preTaxIncome);
            const compVal = row.getValue(comparisonExecutives, comparisonTotals, comparisonCorporateTax, preTaxIncome);
            const diff = compVal - currVal;
            return (
              <tr key={row.label} className={row.bold ? "bg-blue-50" : ""}>
                <td className={`${tdLabelCls} ${row.bold ? "font-bold" : ""}`}>{row.label}</td>
                <td className={`${tdValCls} ${row.bold ? "font-bold" : ""}`}>{fmtVal(currVal)}</td>
                <td className={`${tdValCls} ${row.bold ? "font-bold" : ""}`}>{fmtVal(compVal)}</td>
                <td className={`${tdValCls} ${diffClass(diff)} ${row.bold ? "font-bold" : ""}`}>
                  {fmtDiff(diff)}
                </td>
              </tr>
            );
          })}

          {/* 法人・個人合計CF */}
          <tr className="bg-blue-100">
            <td className="border border-gray-300 px-2 py-0.5 text-[11px] font-bold">法人・個人合計CF</td>
            <td className="border border-gray-300 px-2 py-0.5 text-[11px] text-right font-bold">{fmtVal(currentCF)}</td>
            <td className="border border-gray-300 px-2 py-0.5 text-[11px] text-right font-bold">{fmtVal(compCF)}</td>
            <td className={`border border-gray-300 px-2 py-0.5 text-[11px] text-right font-bold ${diffClass(cfDiff)}`}>
              {fmtDiff(cfDiff)}
            </td>
          </tr>

          {/* 積立額（サマリー） */}
          <tr>
            <td className={tdLabelCls}>積立額</td>
            <td className={tdValCls}></td>
            <td className={tdValCls}></td>
            <td className={`${tdValCls} ${diffClass(savingsDiff)}`}>{fmtDiff(savingsDiff)}</td>
          </tr>

          {/* 増減サマリー */}
          <tr className={taxIncrease !== 0 ? "" : ""}>
            <td className="border border-gray-300 px-2 py-0.5 text-[11px] font-bold">所得税等の増減</td>
            <td className={tdValCls}></td>
            <td className={tdValCls}></td>
            <td className={`${tdValCls} font-bold ${diffClass(taxIncrease)}`}>{fmtDiff(taxIncrease)}</td>
          </tr>
          <tr>
            <td className="border border-gray-300 px-2 py-0.5 text-[11px] font-bold">社会保険料の増減</td>
            <td className={tdValCls}></td>
            <td className={tdValCls}></td>
            <td className={`${tdValCls} font-bold ${diffClass(socialIncrease)}`}>{fmtDiff(socialIncrease)}</td>
          </tr>
          <tr className="bg-orange-50">
            <td className="border border-gray-300 px-2 py-0.5 text-[11px] font-bold">負担増減</td>
            <td className={tdValCls}></td>
            <td className={tdValCls}></td>
            <td className={`${tdValCls} font-bold ${diffClass(burdenChange)}`}>{fmtDiff(burdenChange)}</td>
          </tr>
          <tr>
            <td className="border border-gray-300 px-2 py-0.5 text-[11px] font-bold">法人税増減</td>
            <td className={tdValCls}></td>
            <td className={tdValCls}></td>
            <td className={`${tdValCls} font-bold ${diffClass(corpTaxChange)}`}>{fmtDiff(corpTaxChange)}</td>
          </tr>
          <tr className="bg-orange-100">
            <td className="border border-gray-300 px-2 py-0.5 text-[11px] font-bold">差引負担増減</td>
            <td className={tdValCls}></td>
            <td className={tdValCls}></td>
            <td className={`${tdValCls} font-bold ${diffClass(netBurdenChange)}`}>{fmtDiff(netBurdenChange)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function HoukokushoSheet({
  corporateTaxParams,
  currentExecutives,
  currentTotals,
  currentCorporateTax,
  currentCorporateIncome,
  comparisonExecutives,
  comparisonTotals,
  comparisonCorporateTax,
  comparisonCorporateIncome,
  plan2Executives,
  plan2Totals,
  plan2CorporateTax,
  plan2CorporateIncome,
  onCopyToPlan2,
}: HoukokushoSheetProps) {
  return (
    <div className="p-6">
      {/* ヘッダー */}
      <div className="flex items-start justify-between mb-4">
        <h2 className="text-base font-bold">役員報酬・配当シミュレーション</h2>
        <div className="flex items-center gap-4">
          <button
            onClick={onCopyToPlan2}
            className="text-xs border border-blue-400 text-blue-700 rounded px-3 py-1 hover:bg-blue-50 transition-colors"
          >
            PLAN１をPLAN２にコピー
          </button>
          <div className="text-xs text-gray-600 border border-gray-300 rounded px-2 py-1">
            ● 円単位
          </div>
        </div>
      </div>

      {/* PLANブロック (横並び) */}
      <div className="flex gap-6 flex-wrap">
        <PlanBlock
          label="PLAN１："
          corporateTaxParams={corporateTaxParams}
          currentExecutives={currentExecutives}
          currentTotals={currentTotals}
          currentCorporateTax={currentCorporateTax}
          comparisonExecutives={comparisonExecutives}
          comparisonTotals={comparisonTotals}
          comparisonCorporateTax={comparisonCorporateTax}
        />
        <PlanBlock
          label="PLAN２："
          corporateTaxParams={corporateTaxParams}
          currentExecutives={currentExecutives}
          currentTotals={currentTotals}
          currentCorporateTax={currentCorporateTax}
          comparisonExecutives={plan2Executives}
          comparisonTotals={plan2Totals}
          comparisonCorporateTax={plan2CorporateTax}
        />
      </div>
    </div>
  );
}
