"use client";

import { useState } from "react";
import { useHojinnariStore } from "@/stores/hojinnari-store";
import { useShallow } from "zustand/react/shallow";
import { calcIndividual, calcFamilyMemberTax } from "@/lib/hojinnari-calc";
import { formatYen } from "@/lib/format";
import { Input } from "@/components/ui/input";
import type { FamilyMemberResult, DecisionMeasure } from "@/types/hojinnari";

const ZERO_MEMBER: FamilyMemberResult = {
  salaryIncome: 0, salaryAfterDeduction: 0, pensionIncome: 0, pensionAfterDeduction: 0, otherIncome: 0,
  totalIncome: 0, socialInsurance: 0, otherDeductions: 0, basicDeduction: 0,
  totalDeductions: 0, taxableIncome: 0, incomeTax: 0, residentTax: 0,
  taxTotal: 0, netIncome: 0,
};
import {
  SectionRow,
  DataRow,
  type ColConfig,
} from "./sim-table-cells";

// ---- ヘッダー入力部 ----

interface HeaderProps {
  blueDeduction: number;
  ownerAge: number;
  hasSpouse: boolean;
  childCount: 0 | 1 | 2;
  isChildcareHousehold: boolean;
  onBlueDeduction: (v: number) => void;
  onOwnerAge: (v: number) => void;
  onHasSpouse: (v: boolean) => void;
  onChildCount: (v: 0 | 1 | 2) => void;
  onChildcareHousehold: (v: boolean) => void;
}

function SimHeader(p: HeaderProps) {
  const handleChild1 = (checked: boolean) => {
    p.onChildCount(checked ? Math.max(1, p.childCount) as 0 | 1 | 2 : 0);
  };
  const handleChild2 = (checked: boolean) => {
    p.onChildCount(checked ? 2 : Math.min(1, p.childCount) as 0 | 1 | 2);
  };

  return (
    <div className="bg-white rounded border p-3">
      <p className="text-xs text-gray-500 mb-2">
        円単位で入力してください。黄色のセルが入力欄です。
      </p>
      <div className="flex flex-wrap gap-4 items-center text-sm">
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={p.hasSpouse}
            onChange={(e) => p.onHasSpouse(e.target.checked)}
            className="mr-1"
          />
          配偶者
        </label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={p.childCount >= 1}
            onChange={(e) => handleChild1(e.target.checked)}
            className="mr-1"
          />
          子1
        </label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={p.childCount >= 2}
            onChange={(e) => handleChild2(e.target.checked)}
            className="mr-1"
          />
          子2
        </label>
        <div className="flex items-center gap-2 ml-4">
          <span className="text-gray-500">青色申告:</span>
          <select
            className="border rounded px-2 py-0.5 text-xs"
            value={p.blueDeduction}
            onChange={(e) => p.onBlueDeduction(Number(e.target.value))}
          >
            <option value={650000}>65万（電子）</option>
            <option value={550000}>55万（正規）</option>
            <option value={100000}>10万（簡易）</option>
            <option value={0}>なし</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500">年齢:</span>
          <Input
            type="number"
            className="w-16 h-7 text-xs px-2"
            value={p.ownerAge || ""}
            onChange={(e) => p.onOwnerAge(Number(e.target.value) || 0)}
            placeholder="45"
          />
        </div>
        <label className="flex items-center gap-1 text-xs">
          <input
            type="checkbox"
            checked={p.isChildcareHousehold}
            onChange={(e) => p.onChildcareHousehold(e.target.checked)}
            className="mr-1"
          />
          子育て・介護世帯
        </label>
      </div>
    </div>
  );
}

// ---- テーブルヘッダー ----

function TableHead({ cols }: { cols: ColConfig }) {
  return (
    <thead>
      <tr className="bg-gray-100 border-b-2">
        <th className="py-1.5 px-2 text-left text-xs font-bold border-r w-36">項目</th>
        <th className="py-1.5 px-2 text-center text-xs font-bold border-r w-32">事業主</th>
        {cols.showSpouse && (
          <th className="py-1.5 px-2 text-center text-xs font-bold border-r w-32">配偶者</th>
        )}
        {cols.showChild1 && (
          <th className="py-1.5 px-2 text-center text-xs font-bold border-r w-32">子供1</th>
        )}
        {cols.showChild2 && (
          <th className="py-1.5 px-2 text-center text-xs font-bold border-r w-32">子供2</th>
        )}
        <th className="py-1.5 px-2 text-center text-xs font-bold w-32 bg-blue-100">合計</th>
      </tr>
    </thead>
  );
}

// ---- 決算対策テーブル ----

function DecisionMeasureYenInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Input
      className="w-full text-right text-xs h-7 px-1"
      value={focused ? (value === 0 ? "" : String(value)) : (value === 0 ? "" : formatYen(value))}
      onChange={(e) => {
        const str = e.target.value.replace(/[^\d]/g, "");
        onChange(str === "" ? 0 : parseInt(str, 10));
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholder="0"
    />
  );
}

function DecisionMeasuresTable() {
  const { decisionMeasures: measures, setDecisionMeasure: onMeasureChange } = useHojinnariStore(
    useShallow((s) => ({ decisionMeasures: s.decisionMeasures, setDecisionMeasure: s.setDecisionMeasure }))
  );

  const totals = (measures ?? []).reduce(
    (acc, m) => ({
      corporateExpense: acc.corporateExpense + m.corporateExpense,
      taxDeductible: acc.taxDeductible + m.taxDeductible,
      personalIncomeIncrease: acc.personalIncomeIncrease + m.personalIncomeIncrease,
      hiddenAssetIncrease: acc.hiddenAssetIncrease + m.hiddenAssetIncrease,
    }),
    { corporateExpense: 0, taxDeductible: 0, personalIncomeIncrease: 0, hiddenAssetIncrease: 0 }
  );

  const thCls = "py-1.5 px-2 text-center text-xs font-bold text-white bg-[#1f3f7a] border border-gray-400";
  const tdCls = "py-0.5 px-1 border border-gray-300 text-xs";
  const tdBoldCls = "py-1 px-2 text-right text-xs font-bold font-mono border border-gray-300";

  return (
    <div className="bg-white rounded border p-4 space-y-2">
      <h2 className="font-bold text-sm border-b pb-2">法人成り後に実施する決算対策</h2>
      <p className="text-xs text-gray-500">報告書の計算に影響します。</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-xs">
          <thead>
            <tr>
              <th className={`${thCls} text-left w-36`}>項目</th>
              <th className={thCls}>法人支出額</th>
              <th className={thCls}>損金算入額</th>
              <th className={thCls}>個人手取り増加</th>
              <th className={thCls}>法人の簿外資産</th>
            </tr>
          </thead>
          <tbody>
            {(measures ?? []).map((m, i) => (
              <tr key={i} className={i < 4 ? "bg-yellow-50" : ""}>
                <td className={tdCls}>
                  <Input
                    className="w-full text-xs h-7 px-1"
                    value={m.name}
                    onChange={(e) => onMeasureChange(i, { name: e.target.value })}
                    placeholder={i < 4 ? undefined : "項目名"}
                  />
                </td>
                <td className={tdCls}>
                  <DecisionMeasureYenInput
                    value={m.corporateExpense}
                    onChange={(v) => onMeasureChange(i, { corporateExpense: v })}
                  />
                </td>
                <td className={tdCls}>
                  <DecisionMeasureYenInput
                    value={m.taxDeductible}
                    onChange={(v) => onMeasureChange(i, { taxDeductible: v })}
                  />
                </td>
                <td className={tdCls}>
                  <DecisionMeasureYenInput
                    value={m.personalIncomeIncrease}
                    onChange={(v) => onMeasureChange(i, { personalIncomeIncrease: v })}
                  />
                </td>
                <td className={tdCls}>
                  <DecisionMeasureYenInput
                    value={m.hiddenAssetIncrease}
                    onChange={(v) => onMeasureChange(i, { hiddenAssetIncrease: v })}
                  />
                </td>
              </tr>
            ))}
            <tr className="bg-gray-100">
              <td className="py-1 px-2 text-xs font-bold border border-gray-300">合計</td>
              <td className={tdBoldCls}>{totals.corporateExpense > 0 ? formatYen(totals.corporateExpense) : ""}</td>
              <td className={tdBoldCls}>{totals.taxDeductible > 0 ? formatYen(totals.taxDeductible) : ""}</td>
              <td className={tdBoldCls}>{totals.personalIncomeIncrease > 0 ? formatYen(totals.personalIncomeIncrease) : ""}</td>
              <td className={tdBoldCls}>{totals.hiddenAssetIncrease > 0 ? formatYen(totals.hiddenAssetIncrease) : ""}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---- メインコンポーネント ----

export function SimulationSheet() {
  const { input, setInput, setSpouse, setChild } = useHojinnariStore(
    useShallow((s) => ({
      input: s.input,
      setInput: s.setInput,
      setSpouse: s.setSpouse,
      setChild: s.setChild,
    }))
  );

  const cols: ColConfig = {
    showSpouse: input.hasSpouse,
    showChild1: input.childCount >= 1,
    showChild2: input.childCount >= 2,
  };

  const ownerResult = calcIndividual(input);
  // ゼロ値フォールバックで ?? を JSX 内で使わないようにする
  const isChildcare = input.isChildcareHousehold;
  const sr = input.hasSpouse
    ? calcFamilyMemberTax(input.spouse, isChildcare)
    : ZERO_MEMBER;
  const cr1 = input.childCount >= 1
    ? calcFamilyMemberTax(input.children[0], isChildcare)
    : ZERO_MEMBER;
  const cr2 = input.childCount >= 2
    ? calcFamilyMemberTax(input.children[1], isChildcare)
    : ZERO_MEMBER;

  const colCount =
    2 +
    (cols.showSpouse ? 1 : 0) +
    (cols.showChild1 ? 1 : 0) +
    (cols.showChild2 ? 1 : 0) +
    1;

  // 家族メンバー値のショートカット
  const sp = input.spouse;
  const c0 = input.children[0];
  const c1 = input.children[1];

  return (
    <div className="p-4 space-y-4">
      <SimHeader
        blueDeduction={input.blueDeduction}
        ownerAge={input.ownerAge}
        hasSpouse={input.hasSpouse}
        childCount={input.childCount}
        isChildcareHousehold={input.isChildcareHousehold}
        onBlueDeduction={(v) => setInput({ blueDeduction: v })}
        onOwnerAge={(v) => setInput({ ownerAge: v })}
        onHasSpouse={(v) => setInput({ hasSpouse: v })}
        onChildCount={(v) => setInput({ childCount: v })}
        onChildcareHousehold={(v) => setInput({ isChildcareHousehold: v })}
      />

      <div className="bg-white rounded border overflow-x-auto">
        <table
          className="w-full border-collapse text-xs"
          style={{ minWidth: `${300 + colCount * 130}px` }}
        >
          <TableHead cols={cols} />
          <tbody>
            <DataRow
              label="年齢"
              ownerValue={input.ownerAge}
              spouseValue={sp.age}
              child1Value={c0.age}
              child2Value={c1.age}
              cols={cols}
              ownerOnChange={(v) => setInput({ ownerAge: v })}
              spouseOnChange={(v) => setSpouse({ age: v })}
              child1OnChange={(v) => setChild(0, { age: v })}
              child2OnChange={(v) => setChild(1, { age: v })}
            />
            <SectionRow label="▼ 収入" colCount={colCount} />
            <DataRow
              label="事業所得金額"
              ownerValue={input.businessIncome}
              spouseValue={null} child1Value={null} child2Value={null}
              totalValue={input.businessIncome}
              cols={cols}
              ownerOnChange={(v) => setInput({ businessIncome: v })}
            />
            <DataRow
              label="青色申告特別控除"
              ownerValue={-input.blueDeduction}
              spouseValue={null} child1Value={null} child2Value={null}
              totalValue={-input.blueDeduction}
              cols={cols}
            />
            <DataRow
              label="事業所得（控除後）"
              ownerValue={ownerResult.adjustedIncome}
              spouseValue={null} child1Value={null} child2Value={null}
              totalValue={ownerResult.adjustedIncome}
              bold cols={cols}
            />
            <DataRow
              label="給与収入"
              ownerValue={input.ownerSalaryIncome}
              spouseValue={sp.salaryIncome}
              child1Value={c0.salaryIncome}
              child2Value={c1.salaryIncome}
              cols={cols}
              ownerOnChange={(v) => setInput({ ownerSalaryIncome: v })}
              spouseOnChange={(v) => setSpouse({ salaryIncome: v })}
              child1OnChange={(v) => setChild(0, { salaryIncome: v })}
              child2OnChange={(v) => setChild(1, { salaryIncome: v })}
            />
            <DataRow
              label="給与所得金額"
              ownerValue={ownerResult.salaryAfterDeduction}
              spouseValue={sr.salaryAfterDeduction}
              child1Value={cr1.salaryAfterDeduction}
              child2Value={cr2.salaryAfterDeduction}
              cols={cols}
            />
            <DataRow
              label="年金収入"
              ownerValue={input.ownerPensionIncome}
              spouseValue={sp.pensionIncome}
              child1Value={c0.pensionIncome}
              child2Value={c1.pensionIncome}
              cols={cols}
              ownerOnChange={(v) => setInput({ ownerPensionIncome: v })}
              spouseOnChange={(v) => setSpouse({ pensionIncome: v })}
              child1OnChange={(v) => setChild(0, { pensionIncome: v })}
              child2OnChange={(v) => setChild(1, { pensionIncome: v })}
            />
            <DataRow
              label="年金雑所得"
              ownerValue={ownerResult.pensionAfterDeduction}
              spouseValue={sr.pensionAfterDeduction}
              child1Value={cr1.pensionAfterDeduction}
              child2Value={cr2.pensionAfterDeduction}
              cols={cols}
            />
            <DataRow
              label="他の所得金額"
              ownerValue={input.ownerOtherIncome}
              spouseValue={sp.otherIncome}
              child1Value={c0.otherIncome}
              child2Value={c1.otherIncome}
              cols={cols}
              ownerOnChange={(v) => setInput({ ownerOtherIncome: v })}
              spouseOnChange={(v) => setSpouse({ otherIncome: v })}
              child1OnChange={(v) => setChild(0, { otherIncome: v })}
              child2OnChange={(v) => setChild(1, { otherIncome: v })}
            />
            <DataRow
              label="所得金額（合計）"
              ownerValue={ownerResult.totalIncome}
              spouseValue={sr.totalIncome}
              child1Value={cr1.totalIncome}
              child2Value={cr2.totalIncome}
              bold cols={cols}
            />

            <SectionRow label="▼ 所得控除" colCount={colCount} />
            <DataRow
              label="社会保険料控除額"
              ownerValue={input.ownerNationalInsurance}
              spouseValue={sp.socialInsurance}
              child1Value={c0.socialInsurance}
              child2Value={c1.socialInsurance}
              cols={cols}
              ownerOnChange={(v) => setInput({ ownerNationalInsurance: v })}
              spouseOnChange={(v) => setSpouse({ socialInsurance: v })}
              child1OnChange={(v) => setChild(0, { socialInsurance: v })}
              child2OnChange={(v) => setChild(1, { socialInsurance: v })}
            />
            <DataRow
              label="その他所得控除"
              ownerValue={input.ownerOtherDeductions}
              spouseValue={sp.otherDeductions}
              child1Value={c0.otherDeductions}
              child2Value={c1.otherDeductions}
              cols={cols}
              ownerOnChange={(v) => setInput({ ownerOtherDeductions: v })}
              spouseOnChange={(v) => setSpouse({ otherDeductions: v })}
              child1OnChange={(v) => setChild(0, { otherDeductions: v })}
              child2OnChange={(v) => setChild(1, { otherDeductions: v })}
            />
            <DataRow
              label="基礎控除"
              ownerValue={ownerResult.basicDeduction}
              spouseValue={sr.basicDeduction}
              child1Value={cr1.basicDeduction}
              child2Value={cr2.basicDeduction}
              cols={cols}
            />
            <DataRow
              label="所得控除合計"
              ownerValue={ownerResult.totalDeductions}
              spouseValue={sr.totalDeductions}
              child1Value={cr1.totalDeductions}
              child2Value={cr2.totalDeductions}
              bold cols={cols}
            />

            <SectionRow label="▼ 税金計算" colCount={colCount} />
            <DataRow
              label="課税所得金額"
              ownerValue={ownerResult.taxableIncome}
              spouseValue={sr.taxableIncome}
              child1Value={cr1.taxableIncome}
              child2Value={cr2.taxableIncome}
              cols={cols}
            />
            <DataRow
              label="所得税"
              ownerValue={ownerResult.incomeTax}
              spouseValue={sr.incomeTax}
              child1Value={cr1.incomeTax}
              child2Value={cr2.incomeTax}
              cols={cols}
            />
            <DataRow
              label="住民税"
              ownerValue={ownerResult.residentTax}
              spouseValue={sr.residentTax}
              child1Value={cr1.residentTax}
              child2Value={cr2.residentTax}
              cols={cols}
            />
            <DataRow
              label="個人税金合計"
              ownerValue={ownerResult.taxTotal}
              spouseValue={sr.taxTotal}
              child1Value={cr1.taxTotal}
              child2Value={cr2.taxTotal}
              bold cols={cols}
            />
            <DataRow
              label="個人事業税"
              ownerValue={ownerResult.individualBusinessTax}
              spouseValue={null} child1Value={null} child2Value={null}
              totalValue={ownerResult.individualBusinessTax}
              cols={cols}
            />

            <SectionRow label="▼ 社会保険" colCount={colCount} />
            <DataRow
              label="国保・健康保険"
              ownerValue={input.ownerNationalInsurance}
              spouseValue={sp.socialInsurance}
              child1Value={c0.socialInsurance}
              child2Value={c1.socialInsurance}
              cols={cols}
            />
            <DataRow
              label="社会保険計"
              ownerValue={input.ownerNationalInsurance}
              spouseValue={sp.socialInsurance}
              child1Value={c0.socialInsurance}
              child2Value={c1.socialInsurance}
              bold cols={cols}
            />

            <SectionRow label="▼ 手取り" colCount={colCount} />
            <DataRow
              label="税金＋社会保険"
              ownerValue={
                ownerResult.taxTotal +
                ownerResult.individualBusinessTax +
                input.ownerNationalInsurance
              }
              spouseValue={(sr.taxTotal) + sp.socialInsurance}
              child1Value={(cr1.taxTotal) + c0.socialInsurance}
              child2Value={(cr2.taxTotal) + c1.socialInsurance}
              cols={cols}
            />
            <DataRow
              label="手取り額"
              ownerValue={ownerResult.netIncome}
              spouseValue={sr.netIncome}
              child1Value={cr1.netIncome}
              child2Value={cr2.netIncome}
              totalValue={ownerResult.combinedNetIncome}
              bold cols={cols}
            />
          </tbody>
        </table>
      </div>

      <DecisionMeasuresTable />
    </div>
  );
}
