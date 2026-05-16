"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatYen } from "@/lib/format";
import {
  mapExtractedToInput,
  type ExtractedRawValues,
} from "@/lib/pdf-pl-extract";
import {
  mapExtractedBSToInput,
  type ExtractedBSRawValues,
} from "@/lib/pdf-bs-extract";
import type { PLPeriodInput } from "@/types/block-puzzle";
import type { BSPeriodInput } from "@/types/balance-sheet";
import type { ExtractedCombined } from "./pdf-import-button";

interface Props {
  open: boolean;
  extracted: ExtractedCombined;
  /** "overwrite": 列に上書き（既定） / "shift": 過去期を1つ右にずらして最新期に挿入 */
  mode?: "overwrite" | "shift";
  /** OCR経由で取り込んだ場合 true（警告バナーを表示） */
  viaOcr?: boolean;
  onCancel: () => void;
  onApply: (args: { plInput: PLPeriodInput; bsInput: BSPeriodInput }) => void;
}

const PL_RAW_ROWS: { label: string; key: keyof ExtractedRawValues }[] = [
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

const BS_RAW_ROWS: { label: string; key: keyof ExtractedBSRawValues }[] = [
  { label: "現預金", key: "cash" },
  { label: "流動資産合計", key: "currentAssetsTotal" },
  { label: "固定資産合計", key: "fixedAssetsTotal" },
  { label: "資産合計", key: "totalAssets" },
  { label: "流動負債合計", key: "currentLiabilitiesTotal" },
  { label: "固定負債合計", key: "longTermLiabilitiesTotal" },
  { label: "純資産合計", key: "netAssetsTotal" },
];

export function PdfImportDialog({ open, extracted, mode = "overwrite", viaOcr = false, onCancel, onApply }: Props) {
  const isShiftMode = mode === "shift";
  const plMapped = useMemo(() => mapExtractedToInput(extracted.pl), [extracted.pl]);
  const bsMapped = useMemo(() => mapExtractedBSToInput(extracted.bs), [extracted.bs]);
  const [periodLabel, setPeriodLabel] = useState(
    plMapped.input.periodLabel || bsMapped.input.periodLabel,
  );

  const apply = () => {
    onApply({
      plInput: { ...plMapped.input, periodLabel },
      bsInput: { ...bsMapped.input, periodLabel },
    });
  };

  const bsImbalance = bsMapped.derivation.imbalance;
  const isBSImbalanced = Math.abs(bsImbalance) >= 1;
  const allWarnings = [...extracted.pl.warnings, ...extracted.bs.warnings];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onCancel(); } }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{titleFor(mode)}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <p className="text-xs text-gray-600">{descriptionFor(mode)}</p>

          <ImportBanners viaOcr={viaOcr} isShiftMode={isShiftMode} />

          <label className="flex items-center gap-2">
            <span className="text-gray-700 w-20">期末日</span>
            <input
              type="text"
              value={periodLabel}
              onChange={(e) => setPeriodLabel(e.target.value)}
              className="border rounded px-2 py-1 flex-1"
              placeholder="例: 2025/3/31"
            />
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* P/L 抽出結果 */}
            <div>
              <h3 className="font-bold mb-1 text-blue-700">P/L 抽出値</h3>
              <table className="w-full border-collapse text-xs">
                <tbody>
                  {PL_RAW_ROWS.map((row) => {
                    const val = extracted.pl.raw[row.key];
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

            {/* B/S 抽出結果 */}
            <div>
              <h3 className="font-bold mb-1 text-emerald-700">B/S 抽出値</h3>
              <table className="w-full border-collapse text-xs">
                <tbody>
                  {BS_RAW_ROWS.map((row) => {
                    const val = extracted.bs.raw[row.key];
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
              <div
                className={`mt-2 text-xs px-2 py-1 rounded border ${isBSImbalanced ? "text-red-700 bg-red-50 border-red-200" : "text-green-700 bg-green-50 border-green-200"}`}
              >
                {isBSImbalanced
                  ? `⚠ 貸借差額: ${formatYen(bsImbalance)}（資産合計と資本合計が一致しません）`
                  : "✓ 貸借一致"}
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-bold mb-1">P/LのsellingAdminOther計算</h3>
            <PLDerivationDetail
              d={plMapped.derivation}
              pdfPreTax={extracted.pl.raw.preTaxIncome}
            />
          </div>

          {allWarnings.length > 0 && (
            <div className="text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 text-xs">
              <div className="font-bold mb-1">警告</div>
              <ul className="list-disc pl-5">
                {allWarnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onCancel}>
              キャンセル
            </Button>
            <Button onClick={apply}>{applyButtonLabelFor(mode)}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface DerivationProps {
  d: ReturnType<typeof mapExtractedToInput>["derivation"];
  pdfPreTax: number | undefined;
}

function titleFor(mode: "overwrite" | "shift"): string {
  return mode === "shift"
    ? "新年度PDFの取込確認（P/L + 貸借対照表）"
    : "PDF読込結果の確認（P/L + 貸借対照表）";
}

function descriptionFor(mode: "overwrite" | "shift"): string {
  if (mode === "shift") {
    return "1つのPDFから損益計算書（P/L）と貸借対照表（B/S）の両方を抽出しました。「適用」を押すと、過去期を1つずつ右にずらして、この期を最新期（第1期）に挿入します。最古の期（第5期）のデータは破棄されます。";
  }
  return "1つのPDFから損益計算書（P/L）と貸借対照表（B/S）の両方を抽出しました。「適用」を押すと該当列のP/L・B/S両方の入力値が更新されます。";
}

function applyButtonLabelFor(mode: "overwrite" | "shift"): string {
  return mode === "shift"
    ? "最新期として挿入（過去期を1つ右にシフト）"
    : "適用（P/L + B/Sを更新）";
}

function ShiftModeBanner() {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs text-amber-800">
      ⚠ シフト挿入モード: 適用すると <strong>最古期(第5期)のデータが失われます</strong>。
      事前に「エクスポート」でJSON保存することを推奨します。
    </div>
  );
}

function OcrWarningBanner() {
  return (
    <div className="bg-yellow-50 border border-yellow-300 rounded p-2 text-xs text-yellow-900">
      ⚠ <strong>OCR取込結果</strong>：文字認識で読み取った値のため、誤認識の可能性があります。
      適用前に必ず数値を PDF と突き合わせて確認してください。
      （特に金額の桁・△マイナス記号・「0」と「O」の区別など）
    </div>
  );
}

function ImportBanners({ viaOcr, isShiftMode }: { viaOcr: boolean; isShiftMode: boolean }) {
  return (
    <>
      {viaOcr && <OcrWarningBanner />}
      {isShiftMode && <ShiftModeBanner />}
    </>
  );
}

function PLDerivationDetail({ d, pdfPreTax }: DerivationProps) {
  const preTaxMatch = pdfPreTax !== undefined && d.expectedPreTax === pdfPreTax;
  return (
    <div className="bg-gray-50 border rounded p-2 space-y-1 tabular-nums text-xs">
      <div>人件費合計 = <span className="font-semibold">{formatYen(d.personnelCost)}</span></div>
      <div>
        販売管理費計 − 人件費 = {formatYen(d.sellingAdminTotal)} − {formatYen(d.personnelCost)} ={" "}
        <span className="font-semibold">{formatYen(d.sellingAdminTotal - d.personnelCost)}</span>
      </div>
      <div>営業外調整（費用 − 収益）= <span className="font-semibold">{formatYen(d.nonOpAdjustment)}</span></div>
      <div>特別損益調整（損失 − 利益）= <span className="font-semibold">{formatYen(d.extraordinaryAdjustment)}</span></div>
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
  );
}
