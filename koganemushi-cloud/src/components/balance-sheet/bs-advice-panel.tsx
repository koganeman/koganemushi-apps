"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { BalanceSheetResult } from "@/types/balance-sheet";
import {
  hashBSPeriods,
  useBalanceSheetStore,
} from "@/stores/balance-sheet-store";
import { useShallow } from "zustand/react/shallow";
import { AdviceConsentDialog } from "@/components/block-puzzle/advice-consent-dialog";
import { AdviceMarkdown } from "@/components/block-puzzle/advice-markdown";

interface Props {
  results: BalanceSheetResult[];
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

const BS_SENT_ITEMS = [
  "期末日（例：2025/3/31）",
  "現預金、流動資産（現預金除く）、固定資産",
  "流動負債、固定負債、純資産",
  "総資産、総資本、貸借差額",
  "流動比率、自己資本比率、固定比率、固定長期適合率",
];

const BS_DESCRIPTION =
  "「AIアドバイス生成」では、入力されたB/Sデータと派生指標を Anthropic 社の Claude API に送信します。送信される内容と送信されない内容を以下にご確認ください。";

export function BSAdvicePanel({ results }: Props) {
  const { advice, setAdvice, periods } = useBalanceSheetStore(
    useShallow((s) => ({
      advice: s.advice,
      setAdvice: s.setAdvice,
      periods: s.periods,
    })),
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);

  const currentHash = hashBSPeriods(periods);
  const isStale = advice !== null && advice.periodsHash !== currentHash;
  const hasAnyData = results.some((r) => r.totalAssets > 0);

  const handleClick = () => {
    setError(null);
    setConsentOpen(true);
  };

  const handleConfirmAndGenerate = async () => {
    setConsentOpen(false);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/balance-sheet-advice", {
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
          AI 財務体質アドバイス
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
        sentItems={BS_SENT_ITEMS}
        description={BS_DESCRIPTION}
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
        B/Sデータを入力するとAIによる財務体質の分析と改善アクション提案を生成できます。
      </div>
    );
  }
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-600 py-4">
        <Spinner />
        Claudeが5期分の貸借対照表を分析中です。10〜30秒ほどお待ちください…
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
