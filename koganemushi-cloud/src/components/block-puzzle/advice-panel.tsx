"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { BlockPuzzleResult } from "@/types/block-puzzle";
import { useBlockPuzzleStore, hashPeriods } from "@/stores/block-puzzle-store";
import { useShallow } from "zustand/react/shallow";
import { AdviceConsentDialog } from "./advice-consent-dialog";

interface Props {
  results: BlockPuzzleResult[];
}

interface ApiResponse {
  text: string;
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadInputTokens: number;
    cacheCreationInputTokens: number;
  };
  error?: string;
}

export function AdvicePanel({ results }: Props) {
  const { advice, setAdvice, periods } = useBlockPuzzleStore(
    useShallow((s) => ({
      advice: s.advice,
      setAdvice: s.setAdvice,
      periods: s.periods,
    }))
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);

  const currentHash = hashPeriods(periods);
  const isStale = advice !== null && advice.periodsHash !== currentHash;

  const hasAnyData = results.some((r) => r.sales > 0);

  const handleClick = () => {
    setError(null);
    setConsentOpen(true);
  };

  const handleConfirmAndGenerate = async () => {
    setConsentOpen(false);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/block-puzzle-advice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ results }),
      });
      const data = (await res.json()) as ApiResponse;
      if (!res.ok) {
        throw new Error(data.error ?? "アドバイス生成に失敗しました");
      }
      setAdvice({
        text: data.text,
        generatedAt: new Date().toISOString(),
        periodsHash: currentHash,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知のエラー");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-base font-bold">
          <span className="inline-block w-3 h-3 bg-purple-500 rounded-full mr-1" />
          AI 経営アドバイス
        </h2>
        <div className="flex items-center gap-2">
          {advice && (
            <span className="text-xs text-gray-500">
              生成: {new Date(advice.generatedAt).toLocaleString("ja-JP")}
            </span>
          )}
          <Button
            className="bp-print-hide"
            size="sm"
            variant="outline"
            onClick={handleClick}
            disabled={loading || !hasAnyData}
          >
            {buttonLabel(loading, advice !== null)}
          </Button>
        </div>
      </div>

      <p className="text-xs text-gray-500 bp-print-hide">
        ※ 「AIアドバイス生成」では集計値のみ Anthropic 社の Claude API に送信します。
        会社名・氏名・住所・利用者識別番号・取引先名などの特定可能情報は送信されません（クリック時に詳細を確認できます）。
      </p>

      <PanelBody
        hasAnyData={hasAnyData}
        loading={loading}
        error={error}
        isStale={isStale}
        adviceText={advice?.text ?? null}
      />

      <AdviceConsentDialog
        open={consentOpen}
        onCancel={() => setConsentOpen(false)}
        onConfirm={handleConfirmAndGenerate}
      />
    </div>
  );
}

interface PanelBodyProps {
  hasAnyData: boolean;
  loading: boolean;
  error: string | null;
  isStale: boolean;
  adviceText: string | null;
}

function PanelBody({ hasAnyData, loading, error, isStale, adviceText }: PanelBodyProps) {
  if (!hasAnyData) {
    return (
      <div className="text-sm text-gray-500">
        P/Lデータを入力するとAIによるトレンド分析と改善アクション提案を生成できます。
      </div>
    );
  }
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-600 py-4">
        <Spinner />
        Claudeが5期分の数値を分析中です。10〜30秒ほどお待ちください…
      </div>
    );
  }
  return (
    <>
      {error && <ErrorBox message={error} />}
      {isStale && adviceText && <StaleNotice />}
      {adviceText && <AdviceMarkdown text={adviceText} />}
    </>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
      <div className="font-bold mb-1">エラー</div>
      <div>{message}</div>
    </div>
  );
}

function StaleNotice() {
  return (
    <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
      ※ 入力値が変更されています。最新の数値で生成し直すには「再生成」をクリックしてください。
    </div>
  );
}

function buttonLabel(loading: boolean, hasAdvice: boolean): string {
  if (loading) { return "生成中..."; }
  if (hasAdvice) { return "再生成"; }
  return "AIアドバイス生成";
}

function Spinner() {
  return (
    <span className="inline-block w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
  );
}

/**
 * 簡易マークダウンレンダラ。Claudeが返す出力フォーマット（## 見出し + - リスト + 段落）に対応。
 * 完全なマークダウンエンジンではない。
 */
function AdviceMarkdown({ text }: { text: string }) {
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
