"use client";

import { useHojinnariStore } from "@/stores/hojinnari-store";
import { useShallow } from "zustand/react/shallow";
import { calcIndividual, calcFamilyMemberTax } from "@/lib/hojinnari-calc";
import { Input } from "@/components/ui/input";
import type { FamilyMemberResult } from "@/types/hojinnari";
import { SectionRow, DataRow, type ColConfig } from "./sim-table-cells";

const ZERO_MEMBER: FamilyMemberResult = {
  salaryIncome: 0, salaryAfterDeduction: 0, pensionIncome: 0, pensionAfterDeduction: 0, otherIncome: 0,
  totalIncome: 0, socialInsurance: 0, otherDeductions: 0, basicDeduction: 0,
  totalDeductions: 0, taxableIncome: 0, incomeTax: 0, residentTax: 0,
  taxTotal: 0, netIncome: 0,
};

// ---- ヘッダー入力部 ----

interface HeaderProps {
  blueDeduction: number;
  ownerAge: number;
  hasSpouse: boolean;
  isChildcareHousehold: boolean;
  onBlueDeduction: (v: number) => void;
  onOwnerAge: (v: number) => void;
  onHasSpouse: (v: boolean) => void;
  onChildcareHousehold: (v: boolean) => void;
}

function SimHeader(p: HeaderProps) {
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
        <th className="py-1.5 px-2 text-center text-xs font-bold w-32 bg-blue-100">合計</th>
      </tr>
    </thead>
  );
}

// ---- メインコンポーネント ----

export function SimulationSheet() {
  const { input, setInput, setSpouse } = useHojinnariStore(
    useShallow((s) => ({
      input: s.input,
      setInput: s.setInput,
      setSpouse: s.setSpouse,
    }))
  );

  const cols: ColConfig = {
    showSpouse: input.hasSpouse,
  };

  const taxYear = useHojinnariStore((s) => s.taxYear);
  const ownerResult = calcIndividual(input, taxYear);
  const isChildcare = input.isChildcareHousehold;
  const sr = input.hasSpouse
    ? calcFamilyMemberTax(input.spouse, isChildcare, taxYear)
    : ZERO_MEMBER;

  const colCount = 2 + (cols.showSpouse ? 1 : 0) + 1;

  // 配偶者入力値のショートカット
  const sp = input.spouse;

  return (
    <div className="p-4 space-y-4">
      <SimHeader
        blueDeduction={input.blueDeduction}
        ownerAge={input.ownerAge}
        hasSpouse={input.hasSpouse}
        isChildcareHousehold={input.isChildcareHousehold}
        onBlueDeduction={(v) => setInput({ blueDeduction: v })}
        onOwnerAge={(v) => setInput({ ownerAge: v })}
        onHasSpouse={(v) => setInput({ hasSpouse: v })}
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
              cols={cols}
              hideTotal
              ownerOnChange={(v) => setInput({ ownerAge: v })}
              spouseOnChange={(v) => setSpouse({ age: v })}
            />
            <SectionRow label="▼ 収入" colCount={colCount} />
            <DataRow
              label="事業所得金額"
              ownerValue={input.businessIncome}
              spouseValue={null}
              totalValue={input.businessIncome}
              cols={cols}
              ownerOnChange={(v) => setInput({ businessIncome: v })}
            />
            <DataRow
              label="青色申告特別控除"
              ownerValue={-input.blueDeduction}
              spouseValue={null}
              totalValue={-input.blueDeduction}
              cols={cols}
            />
            <DataRow
              label="事業所得（控除後）"
              ownerValue={ownerResult.adjustedIncome}
              spouseValue={null}
              totalValue={ownerResult.adjustedIncome}
              bold cols={cols}
            />
            <DataRow
              label="青色事業専従者給与"
              ownerValue={0}
              spouseValue={input.spouseBusinessSalary}
              totalValue={input.spouseBusinessSalary}
              cols={cols}
              spouseOnChange={(v) => setInput({ spouseBusinessSalary: v })}
            />
            <DataRow
              label="給与収入（他社）"
              ownerValue={input.ownerSalaryIncome}
              spouseValue={sp.salaryIncome}
              cols={cols}
              ownerOnChange={(v) => setInput({ ownerSalaryIncome: v })}
              spouseOnChange={(v) => setSpouse({ salaryIncome: v })}
            />
            <DataRow
              label="給与所得金額"
              ownerValue={ownerResult.salaryAfterDeduction}
              spouseValue={sr.salaryAfterDeduction}
              cols={cols}
            />
            <DataRow
              label="年金収入"
              ownerValue={input.ownerPensionIncome}
              spouseValue={sp.pensionIncome}
              cols={cols}
              ownerOnChange={(v) => setInput({ ownerPensionIncome: v })}
              spouseOnChange={(v) => setSpouse({ pensionIncome: v })}
            />
            <DataRow
              label="年金雑所得"
              ownerValue={ownerResult.pensionAfterDeduction}
              spouseValue={sr.pensionAfterDeduction}
              cols={cols}
            />
            <DataRow
              label="他の所得金額"
              ownerValue={input.ownerOtherIncome}
              spouseValue={sp.otherIncome}
              cols={cols}
              ownerOnChange={(v) => setInput({ ownerOtherIncome: v })}
              spouseOnChange={(v) => setSpouse({ otherIncome: v })}
            />
            <DataRow
              label="所得金額（合計）"
              ownerValue={ownerResult.totalIncome}
              spouseValue={sr.totalIncome}
              bold cols={cols}
            />

            <SectionRow label="▼ 所得控除" colCount={colCount} />
            <DataRow
              label="社会保険料控除額"
              ownerValue={input.ownerNationalInsurance}
              spouseValue={sp.socialInsurance}
              cols={cols}
              ownerOnChange={(v) => setInput({ ownerNationalInsurance: v })}
              spouseOnChange={(v) => setSpouse({ socialInsurance: v })}
            />
            <DataRow
              label="その他所得控除"
              ownerValue={input.ownerOtherDeductions}
              spouseValue={sp.otherDeductions}
              cols={cols}
              ownerOnChange={(v) => setInput({ ownerOtherDeductions: v })}
              spouseOnChange={(v) => setSpouse({ otherDeductions: v })}
            />
            <DataRow
              label="基礎控除"
              ownerValue={ownerResult.basicDeduction}
              spouseValue={sr.basicDeduction}
              cols={cols}
            />
            <DataRow
              label="所得控除合計"
              ownerValue={ownerResult.totalDeductions}
              spouseValue={sr.totalDeductions}
              bold cols={cols}
            />

            <SectionRow label="▼ 税金計算" colCount={colCount} />
            <DataRow
              label="課税所得金額"
              ownerValue={ownerResult.taxableIncome}
              spouseValue={sr.taxableIncome}
              cols={cols}
            />
            <DataRow
              label="所得税"
              ownerValue={ownerResult.incomeTax}
              spouseValue={sr.incomeTax}
              cols={cols}
            />
            <DataRow
              label="住民税"
              ownerValue={ownerResult.residentTax}
              spouseValue={sr.residentTax}
              cols={cols}
            />
            <DataRow
              label="個人税金合計"
              ownerValue={ownerResult.taxTotal}
              spouseValue={sr.taxTotal}
              bold cols={cols}
            />
            <DataRow
              label="個人事業税"
              ownerValue={ownerResult.individualBusinessTax}
              spouseValue={null}
              totalValue={ownerResult.individualBusinessTax}
              cols={cols}
            />

            <SectionRow label="▼ 社会保険" colCount={colCount} />
            <DataRow
              label="国保・健康保険"
              ownerValue={input.ownerNationalInsurance}
              spouseValue={sp.socialInsurance}
              cols={cols}
            />
            <DataRow
              label="社会保険計"
              ownerValue={input.ownerNationalInsurance}
              spouseValue={sp.socialInsurance}
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
              cols={cols}
            />
            <DataRow
              label="手取り額"
              ownerValue={ownerResult.netIncome}
              spouseValue={sr.netIncome}
              totalValue={ownerResult.combinedNetIncome}
              bold cols={cols}
            />
          </tbody>
        </table>
      </div>

    </div>
  );
}
