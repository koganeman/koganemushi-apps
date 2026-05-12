"use client";

import { useState, useEffect, useRef } from "react";
import { formatYen, parseYen } from "@/lib/format";

interface Props {
  value: number;
  onChange: (next: number) => void;
  readOnly?: boolean;
  /** 背景色クラス（実績/予測など） */
  bg?: string;
  /** 数値が負のとき赤字にする */
  showNegative?: boolean;
  /** 太字 */
  bold?: boolean;
  /** 右寄せ（デフォルト true） */
  rightAlign?: boolean;
  ariaLabel?: string;
}

export function EditableYenCell({
  value,
  onChange,
  readOnly,
  bg = "",
  showNegative = true,
  bold = false,
  rightAlign = true,
  ariaLabel,
}: Props) {
  const [text, setText] = useState<string>(formatYen(value));
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!focused) {
      setText(formatYen(value));
    }
  }, [value, focused]);

  const isNeg = value < 0;
  const colorClass = showNegative && isNeg ? "text-red-600" : "";
  const align = rightAlign ? "text-right" : "text-left";
  const weight = bold ? "font-semibold" : "";

  if (readOnly) {
    return (
      <div
        className={`px-2 py-1 ${align} ${colorClass} ${weight} ${bg} truncate`}
        title={ariaLabel}
      >
        {formatYen(value)}
      </div>
    );
  }

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      aria-label={ariaLabel}
      value={text}
      onFocus={(e) => {
        setFocused(true);
        // 入力フィールドを編集しやすいよう、空のときは空文字に
        setText(value === 0 ? "" : String(value));
        e.target.select();
      }}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        setFocused(false);
        const next = parseYen(text);
        if (next !== value) { onChange(next); }
        setText(formatYen(next));
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          (e.target as HTMLInputElement).blur();
        }
      }}
      className={`w-full px-2 py-1 outline-none focus:bg-white focus:ring-1 focus:ring-blue-400 ${align} ${colorClass} ${weight} ${bg}`}
    />
  );
}
