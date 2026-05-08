"use client";

import type {
  BalanceSheetResult,
  BalanceSheetUnit,
} from "@/types/balance-sheet";
import { formatAmount, formatRate } from "@/components/block-puzzle/format-helpers";

interface Props {
  result: BalanceSheetResult;
  unit: BalanceSheetUnit;
}

const MAIN_HEIGHT_PX = 320;
const IMBALANCE_THRESHOLD = 1; // 1円以上ズレていたら警告

/**
 * 1期分の貸借対照表ブロックパズル図。
 *
 * 構造:
 *   ┌──────────────────────────┐
 *   │       期末日             │
 *   ├──────────┬───────────────┤
 *   │ 現預金    │ 流動負債      │
 *   ├──────────┼───────────────┤
 *   │ 流動資産  │ 固定負債      │
 *   ├──────────┤               │
 *   │ 固定資産  ├───────────────┤
 *   │           │ 純資産        │
 *   ├──────────┴───────────────┤
 *   │ 総資産       総資本      │
 *   └──────────────────────────┘
 */
export function BalanceSheetDiagram({ result, unit }: Props) {
  const r = result;
  const isImbalanced = Math.abs(r.imbalance) >= IMBALANCE_THRESHOLD;
  const hasData = r.totalAssets > 0 || r.totalCapital > 0;

  return (
    <div className="border border-gray-300 bg-white">
      <div className="bg-blue-700 text-white text-center py-1 font-semibold text-sm">
        {r.periodLabel || "（未入力）"}
      </div>
      {hasData ? (
        <BSBody result={r} unit={unit} />
      ) : (
        <EmptyBody />
      )}
      <Footer result={r} unit={unit} isImbalanced={isImbalanced} />
    </div>
  );
}

function EmptyBody() {
  return (
    <div
      className="flex items-center justify-center text-xs text-gray-400 bg-gray-50"
      style={{ height: `${MAIN_HEIGHT_PX}px` }}
    >
      データを入力してください
    </div>
  );
}

interface BodyProps {
  result: BalanceSheetResult;
  unit: BalanceSheetUnit;
}

function BSBody({ result: r, unit }: BodyProps) {
  // 各列を独立に正規化（合計100%）
  const assetsTotal = Math.max(r.totalAssets, 1);
  const capitalTotal = Math.max(r.totalCapital, 1);

  const cashPct = (r.cash / assetsTotal) * 100;
  const currentAssetsPct = (r.currentAssetsExCash / assetsTotal) * 100;
  const fixedAssetsPct = (r.fixedAssets / assetsTotal) * 100;

  const currentLiabPct = (r.currentLiabilities / capitalTotal) * 100;
  const longTermLiabPct = (r.longTermLiabilities / capitalTotal) * 100;
  const netAssetsPct = (r.netAssets / capitalTotal) * 100;

  return (
    <div className="flex" style={{ height: `${MAIN_HEIGHT_PX}px` }}>
      {/* 左列：資産 */}
      <div className="flex-1 flex flex-col border-r border-gray-400">
        <Block
          label="現預金"
          value={r.cash}
          unit={unit}
          heightPct={cashPct}
          bg="bg-yellow-200"
        />
        <Block
          label="流動資産"
          value={r.currentAssetsExCash}
          unit={unit}
          heightPct={currentAssetsPct}
          bg="bg-emerald-100"
        />
        <Block
          label="固定資産"
          value={r.fixedAssets}
          unit={unit}
          heightPct={fixedAssetsPct}
          bg="bg-sky-100"
          isLast
        />
      </div>
      {/* 右列：負債・純資産 */}
      <div className="flex-1 flex flex-col">
        <Block
          label="流動負債"
          value={r.currentLiabilities}
          unit={unit}
          heightPct={currentLiabPct}
          bg="bg-purple-200"
        />
        <Block
          label="固定負債"
          value={r.longTermLiabilities}
          unit={unit}
          heightPct={longTermLiabPct}
          bg="bg-pink-200"
        />
        <Block
          label="純資産"
          value={r.netAssets}
          unit={unit}
          heightPct={netAssetsPct}
          bg="bg-orange-100"
          isLast
        />
      </div>
    </div>
  );
}

interface BlockProps {
  label: string;
  value: number;
  unit: BalanceSheetUnit;
  heightPct: number;
  bg: string;
  isLast?: boolean;
}

function Block({ label, value, unit, heightPct, bg, isLast }: BlockProps) {
  // ゼロまたは極小は最小高さで描画
  const safePct = Math.max(heightPct, 0);
  return (
    <div
      className={`${bg} ${isLast ? "" : "border-b border-gray-400"} flex flex-col items-center justify-center px-1 overflow-hidden`}
      style={{ height: `${safePct}%`, minHeight: safePct < 1 ? "0" : "16px" }}
    >
      {safePct >= 6 && (
        <div className="text-xs text-gray-700 leading-tight">{label}</div>
      )}
      {safePct >= 3 && (
        <div className="text-sm font-semibold leading-tight">
          {formatAmount(value, unit)}
        </div>
      )}
    </div>
  );
}

interface FooterProps {
  result: BalanceSheetResult;
  unit: BalanceSheetUnit;
  isImbalanced: boolean;
}

function Footer({ result: r, unit, isImbalanced }: FooterProps) {
  return (
    <div className="border-t border-gray-300">
      <div className="flex text-xs">
        <div className="flex-1 px-2 py-1 border-r border-gray-300">
          <div className="text-gray-600">総資産</div>
          <div className="font-semibold">{formatAmount(r.totalAssets, unit)}</div>
        </div>
        <div className="flex-1 px-2 py-1">
          <div className="text-gray-600">総資本</div>
          <div className="font-semibold">{formatAmount(r.totalCapital, unit)}</div>
        </div>
      </div>
      <div className="px-2 py-1 text-[10px] text-gray-600 border-t border-gray-200 flex flex-wrap gap-x-3 gap-y-0.5">
        <span>自己資本比率 {formatRate(r.equityRatio)}</span>
        <span>流動比率 {formatRate(r.currentRatio)}</span>
        <span>固定比率 {formatRate(r.fixedRatio)}</span>
      </div>
      {isImbalanced && (
        <div className="px-2 py-1 text-[11px] text-red-700 bg-red-50 border-t border-red-200">
          ⚠ 貸借差異 {formatAmount(r.imbalance, unit)}（資産合計と資本合計が一致していません）
        </div>
      )}
    </div>
  );
}
