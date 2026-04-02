"use client";

import { useHojinnariStore } from "@/stores/hojinnari-store";
import { useShallow } from "zustand/react/shallow";
import { calcHojinnari } from "@/lib/hojinnari-calc";
import { formatYen, parseYen } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

function YenInput({
  value,
  onChange,
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  className?: string;
}) {
  return (
    <Input
      className={className}
      value={value === 0 ? "" : formatYen(value)}
      onChange={(e) => {
        const raw = parseYen(e.target.value);
        onChange(Number(raw) || 0);
      }}
      placeholder="0"
    />
  );
}

function ResultRow({
  label,
  individual,
  corporate,
  diff,
}: {
  label: string;
  individual: number;
  corporate: number;
  diff?: boolean;
}) {
  const diffValue = corporate - individual;
  return (
    <tr className="border-b last:border-0">
      <td className="py-1.5 pr-4 text-sm text-gray-600 whitespace-nowrap">{label}</td>
      <td className="py-1.5 px-4 text-right text-sm font-mono">{formatYen(individual)}</td>
      <td className="py-1.5 px-4 text-right text-sm font-mono">{formatYen(corporate)}</td>
      {diff && (
        <td
          className={`py-1.5 pl-4 text-right text-sm font-mono font-bold ${
            diffValue >= 0 ? "text-blue-600" : "text-red-600"
          }`}
        >
          {diffValue >= 0 ? "+" : ""}
          {formatYen(diffValue)}
        </td>
      )}
    </tr>
  );
}

export function SimulationSheet() {
  const { input, rates, setInput } = useHojinnariStore(
    useShallow((s) => ({ input: s.input, rates: s.rates, setInput: s.setInput }))
  );

  const result = calcHojinnari(input, rates);
  const { individual, corporate, difference } = result;

  return (
    <div className="p-4 space-y-6">
      {/* 入力セクション */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 個人事業主 */}
        <div className="bg-white rounded-lg border p-4 space-y-3">
          <h2 className="font-bold text-base border-b pb-2">個人事業主</h2>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <label className="flex items-center text-gray-600">事業所得（売上－経費）</label>
            <YenInput
              value={input.businessIncome}
              onChange={(v) => setInput({ businessIncome: v })}
            />

            <label className="flex items-center text-gray-600">青色申告特別控除</label>
            <select
              className="border rounded px-2 py-1 text-sm"
              value={input.blueDeduction}
              onChange={(e) => setInput({ blueDeduction: Number(e.target.value) })}
            >
              <option value={650000}>65万円（電子申告）</option>
              <option value={550000}>55万円（正規簿記）</option>
              <option value={100000}>10万円（簡易簿記）</option>
              <option value={0}>なし</option>
            </select>

            <label className="flex items-center text-gray-600">専従者給与</label>
            <YenInput
              value={input.spouseExpense}
              onChange={(v) => setInput({ spouseExpense: v })}
            />

            <label className="flex items-center text-gray-600">代表者年齢</label>
            <Input
              type="number"
              value={input.ownerAge || ""}
              onChange={(e) => setInput({ ownerAge: Number(e.target.value) || 0 })}
              placeholder="45"
            />

            <label className="flex items-center text-gray-600">国保＋国民年金（年額）</label>
            <YenInput
              value={input.ownerNationalInsurance}
              onChange={(v) => setInput({ ownerNationalInsurance: v })}
            />

            <label className="flex items-center text-gray-600">その他所得控除</label>
            <YenInput
              value={input.ownerOtherDeductions}
              onChange={(v) => setInput({ ownerOtherDeductions: v })}
            />

            <label className="flex col-span-2 items-center gap-2 text-gray-600">
              <Checkbox
                checked={input.isChildcareHousehold}
                onCheckedChange={(c) => setInput({ isChildcareHousehold: !!c })}
              />
              子育て・介護世帯（給与所得控除の特例対象）
            </label>
          </div>
        </div>

        {/* 法人 */}
        <div className="bg-white rounded-lg border p-4 space-y-3">
          <h2 className="font-bold text-base border-b pb-2">法人（法人なり後）</h2>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <label className="flex items-center text-gray-600">役員給与（年額）</label>
            <YenInput
              value={input.corporateSalary}
              onChange={(v) => setInput({ corporateSalary: v })}
            />

            <label className="flex items-center text-gray-600">専従者給与（年額）</label>
            <YenInput
              value={input.spouseSalary}
              onChange={(v) => setInput({ spouseSalary: v })}
            />

            <div className="col-span-2 text-xs text-gray-400 pt-1">
              ※ 事業所得・青色控除・その他設定は左の個人事業主欄から共用します
            </div>
          </div>
        </div>
      </div>

      {/* 比較結果テーブル */}
      <div className="bg-white rounded-lg border p-4">
        <h2 className="font-bold text-base border-b pb-2 mb-3">比較結果</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px]">
            <thead>
              <tr className="border-b">
                <th className="text-left py-1.5 pr-4 text-sm text-gray-500 font-medium">項目</th>
                <th className="text-right py-1.5 px-4 text-sm text-gray-500 font-medium">個人事業主</th>
                <th className="text-right py-1.5 px-4 text-sm text-gray-500 font-medium">法人</th>
                <th className="text-right py-1.5 pl-4 text-sm text-gray-500 font-medium">差額（法人－個人）</th>
              </tr>
            </thead>
            <tbody>
              <ResultRow
                label="事業所得"
                individual={individual.businessIncome}
                corporate={corporate.ownerSalary + (input.spouseSalary || 0) + corporate.corporateIncome}
              />
              <ResultRow
                label="青色申告控除"
                individual={individual.blueDeduction}
                corporate={0}
              />
              <ResultRow
                label="専従者給与"
                individual={individual.spouseExpense}
                corporate={input.spouseSalary}
              />
              <ResultRow
                label="社会保険料"
                individual={individual.nationalInsurance}
                corporate={corporate.ownerSocialInsurance}
              />
              <ResultRow
                label="法人税・事業税"
                individual={0}
                corporate={corporate.corporateTax + corporate.businessTax}
              />
              <ResultRow
                label="所得税（復興特別税込）"
                individual={individual.incomeTax}
                corporate={corporate.ownerIncomeTax}
              />
              <ResultRow
                label="住民税"
                individual={individual.residentTax}
                corporate={corporate.ownerResidentTax}
              />
              <ResultRow
                label="法人内部留保"
                individual={0}
                corporate={corporate.corporateRetained}
              />
            </tbody>
            <tfoot>
              <tr className="border-t-2 font-bold">
                <td className="py-2 pr-4 text-sm">手取り合計</td>
                <td className="py-2 px-4 text-right font-mono text-base">{formatYen(individual.netIncome)}</td>
                <td className="py-2 px-4 text-right font-mono text-base">{formatYen(corporate.totalNetIncome)}</td>
                <td
                  className={`py-2 pl-4 text-right font-mono text-base ${
                    difference >= 0 ? "text-blue-600" : "text-red-600"
                  }`}
                >
                  {difference >= 0 ? "+" : ""}
                  {formatYen(difference)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {difference !== 0 && (
          <p className="mt-3 text-sm font-medium text-center">
            {difference > 0 ? (
              <span className="text-blue-700">
                法人の方が年間 <strong>{formatYen(difference)}</strong> 手取りが多くなります
              </span>
            ) : (
              <span className="text-red-700">
                個人事業主の方が年間 <strong>{formatYen(-difference)}</strong> 手取りが多くなります
              </span>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
