"use client";

import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatYen } from "@/lib/format";
import {
  mapExtractedToInput,
  type ExtractedPLData,
  type ExtractedRawValues,
} from "@/lib/pdf-pl-extract";
import type { PLPeriodInput } from "@/types/block-puzzle";

interface Props {
  open: boolean;
  extracted: ExtractedPLData;
  onCancel: () => void;
  onApply: (input: PLPeriodInput) => void;
}

const RAW_ROWS: { label: string; key: keyof ExtractedRawValues }[] = [
  { label: "売上高計", key: "salesTotal" },
  { label: "売上原価計", key: "costOfSalesTotal" },
  { label: "役員報酬", key: "executiveCompensation" },
  { label: "役員賞与", key: "executiveBonus" },
  { label: "給料手当", key: "salaryAllowance" },
  { label: "雑給", key: "miscellaneousSalary" },
  { label: "賞与", key: "bonus" },
  { label: "退職金", key: "retirementBenefits" },
  { label: "法定福利費", key: "legalWelfare" },
  { label: "販売管理費計", key: "sellingAdminTotal" },
  { label: "営業外収益計", key: "nonOperatingIncome" },
  { label: "営業外費用計", key: "nonOperatingExpense" },
  { label: "特別利益計", key: "extraordinaryIncome" },
  { label: "特別損失計", key: "extraordinaryLoss" },
  { label: "減価償却費", key: "depreciation" },
  { label: "法人税等計", key: "corporateTaxEtc" },
  { label: "税引前当期純利益", key: "preTaxIncome" },
];

export function PdfImportDialog({ open, extracted, onCancel, onApply }: Props) {
  const mapped = useMemo(() => mapExtractedToInput(extracted), [extracted]);
  const [periodLabel, setPeriodLabel] = useState(mapped.input.periodLabel);

  const apply = () => {
    onApply({ ...mapped.input, periodLabel });
  };

  const d = mapped.derivation;
  const pdfPreTax = extracted.raw.preTaxIncome;
  const preTaxMatch = pdfPreTax !== undefined && d.expectedPreTax === pdfPreTax;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onCancel(); } }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>PDF読込結果の確認</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <label className="flex items-center gap-2">
            <span className="text-gray-700 w-20">期末日</span>
            <input
              type="text"
              value={periodLabel}
              onChange={(e) => setPeriodLabel(e.target.value)}
              className="border rounded px-2 py-1 flex-1"
              placeholder="例: 2025/6/30"
            />
          </label>

          <div>
            <h3 className="font-bold mb-1">PDFから抽出した値</h3>
            <table className="w-full border-collapse text-xs">
              <tbody>
                {RAW_ROWS.map((row) => {
                  const val = extracted.raw[row.key];
                  return (
                    <tr key={String(row.key)}>
                      <td className="border px-2 py-1 bg-gray-50">{row.label}</td>
                      <td className="border px-2 py-1 text-right tabular-nums">
                        {val === undefined ? (
                          <span className="text-gray-400">-</span>
                        ) : (
                          formatYen(val as number)
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div>
            <h3 className="font-bold mb-1">「販売管理費計（人件費以外）」の計算</h3>
            <div className="bg-gray-50 border rounded p-2 space-y-1 tabular-nums text-xs">
              <div>
                人件費合計 = <span className="font-semibold">{formatYen(d.personnelCost)}</span>
              </div>
              <div>
                販売管理費計 − 人件費 = {formatYen(d.sellingAdminTotal)} − {formatYen(d.personnelCost)} ={" "}
                <span className="font-semibold">{formatYen(d.sellingAdminTotal - d.personnelCost)}</span>
              </div>
              <div>
                営業外調整（費用 − 収益）={" "}
                <span className="font-semibold">{formatYen(d.nonOpAdjustment)}</span>
              </div>
              <div>
                特別損益調整（損失 − 利益）={" "}
                <span className="font-semibold">{formatYen(d.extraordinaryAdjustment)}</span>
              </div>
              <div className="border-t pt-1 font-bold">
                ⇒ sellingAdminOther = <span className="text-blue-700">{formatYen(d.sellingAdminOther)}</span>
              </div>
              <div className="text-[11px] text-gray-700 mt-2">
                想定される税引前 = <span className="font-semibold">{formatYen(d.expectedPreTax)}</span>
                {pdfPreTax !== undefined && (
                  <>
                    {" / "}PDF上の税引前 = <span className="font-semibold">{formatYen(pdfPreTax)}</span>{" "}
                    {preTaxMatch ? (
                      <span className="text-green-700">✓ 一致</span>
                    ) : (
                      <span className="text-amber-700">差: {formatYen(d.expectedPreTax - pdfPreTax)}</span>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {extracted.warnings.length > 0 && (
            <div className="text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 text-xs">
              <div className="font-bold mb-1">警告</div>
              <ul className="list-disc pl-5">
                {extracted.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onCancel}>
              キャンセル
            </Button>
            <Button onClick={apply}>適用</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
