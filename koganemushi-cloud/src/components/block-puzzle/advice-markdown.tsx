"use client";

import * as React from "react";

/**
 * Claudeが返すフォーマット（## 見出し + - リスト + 段落 + **太字**）に対応した簡易マークダウンレンダラ。
 * 完全なマークダウンエンジンではない。
 */
export function AdviceMarkdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let listBuf: string[] = [];
  let paraBuf: string[] = [];

  const flushList = () => {
    if (listBuf.length === 0) { return; }
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="list-disc pl-5 space-y-1 text-sm">
        {listBuf.map((item, i) => (
          <li key={i}>{renderInline(item)}</li>
        ))}
      </ul>
    );
    listBuf = [];
  };
  const flushPara = () => {
    if (paraBuf.length === 0) { return; }
    const text = paraBuf.join(" ").trim();
    if (text) {
      blocks.push(
        <p key={`p-${blocks.length}`} className="text-sm leading-relaxed">
          {renderInline(text)}
        </p>
      );
    }
    paraBuf = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.startsWith("## ")) {
      flushList();
      flushPara();
      blocks.push(
        <h3 key={`h-${blocks.length}`} className="text-sm font-bold border-l-4 border-purple-400 pl-2 mt-3">
          {line.slice(3).trim()}
        </h3>
      );
    } else if (/^\s*[-*・]\s+/.test(line)) {
      flushPara();
      listBuf.push(line.replace(/^\s*[-*・]\s+/, ""));
    } else if (line.trim() === "") {
      flushList();
      flushPara();
    } else {
      flushList();
      paraBuf.push(line);
    }
  }
  flushList();
  flushPara();

  return <div className="space-y-2">{blocks}</div>;
}

/**
 * **太字** だけインライン解釈する簡易レンダラ。
 */
function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIndex) {
      parts.push(text.slice(lastIndex, m.index));
    }
    parts.push(
      <strong key={m.index} className="font-semibold">
        {m[1]}
      </strong>
    );
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}
