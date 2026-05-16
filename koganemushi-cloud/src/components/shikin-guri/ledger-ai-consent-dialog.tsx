"use client";

import { AdviceConsentDialog } from "@/components/block-puzzle/advice-consent-dialog";

interface Props {
  open: boolean;
  /** AI送信対象の相手勘定科目数 */
  count: number;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * 相手勘定科目→科目 のAI補完に先立つ送信内容確認ダイアログ。
 * 既存 AdviceConsentDialog を本機能向けの文言で再利用する。
 */
export function LedgerAiConsentDialog({
  open,
  count,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <AdviceConsentDialog
      open={open}
      onCancel={onCancel}
      onConfirm={onConfirm}
      description={`ルールで自動判定できなかった相手勘定科目（${count}件）を Anthropic 社の Claude API に送信し、資金繰り科目への割当を推定します。送信される内容と送信されない内容を以下にご確認ください。`}
      sentItems={[
        "ルール未割当の「相手勘定科目」名（例：未払金、諸口）",
        "その相手勘定科目の摘要サンプル文字列（各最大5件）",
      ]}
    />
  );
}
