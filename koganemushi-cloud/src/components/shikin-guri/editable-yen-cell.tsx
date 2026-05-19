"use client";

import { memo, useState, useEffect, useRef } from "react";
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
  /**
   * Enterで「同列・次行」セルへフォーカス移動するオプトイン。
   * 3つ全部指定したセル群（同一 group）の間で動作する。
   * 次行が見つからなければ blur のみ（既存挙動）。
   */
  enterNavGroup?: string;
  enterNavRow?: number;
  enterNavCol?: number;
}

/**
 * 1セル＝1入力。グリッドは36ヶ月×約45科目で1,500セル超になるため
 * memo化し、props（value/onChange等）が変わったセルだけ再描画する。
 * onChange は呼び出し側で安定参照にすること（不安定だとmemoが無効）。
 */
export const EditableYenCell = memo(function EditableYenCell({
  value,
  onChange,
  readOnly,
  bg = "",
  showNegative = true,
  bold = false,
  rightAlign = true,
  ariaLabel,
  enterNavGroup,
  enterNavRow,
  enterNavCol,
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

  const navEnabled =
    enterNavGroup != null && enterNavRow != null && enterNavCol != null;

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      aria-label={ariaLabel}
      value={text}
      data-enav-grp={navEnabled ? enterNavGroup : undefined}
      data-enav-row={navEnabled ? enterNavRow : undefined}
      data-enav-col={navEnabled ? enterNavCol : undefined}
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
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
          if (navEnabled) {
            const sel = `input[data-enav-grp="${enterNavGroup}"][data-enav-row="${(enterNavRow as number) + 1}"][data-enav-col="${enterNavCol}"]`;
            const nextEl = document.querySelector<HTMLInputElement>(sel);
            if (nextEl) {
              nextEl.focus();
            }
          }
        }
      }}
      className={`w-full px-2 py-1 outline-none focus:bg-white focus:ring-1 focus:ring-blue-400 ${align} ${colorClass} ${weight} ${bg}`}
    />
  );
});
