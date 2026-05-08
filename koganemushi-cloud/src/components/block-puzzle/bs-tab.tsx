"use client";

import { BSInputTable } from "@/components/balance-sheet/bs-input-table";
import { BalanceSheetDiagram } from "@/components/balance-sheet/balance-sheet-diagram";
import { BSAdvicePanel } from "@/components/balance-sheet/bs-advice-panel";
import { unitLabel } from "./format-helpers";
import type {
  BalanceSheetResult,
  BalanceSheetUnit,
  BSPeriodInput,
} from "@/types/balance-sheet";

interface Props {
  periods: BSPeriodInput[];
  unit: BalanceSheetUnit;
  results: BalanceSheetResult[];
  onChange: (
    index: number,
    field: keyof BSPeriodInput,
    value: number | string,
  ) => void;
}

export function BSTab({ periods, unit, results, onChange }: Props) {
  return (
    <div className="space-y-6">
      <section className="bp-print-hide">
        <h2 className="text-base font-bold mb-2">
          <span className="inline-block w-3 h-3 bg-black rounded-full mr-1" />
          B/S入力（円単位で入力）
        </h2>
        <BSInputTable periods={periods} onChange={onChange} />
        <p className="text-xs text-gray-500 mt-1">
          ※ PDF読込はP/Lタブの列ヘッダーで実行できます（1回のアップロードでP/L+B/S両方が更新されます）。
          「流動資産（現預金除く）」は流動資産合計 − 現預金 で算出されます。
        </p>
      </section>

      <section>
        <h2 className="text-base font-bold mb-2">
          <span className="inline-block w-3 h-3 bg-black rounded-full mr-1" />
          貸借対照表ブロックパズル（{unitLabel(unit)}単位）
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {results.map((r, i) => (
            <div key={i} className="bp-diagram" data-pptx-export-id={`bs-${i}`}>
              <BalanceSheetDiagram result={r} unit={unit} />
            </div>
          ))}
        </div>
      </section>

      <section>
        <BSAdvicePanel results={results} />
      </section>
    </div>
  );
}
