"use client";

import { useState } from "react";
import { formatYen } from "@/lib/format";
import { Input } from "@/components/ui/input";

// ---- スタイル定数 ----
export const LABEL_CELL =
  "py-1 px-2 text-xs text-gray-700 whitespace-nowrap bg-gray-50 border-r";
export const CALC_CELL = "py-1 px-2 text-right text-xs font-mono border-r";
export const INPUT_CELL = "py-1 px-2 border-r bg-yellow-50";
export const TOTAL_CELL =
  "py-1 px-2 text-right text-xs font-mono font-bold bg-blue-50";
export const SECTION_HEADER =
  "py-1 px-2 text-xs font-bold text-white bg-gray-600";

// ---- 列表示設定 ----
export interface ColConfig {
  showSpouse: boolean;
  showChild1: boolean;
  showChild2: boolean;
}

// ---- 基本入力コンポーネント ----
export function YenInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [focused, setFocused] = useState(false);
  let displayValue = "";
  if (focused) {
    displayValue = value === 0 ? "" : String(value);
  } else {
    displayValue = value === 0 ? "" : formatYen(value);
  }
  return (
    <Input
      className="w-full text-right text-sm h-7 px-2"
      value={displayValue}
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

// ---- セクション行 ----
export function SectionRow({
  label,
  colCount,
}: {
  label: string;
  colCount: number;
}) {
  return (
    <tr className="border-b">
      <td colSpan={colCount} className={SECTION_HEADER}>
        {label}
      </td>
    </tr>
  );
}

// ---- 事業主セル ----
export function OwnerCell({
  value,
  onChange,
  bold,
}: {
  value: number;
  onChange?: (v: number) => void;
  bold?: boolean;
}) {
  if (onChange) {
    return (
      <td className={INPUT_CELL}>
        <YenInput value={value} onChange={onChange} />
      </td>
    );
  }
  return (
    <td className={CALC_CELL}>
      <span className={bold ? "font-bold" : ""}>{formatYen(value)}</span>
    </td>
  );
}

// ---- オプション列セル（配偶者・子供） ----
export function OptionalCell({
  value,
  onChange,
  show,
  bold,
}: {
  value: number | null;
  onChange?: (v: number) => void;
  show: boolean;
  bold?: boolean;
}) {
  if (!show) { return null; }
  if (value === null) {
    return (
      <td className={CALC_CELL}>
        <span className="text-gray-300">—</span>
      </td>
    );
  }
  if (onChange) {
    return (
      <td className={INPUT_CELL}>
        <YenInput value={value} onChange={onChange} />
      </td>
    );
  }
  return (
    <td className={CALC_CELL}>
      <span className={bold ? "font-bold" : ""}>{formatYen(value)}</span>
    </td>
  );
}

// ---- 合計セル ----
export function TotalCell({
  value,
  bold,
}: {
  value: number;
  bold?: boolean;
}) {
  return (
    <td className={TOTAL_CELL}>
      <span className={bold ? "text-blue-700 font-bold" : ""}>{formatYen(value)}</span>
    </td>
  );
}

// ---- データ行 ----
export interface DataRowProps {
  label: string;
  ownerValue: number;
  spouseValue?: number | null;
  child1Value?: number | null;
  child2Value?: number | null;
  totalValue?: number;
  bold?: boolean;
  cols: ColConfig;
  ownerOnChange?: (v: number) => void;
  spouseOnChange?: (v: number) => void;
  child1OnChange?: (v: number) => void;
  child2OnChange?: (v: number) => void;
}

function computeTotal(props: DataRowProps): number {
  if (props.totalValue !== undefined) { return props.totalValue; }
  return (
    props.ownerValue +
    (props.spouseValue ?? 0) +
    (props.child1Value ?? 0) +
    (props.child2Value ?? 0)
  );
}

export function DataRow(props: DataRowProps) {
  const {
    label, ownerValue, spouseValue, child1Value, child2Value,
    bold, cols, ownerOnChange, spouseOnChange, child1OnChange, child2OnChange,
  } = props;
  const total = computeTotal(props);

  return (
    <tr className={`border-b ${bold ? "bg-blue-50" : ""}`}>
      <td className={LABEL_CELL}>{label}</td>
      <OwnerCell value={ownerValue} onChange={ownerOnChange} bold={bold} />
      <OptionalCell
        value={spouseValue ?? null}
        onChange={spouseOnChange}
        show={cols.showSpouse}
        bold={bold}
      />
      <OptionalCell
        value={child1Value ?? null}
        onChange={child1OnChange}
        show={cols.showChild1}
        bold={bold}
      />
      <OptionalCell
        value={child2Value ?? null}
        onChange={child2OnChange}
        show={cols.showChild2}
        bold={bold}
      />
      <TotalCell value={total} bold={bold} />
    </tr>
  );
}
