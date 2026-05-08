"use client";

import { PLInputTable } from "./pl-input-table";
import { BlockPuzzleDiagram } from "./block-puzzle-diagram";
import { AdvicePanel } from "./advice-panel";
import { IdealPLPanel } from "./ideal-pl-panel";
import { unitLabel } from "./format-helpers";
import type {
  BlockPuzzleResult,
  BlockPuzzleUnit,
  PLPeriodInput,
} from "@/types/block-puzzle";
import type { BSPeriodInput } from "@/types/balance-sheet";

interface Props {
  periods: PLPeriodInput[];
  unit: BlockPuzzleUnit;
  showCashSection: boolean;
  results: BlockPuzzleResult[];
  idealResult: BlockPuzzleResult | null;
  onChange: (
    index: number,
    field: keyof PLPeriodInput,
    value: number | string,
  ) => void;
  onApplyPdfPL: (index: number, next: PLPeriodInput) => void;
  onApplyPdfBS: (index: number, next: BSPeriodInput) => void;
}

export function PLTab({
  periods,
  unit,
  showCashSection,
  results,
  idealResult,
  onChange,
  onApplyPdfPL,
  onApplyPdfBS,
}: Props) {
  return (
    <div className="space-y-6">
      <section className="bp-print-hide">
        <h2 className="text-base font-bold mb-2">
          <span className="inline-block w-3 h-3 bg-black rounded-full mr-1" />
          P/L入力（円単位で入力）
        </h2>
        <PLInputTable
          periods={periods}
          onChange={onChange}
          onApplyPdfPL={onApplyPdfPL}
          onApplyPdfBS={onApplyPdfBS}
        />
        <p className="text-xs text-gray-500 mt-1">
          ※ 入力値はブラウザに自動保存されます。各列ヘッダーの「PDF読込」で<strong>1回のPDFアップロードでP/LとB/Sの両方</strong>を取り込めます。
          「販売管理費計（人件費以外）」は販管費 − 人件費 + 営業外費用 − 営業外収益 + 特別損失 − 特別利益（PDF読込時に自動計算）。
        </p>
      </section>

      <section>
        <h2 className="text-base font-bold mb-2">
          <span className="inline-block w-3 h-3 bg-black rounded-full mr-1" />
          ブロックパズル（{unitLabel(unit)}単位）
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {idealResult && (
            <div className="bp-diagram" data-pptx-export-id="pl-ideal">
              <BlockPuzzleDiagram
                result={idealResult}
                unit={unit}
                showCashSection={showCashSection}
                variant="ideal"
              />
            </div>
          )}
          {results.map((r, i) => (
            <div key={i} className="bp-diagram" data-pptx-export-id={`pl-${i}`}>
              <BlockPuzzleDiagram
                result={r}
                unit={unit}
                showCashSection={showCashSection}
              />
            </div>
          ))}
        </div>
      </section>

      <section>
        <IdealPLPanel results={results} />
      </section>

      <section>
        <AdvicePanel results={results} />
      </section>
    </div>
  );
}
