"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const SENT_ITEMS = [
  "期末日（例：2025/6/30）",
  "売上高、変動費（売上原価）、粗利益、粗利益率",
  "人件費合計、労働分配率、その他固定費、固定費合計",
  "税引前/税引後の損益、法人税等",
  "減価償却費、借入金返済、増加キャッシュ",
];

const NOT_SENT_ITEMS = [
  "会社名（社名・屋号）",
  "代表者氏名・社員氏名・住所・電話番号",
  "利用者識別番号・法人番号・整理番号",
  "取引先名、銀行口座、契約先など特定可能な情報",
  "PDF原本（PDF解析はブラウザ内で完結）",
  "詳細な勘定科目（広告宣伝費、外注費 等の個別科目）",
];

export function AdviceConsentDialog({ open, onCancel, onConfirm }: Props) {
  const [agreed, setAgreed] = useState(false);

  const handleCancel = () => {
    setAgreed(false);
    onCancel();
  };

  const handleConfirm = () => {
    setAgreed(false);
    onConfirm();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { handleCancel(); } }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Anthropic への送信内容を確認</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <p className="text-gray-700">
            「AIアドバイス生成」では、入力されたP/Lデータを Anthropic 社の Claude API に送信します。
            送信される内容と送信されない内容を以下にご確認ください。
          </p>

          {/* 送信される項目 */}
          <section>
            <h3 className="font-bold text-green-800 mb-1 flex items-center gap-1">
              <span className="inline-block w-4 h-4 rounded-full bg-green-100 text-green-700 text-[10px] flex items-center justify-center font-bold">✓</span>
              送信される項目（集計値のみ）
            </h3>
            <ul className="list-disc pl-6 space-y-1 text-gray-700">
              {SENT_ITEMS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          {/* 送信されない項目 */}
          <section>
            <h3 className="font-bold text-blue-800 mb-1 flex items-center gap-1">
              <span className="inline-block w-4 h-4 rounded-full bg-blue-100 text-blue-700 text-[10px] flex items-center justify-center font-bold">×</span>
              送信されない項目（特定可能情報）
            </h3>
            <ul className="list-disc pl-6 space-y-1 text-gray-700">
              {NOT_SENT_ITEMS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="text-xs text-gray-600 mt-2">
              ⇒ Anthropic 側に届くのは「ある日本企業の集計済P/L数値」レベルの匿名化されたデータです。
            </p>
          </section>

          {/* Anthropic 側のデータ取り扱い */}
          <section className="bg-gray-50 border rounded p-3 text-xs space-y-1 text-gray-700">
            <div className="font-bold text-gray-800">Anthropic 側のデータ取り扱い（API利用時の既定）</div>
            <ul className="list-disc pl-5 space-y-0.5">
              <li>API入出力はモデル学習に利用されません</li>
              <li>不正利用検知のため最大30日程度保持後に削除</li>
              <li>通信中・保存時とも暗号化（TLS）、SOC 2 Type II 準拠</li>
            </ul>
            <div className="text-[10px] text-gray-500 mt-1">
              最新の正式ポリシーは{" "}
              <a
                href="https://www.anthropic.com/legal/commercial-terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Commercial Terms
              </a>
              {" / "}
              <a
                href="https://www.anthropic.com/legal/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Privacy Policy
              </a>
              {" "}をご確認ください。
            </div>
          </section>

          {/* 同意チェックボックス */}
          <label className="flex items-start gap-2 cursor-pointer bg-purple-50 border border-purple-200 rounded p-3">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5"
            />
            <span className="text-sm text-gray-800">
              上記の送信内容と Anthropic 側のデータ取り扱いを理解した上で、集計値のみを送信することに同意します。
            </span>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={handleCancel}>
              キャンセル
            </Button>
            <Button onClick={handleConfirm} disabled={!agreed}>
              送信して生成する
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
