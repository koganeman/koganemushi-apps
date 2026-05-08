"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * /balance-sheet は /block-puzzle に統合済み。直リンク互換のためリダイレクトのみ。
 */
export default function BalanceSheetRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/block-puzzle?tab=bs");
  }, [router]);
  return (
    <div className="min-h-screen flex items-center justify-center text-sm text-gray-600">
      リダイレクト中…
    </div>
  );
}
