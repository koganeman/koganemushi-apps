"use client";

import type { BlockPuzzleResult, BlockPuzzleUnit } from "@/types/block-puzzle";
import { formatAmount, formatRate } from "./format-helpers";

interface BlockPuzzleDiagramProps {
  result: BlockPuzzleResult;
  unit: BlockPuzzleUnit;
  /** キャッシュ系（法人税等・税引後利益・借入金返済・増加キャッシュ・減価償却費）を表示 */
  showCashSection?: boolean;
  /** "ideal" のときは理想P/L用の紫系スタイルで強調 */
  variant?: "actual" | "ideal";
}

const MAIN_HEIGHT_PX = 320;

/**
 * 1期分のお金のブロックパズル図解（西順一郎先生 STRAC図 / 和仁達也先生 改良版）。
 *
 * 黒字時:
 *   ┌─────────┬──────────────────────────────┐
 *   │         │  変動費                        │
 *   │  売上高  ├──────┬────────────┬──────────┤
 *   │         │      │   固定費    │  人件費  │
 *   │         │ 粗利 │            │          │
 *   │         │      │            │  その他  │
 *   │         │      ├────────────┴──────────┤
 *   │         │      │   税引前当期利益       │
 *   └─────────┴──────┴───────────────────────┘
 *
 * 赤字時（固定費 > 粗利益、3列構造）:
 *   ┌─────────┬──────┬────────────┬──────────┐
 *   │         │      変動費                    │
 *   │  売上高  ├──────┼────────────┼──────────┤
 *   │         │      │            │  人件費  │
 *   │         │ 粗利益│            │          │
 *   │         │      │   固定費    ├──────────┤
 *   │         │      │            │  その他  │
 *   │         ├──────┤            │          │
 *   │         │ 損失 │            │          │
 *   └─────────┴──────┴────────────┴──────────┘
 */
export function BlockPuzzleDiagram({
  result,
  unit,
  showCashSection = true,
  variant = "actual",
}: BlockPuzzleDiagramProps) {
  const r = result;
  const isLoss = r.preTaxProfit < 0;
  const isIdeal = variant === "ideal";

  return (
    <div
      className={
        isIdeal
          ? "border-2 border-purple-400 bg-purple-50/30"
          : "border border-gray-300 bg-white"
      }
    >
      <div
        className={
          isIdeal
            ? "bg-purple-600 text-white text-center py-1 font-semibold text-sm"
            : "bg-blue-700 text-white text-center py-1 font-semibold text-sm"
        }
      >
        {isIdeal && <span className="mr-1">✨ AI理想</span>}
        {r.periodLabel}
      </div>
      {isLoss ? (
        <LossLayout result={r} unit={unit} showCashSection={showCashSection} />
      ) : (
        <ProfitLayout result={r} unit={unit} showCashSection={showCashSection} />
      )}
    </div>
  );
}

interface LayoutProps {
  result: BlockPuzzleResult;
  unit: BlockPuzzleUnit;
  showCashSection: boolean;
}

/**
 * 黒字レイアウト：売上高=変動費+粗利益で完結。
 * 粗利益エリアの中で「固定費（人件費・その他）+ 税引前利益」を縦分割。
 */
function ProfitLayout({ result: r, unit, showCashSection }: LayoutProps) {
  const sales = Math.max(r.sales, 1);
  const variablePct = (r.variableCost / sales) * 100;
  const grossPct = 100 - variablePct;

  const gross = Math.max(r.grossProfit, 1);
  const fixedHeightInGross = Math.min(Math.max(r.fixedCost / gross, 0), 1) * 100;
  const profitHeightInGross = Math.max(100 - fixedHeightInGross, 0);

  const personnelTotal = r.personnelCost + r.otherFixedCost;
  const personnelInRightHeight =
    personnelTotal <= 0
      ? 100
      : Math.min(Math.max(r.personnelCost / personnelTotal, 0), 1) * 100;

  const fmt = (v: number) => formatAmount(v, unit);

  return (
    <div className="flex" style={{ height: `${MAIN_HEIGHT_PX}px` }}>
      <SalesColumn sales={r.sales} unit={unit} />

      <div className="flex-[2.5] flex flex-col">
        <VariableCostBlock
          value={r.variableCost}
          unit={unit}
          heightPct={variablePct}
        />
        <div className="flex" style={{ height: `${grossPct}%`, minHeight: "60px" }}>
          <GrossProfitLabel result={r} unit={unit} showRate />
          <div className="flex-[2.2] flex flex-col">
            <div
              className="flex border-b border-gray-400"
              style={{ height: `${fixedHeightInGross}%`, minHeight: "40px" }}
            >
              <FixedCostLabel value={r.fixedCost} unit={unit} />
              <PersonnelStack
                result={r}
                unit={unit}
                personnelHeightPct={personnelInRightHeight}
              />
            </div>
            <div
              className="bg-blue-100 flex flex-col items-center justify-center px-2"
              style={{ height: `${profitHeightInGross}%`, minHeight: "30px" }}
            >
              <div className="text-xs text-gray-700">税引前当期利益</div>
              <div className="text-base font-semibold">{fmt(r.preTaxProfit)}</div>
            </div>
          </div>
        </div>
      </div>

      <CashSection result={r} unit={unit} show={showCashSection} />
    </div>
  );
}

/**
 * 赤字レイアウト：3列構造で各列の合計高さ＝固定費に揃える。
 * - 粗利益コラム ＝ 粗利益(上) + 税引前当期損失(下)
 * - 固定費コラム ＝ 固定費（一枚絵）
 * - 人件費コラム ＝ 人件費(上) + その他(下)
 */
function LossLayout({ result: r, unit, showCashSection }: LayoutProps) {
  const sales = Math.max(r.sales, 1);
  const fixedCost = Math.max(r.fixedCost, 1);
  const lossAmount = Math.abs(r.preTaxProfit);

  // 全体高さ = MAIN_HEIGHT * (変動費 + 固定費) / 売上 = MAIN_HEIGHT * (1 + 損失/売上)
  const totalHeightPx = MAIN_HEIGHT_PX * (1 + lossAmount / sales);
  // 上部：変動費の絶対高さ
  const variableHeightPx = MAIN_HEIGHT_PX * (r.variableCost / sales);
  // 下部サブエリア：固定費の絶対高さ（= 粗利益 + 損失）
  // 粗利コラム内の比率
  const grossPctInSub = (r.grossProfit / fixedCost) * 100;
  const lossPctInSub = (lossAmount / fixedCost) * 100;
  // 人件費コラム内の比率
  const personnelTotal = r.personnelCost + r.otherFixedCost;
  const personnelPctInSub =
    personnelTotal <= 0
      ? 100
      : Math.min(Math.max(r.personnelCost / personnelTotal, 0), 1) * 100;

  const fmt = (v: number) => formatAmount(v, unit);

  return (
    <div className="flex" style={{ height: `${totalHeightPx}px` }}>
      <SalesColumn sales={r.sales} unit={unit} />

      <div className="flex-[2.5] flex flex-col">
        {/* 変動費（最上段） */}
        <div
          className="bg-yellow-100 border-b border-gray-400 flex flex-col items-center justify-center"
          style={{ height: `${variableHeightPx}px`, minHeight: "30px" }}
        >
          <div className="text-xs text-gray-700">変動費</div>
          <div className="text-base font-semibold">{fmt(r.variableCost)}</div>
        </div>

        {/* サブエリア（高さ＝固定費）：3列構造 */}
        <div className="flex flex-1">
          {/* 粗利益＋損失コラム */}
          <div className="flex-[1] flex flex-col border-r border-gray-400">
            <div
              className="bg-yellow-100 border-b border-gray-400 flex flex-col items-center justify-center px-1"
              style={{ height: `${grossPctInSub}%` }}
            >
              <div className="text-xs text-gray-700">粗利益</div>
              <div className="text-base font-semibold">{fmt(r.grossProfit)}</div>
              <div className="text-[10px] text-gray-600 mt-1">
                粗利益率 {formatRate(r.grossProfitRate)}
              </div>
            </div>
            <div
              className="bg-blue-100 flex flex-col items-center justify-center px-1"
              style={{ height: `${lossPctInSub}%` }}
            >
              <div className="text-[11px] text-gray-700">税引前当期損失</div>
              <div className="text-sm font-semibold text-red-600">{fmt(r.preTaxProfit)}</div>
            </div>
          </div>

          {/* 固定費コラム（一枚絵） */}
          <div className="flex-[1.2] bg-orange-100 border-r border-gray-400 flex flex-col items-center justify-center px-1">
            <div className="text-xs text-gray-700">固定費</div>
            <div className="text-base font-semibold">{fmt(r.fixedCost)}</div>
          </div>

          {/* 人件費＋その他コラム */}
          <div className="flex-[1.2] flex flex-col">
            <div
              className="bg-orange-100 border-b border-gray-400 flex flex-col items-center justify-center px-1"
              style={{ height: `${personnelPctInSub}%`, minHeight: "30px" }}
            >
              <div className="text-xs text-gray-700">人件費</div>
              <div className="text-sm font-semibold">{fmt(r.personnelCost)}</div>
              <div className="text-[10px] text-gray-600">
                労働分配率 {formatRate(r.laborDistributionRate)}
              </div>
            </div>
            <div className="flex-1 bg-orange-100 flex flex-col items-center justify-center px-1">
              <div className="text-xs text-gray-700">その他</div>
              <div className="text-sm font-semibold">{fmt(r.otherFixedCost)}</div>
            </div>
          </div>
        </div>
      </div>

      <CashSection result={r} unit={unit} show={showCashSection} />
    </div>
  );
}

function SalesColumn({ sales, unit }: { sales: number; unit: BlockPuzzleUnit }) {
  return (
    <div className="flex-[1.2] flex flex-col items-center justify-center bg-yellow-100 border-r border-gray-400 px-2">
      <div className="text-xs text-gray-700">売上高</div>
      <div className="text-base font-semibold mt-2 text-center">
        {formatAmount(sales, unit)}
      </div>
    </div>
  );
}

function VariableCostBlock({
  value,
  unit,
  heightPct,
}: {
  value: number;
  unit: BlockPuzzleUnit;
  heightPct: number;
}) {
  return (
    <div
      className="bg-yellow-100 border-b border-gray-400 flex flex-col items-center justify-center"
      style={{ height: `${heightPct}%`, minHeight: "30px" }}
    >
      <div className="text-xs text-gray-700">変動費</div>
      <div className="text-base font-semibold">{formatAmount(value, unit)}</div>
    </div>
  );
}

function GrossProfitLabel({
  result: r,
  unit,
  showRate,
}: {
  result: BlockPuzzleResult;
  unit: BlockPuzzleUnit;
  showRate: boolean;
}) {
  return (
    <div className="flex-[1] bg-yellow-100 border-r border-gray-400 flex flex-col items-center justify-between py-2 px-1">
      <div className="text-xs text-gray-700">粗利益</div>
      <div className="text-base font-semibold">{formatAmount(r.grossProfit, unit)}</div>
      {showRate && (
        <div className="text-xs text-gray-600">
          粗利益率 <span className="font-medium">{formatRate(r.grossProfitRate)}</span>
        </div>
      )}
    </div>
  );
}

function FixedCostLabel({ value, unit }: { value: number; unit: BlockPuzzleUnit }) {
  return (
    <div className="flex-[1] bg-yellow-100 border-r border-gray-400 flex flex-col items-center justify-center px-1">
      <div className="text-xs text-gray-700">固定費</div>
      <div className="text-base font-semibold">{formatAmount(value, unit)}</div>
    </div>
  );
}

function PersonnelStack({
  result: r,
  unit,
  personnelHeightPct,
}: {
  result: BlockPuzzleResult;
  unit: BlockPuzzleUnit;
  personnelHeightPct: number;
}) {
  return (
    <div className="flex-[1.5] flex flex-col">
      <div
        className="bg-yellow-100 border-b border-gray-400 flex flex-col items-center justify-center px-1"
        style={{ height: `${personnelHeightPct}%`, minHeight: "30px" }}
      >
        <div className="text-xs text-gray-700">人件費</div>
        <div className="text-sm font-semibold">{formatAmount(r.personnelCost, unit)}</div>
        <div className="text-[10px] text-gray-600">
          労働分配率 {formatRate(r.laborDistributionRate)}
        </div>
      </div>
      <div className="flex-1 bg-yellow-100 flex flex-col items-center justify-center px-1">
        <div className="text-xs text-gray-700">その他</div>
        <div className="text-sm font-semibold">{formatAmount(r.otherFixedCost, unit)}</div>
      </div>
    </div>
  );
}

function CashSection({
  result,
  unit,
  show,
}: {
  result: BlockPuzzleResult;
  unit: BlockPuzzleUnit;
  show: boolean;
}) {
  if (!show) { return null; }
  const r = result;
  return (
    <div className="flex-[1] flex flex-col border-l border-gray-400">
      <CashCell label="法人税等" value={r.corporateTaxEtc} unit={unit} />
      <CashCell
        label="税引後利益"
        value={r.afterTaxProfit}
        unit={unit}
        highlight={r.afterTaxProfit < 0 ? "loss" : "profit"}
      />
      <CashCell label="借入金返済" value={r.loanRepayment} unit={unit} bg="bg-pink-100" />
      <CashCell label="減価償却費" value={r.depreciation} unit={unit} />
      <CashCell
        label="増加キャッシュ"
        value={r.cashIncrease}
        unit={unit}
        highlight={r.cashIncrease < 0 ? "loss" : "profit"}
      />
    </div>
  );
}

function resolveCashBg(bg: string | undefined, highlight: "loss" | "profit" | undefined): string {
  if (bg) { return bg; }
  if (highlight === "loss") { return "bg-red-50"; }
  return "bg-blue-50";
}

function CashCell({
  label,
  value,
  unit,
  bg,
  highlight,
}: {
  label: string;
  value: number;
  unit: BlockPuzzleUnit;
  bg?: string;
  highlight?: "loss" | "profit";
}) {
  const valueColor = highlight === "loss" ? "text-red-600" : "";
  const cellBg = resolveCashBg(bg, highlight);
  return (
    <div className={`flex-1 flex flex-col items-center justify-center px-1 ${cellBg} border-b border-gray-300 last:border-b-0`}>
      <div className="text-[10px] text-gray-700 leading-tight">{label}</div>
      <div className={`text-xs font-semibold ${valueColor}`}>{formatAmount(value, unit)}</div>
    </div>
  );
}
