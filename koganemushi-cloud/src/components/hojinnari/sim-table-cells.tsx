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

// ---- オプション列セル（配偶者） ----
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
  totalValue?: number;
  bold?: boolean;
  cols: ColConfig;
  /** 合計セルを空欄にする（年齢行などで合算が無意味な場合） */
  hideTotal?: boolean;
  ownerOnChange?: (v: number) => void;
  spouseOnChange?: (v: number) => void;
}

function computeTotal(props: DataRowProps): number {
  if (props.totalValue !== undefined) { return props.totalValue; }
  return props.ownerValue + (props.spouseValue ?? 0);
}

export function DataRow(props: DataRowProps) {
  const {
    label, ownerValue, spouseValue,
    bold, cols, hideTotal, ownerOnChange, spouseOnChange,
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
      {hideTotal ? (
        <td className={TOTAL_CELL}></td>
      ) : (
        <TotalCell value={total} bold={bold} />
      )}
    </tr>
  );
}
