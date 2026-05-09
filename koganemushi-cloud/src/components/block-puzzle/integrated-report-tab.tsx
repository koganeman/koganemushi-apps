"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type {
  BlockPuzzleResult,
  BlockPuzzleUnit,
} from "@/types/block-puzzle";
import type { BalanceSheetResult } from "@/types/balance-sheet";
import { BlockPuzzleDiagram } from "@/components/block-puzzle/block-puzzle-diagram";
import { BalanceSheetDiagram } from "@/components/balance-sheet/balance-sheet-diagram";
import { generateReportPPTX } from "@/lib/pptx-report";
import { fmtRate, fmtThousand } from "@/lib/pptx-render-helpers";
import { computeAllIndicators } from "@/lib/financial-analysis-calc";
import { useFinancialAnalysisStore } from "@/stores/financial-analysis-store";
import { useShallow } from "zustand/react/shallow";

interface Props {
  plResults: BlockPuzzleResult[];
  bsResults: BalanceSheetResult[];
  plAdviceText: string | null;
  bsAdviceText: string | null;
  /** AI理想P/Lの計算結果。null=未生成 */
  idealResult: BlockPuzzleResult | null;
  /** AI理想P/Lの根拠テキスト（Markdown）。null=未生成 */
  idealReasoning: string | null;
  unit: BlockPuzzleUnit;
  showCashSection: boolean;
}

export function IntegratedReportTab(props: Props) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { profile, bsDetails } = useFinancialAnalysisStore(
    useShallow((s) => ({ profile: s.profile, bsDetails: s.bsDetails })),
  );
  const analysisResults = useMemo(
    () =>
      computeAllIndicators({
        plResults: props.plResults,
        bsResults: props.bsResults,
        bsDetails,
        profile,
      }),
    [props.plResults, props.bsResults, bsDetails, profile],
  );

  const hasPLData = props.plResults.some((r) => r.sales > 0);
  const hasBSData = props.bsResults.some((r) => r.totalAssets > 0);
  const hasFAData = analysisResults.some((r) => r.totalScore !== null);
  const hasAnyData = hasPLData || hasBSData;

  const handleGenerate = async () => {
    setError(null);
    setGenerating(true);
    try {
      const diagramElements = collectDiagramElements();
      await generateReportPPTX({
        plResults: props.plResults,
        bsResults: props.bsResults,
        plAdviceText: props.plAdviceText,
        bsAdviceText: props.bsAdviceText,
        analysisResults,
        idealResult: props.idealResult,
        idealReasoning: props.idealReasoning,
        diagramElements,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "PPTX生成に失敗しました");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <GenerateSection
        hasPLData={hasPLData}
        hasBSData={hasBSData}
        hasPLAdvice={!!props.plAdviceText}
        hasBSAdvice={!!props.bsAdviceText}
        hasFAData={hasFAData}
        hasAnyData={hasAnyData}
        generating={generating}
        error={error}
        onGenerate={handleGenerate}
      />
      <KpiSection
        plResults={props.plResults}
        bsResults={props.bsResults}
        hasAnyData={hasAnyData}
      />
      <SlideListSection />
      {hasAnyData && (
        <ReportPreviewSection
          plResults={props.plResults}
          bsResults={props.bsResults}
          idealResult={props.idealResult}
          unit={props.unit}
          showCashSection={props.showCashSection}
        />
      )}
    </div>
  );
}

interface PreviewProps {
  plResults: BlockPuzzleResult[];
  bsResults: BalanceSheetResult[];
  idealResult: BlockPuzzleResult | null;
  unit: BlockPuzzleUnit;
  showCashSection: boolean;
}

/**
 * PPTX生成用のソースとなる図を表示する「レポートプレビュー」セクション。
 * data-pptx-export-id 付きで各図を描画し、html2canvas のキャプチャ対象とする。
 * UI上で「PPTXに何が含まれるか」を確認できる利点もある。
 */
function ReportPreviewSection({ plResults, bsResults, idealResult, unit, showCashSection }: PreviewProps) {
  return (
    <section className="bg-white border rounded-lg p-4 space-y-4">
      <h3 className="text-sm font-bold text-gray-700">レポートプレビュー（PPTX出力対象）</h3>

      <div>
        <div className="text-xs font-semibold text-gray-600 mb-2">P/L 5期分</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {plResults.map((r, i) => (
            <div
              key={`pl-${i}`}
              data-pptx-export-id={`pl-${i}`}
              className="bg-white"
            >
              <BlockPuzzleDiagram
                result={r}
                unit={unit}
                showCashSection={showCashSection}
              />
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold text-gray-600 mb-2">B/S 5期分</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {bsResults.map((r, i) => (
            <div
              key={`bs-${i}`}
              data-pptx-export-id={`bs-${i}`}
              className="bg-white"
            >
              <BalanceSheetDiagram result={r} unit={unit} />
            </div>
          ))}
        </div>
      </div>

      {idealResult && (
        <div>
          <div className="text-xs font-semibold text-purple-700 mb-2">
            AI理想P/L（最終ページ用）
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            <div data-pptx-export-id="pl-ideal" className="bg-white">
              <BlockPuzzleDiagram
                result={idealResult}
                unit={unit}
                showCashSection={showCashSection}
                variant="ideal"
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

interface GenerateSectionProps {
  hasPLData: boolean;
  hasBSData: boolean;
  hasPLAdvice: boolean;
  hasBSAdvice: boolean;
  hasFAData: boolean;
  hasAnyData: boolean;
  generating: boolean;
  error: string | null;
  onGenerate: () => void;
}

function GenerateSection(p: GenerateSectionProps) {
  return (
    <section className="bg-white border rounded-lg p-4 space-y-3">
      <h2 className="text-base font-bold">
        <span className="inline-block w-3 h-3 bg-amber-500 rounded-full mr-1" />
        経営レポート（PPTX出力）
      </h2>
      <p className="text-sm text-gray-600">
        P/Lタブ・B/Sタブで入力したデータ、AIが生成したアドバイス、財務分析（ローカルベンチマーク）の結果、AI理想P/Lを使って10スライドのPowerPointレポートを作成します。
        財務に詳しくない経営者の方にも見やすいシンプルな構成です。
      </p>

      <ChecklistRow
        label="P/Lデータ"
        ok={p.hasPLData}
        okLabel="入力済み"
        ngLabel="未入力 — P/Lタブで入力またはサンプル読込"
      />
      <ChecklistRow
        label="B/Sデータ"
        ok={p.hasBSData}
        okLabel="入力済み"
        ngLabel="未入力 — B/Sタブで入力またはサンプル読込"
      />
      <ChecklistRow
        label="AI 経営アドバイス（P/L）"
        ok={p.hasPLAdvice}
        okLabel="生成済み"
        ngLabel="未生成（任意）— P/Lタブで「AIアドバイス生成」"
      />
      <ChecklistRow
        label="AI 財務体質アドバイス（B/S）"
        ok={p.hasBSAdvice}
        okLabel="生成済み"
        ngLabel="未生成（任意）— B/Sタブで「AIアドバイス生成」"
      />
      <ChecklistRow
        label="財務分析（ローカルベンチマーク）"
        ok={p.hasFAData}
        okLabel="算出可能"
        ngLabel="未入力（任意）— 財務分析タブで業種・従業員数・B/S詳細を入力"
      />

      <div className="pt-2">
        <Button
          onClick={p.onGenerate}
          disabled={p.generating || !p.hasAnyData}
          className="bp-print-hide"
        >
          {p.generating ? "PPTX生成中…" : "PPTX出力（経営レポートをダウンロード）"}
        </Button>
        {!p.hasAnyData && (
          <span className="ml-3 text-xs text-gray-500">
            ※ P/LまたはB/Sのデータを最低1期入力してください
          </span>
        )}
      </div>

      {p.error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">
          {p.error}
        </div>
      )}
    </section>
  );
}

interface KpiSectionProps {
  plResults: BlockPuzzleResult[];
  bsResults: BalanceSheetResult[];
  hasAnyData: boolean;
}

interface KpiData {
  label: string;
  value: string;
  accent: string;
}

function fmtYen(value: number | null): string {
  if (value === null) { return "-"; }
  return `${fmtThousand(value)} 千円`;
}

function negColor(value: number | null, fallback: string): string {
  if (value !== null && value < 0) { return "text-red-600"; }
  return fallback;
}

function pickPL(plResults: BlockPuzzleResult[]): BlockPuzzleResult | null {
  const r = plResults[0];
  if (!r || r.sales === 0) { return null; }
  return r;
}

function pickBS(bsResults: BalanceSheetResult[]): BalanceSheetResult | null {
  const r = bsResults[0];
  if (!r || r.totalAssets === 0) { return null; }
  return r;
}

function pickField(pl: BlockPuzzleResult | null, key: keyof BlockPuzzleResult): number | null {
  if (!pl) { return null; }
  const v = pl[key];
  return typeof v === "number" ? v : null;
}

function buildKpiList(plResults: BlockPuzzleResult[], bsResults: BalanceSheetResult[]): KpiData[] {
  const pl = pickPL(plResults);
  const bs = pickBS(bsResults);
  const sales = pickField(pl, "sales");
  const profit = pickField(pl, "preTaxProfit");
  const cash = pickField(pl, "cashIncrease");

  return [
    { label: "売上高（最新期）", value: fmtYen(sales), accent: "text-blue-700" },
    { label: "税引前当期利益", value: fmtYen(profit), accent: negColor(profit, "text-emerald-600") },
    { label: "自己資本比率", value: bs ? fmtRate(bs.equityRatio) : "-", accent: "text-purple-700" },
    { label: "増加キャッシュ", value: fmtYen(cash), accent: negColor(cash, "text-emerald-600") },
  ];
}

function KpiSection({ plResults, bsResults, hasAnyData }: KpiSectionProps) {
  return (
    <section className="bg-white border rounded-lg p-4 space-y-3">
      <h3 className="text-sm font-bold text-gray-700">最新期のハイライト</h3>
      {!hasAnyData ? (
        <p className="text-sm text-gray-500">データを入力するとここにハイライトが表示されます。</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {buildKpiList(plResults, bsResults).map((k) => (
            <Kpi key={k.label} label={k.label} value={k.value} accent={k.accent} />
          ))}
        </div>
      )}
    </section>
  );
}

function SlideListSection() {
  return (
    <section className="bg-white border rounded-lg p-4 space-y-2">
      <h3 className="text-sm font-bold text-gray-700">レポート構成（10スライド）</h3>
      <ol className="list-decimal pl-5 text-sm text-gray-700 space-y-1">
        <li>表紙（タイトル・対象期間・出力日）</li>
        <li>経営の概観（4つの主要KPI）</li>
        <li>損益の流れ（P/L 5期分のブロックパズル図）</li>
        <li>財務体質（B/S 5期分のブロックパズル図）</li>
        <li>財務分析（ローカルベンチマーク6指標 + 総合グレード）</li>
        <li>指標の意味（算式・分類・単位）</li>
        <li>AI 経営アドバイス（P/Lの改善アクション要約）</li>
        <li>AI 財務体質アドバイス（B/Sの改善アクション要約）</li>
        <li>改善アクション TOP3（両アドバイスから抜粋）</li>
        <li>AIが提案する理想のP/L（ブロックパズル図 + 全体方針 + 主要KPI + 達成のためのアクション）</li>
      </ol>
    </section>
  );
}

function collectDiagramElements(): Map<string, HTMLElement> {
  const m = new Map<string, HTMLElement>();
  const els = document.querySelectorAll<HTMLElement>("[data-pptx-export-id]");
  els.forEach((el) => {
    const id = el.getAttribute("data-pptx-export-id");
    if (id) { m.set(id, el); }
  });
  return m;
}

function ChecklistRow({
  label,
  ok,
  okLabel,
  ngLabel,
}: {
  label: string;
  ok: boolean;
  okLabel: string;
  ngLabel: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span
        className={
          ok
            ? "inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold"
            : "inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 text-gray-500 text-xs"
        }
      >
        {ok ? "✓" : "—"}
      </span>
      <span className="font-medium text-gray-700 min-w-[180px]">{label}</span>
      <span className={ok ? "text-emerald-700" : "text-gray-500"}>
        {ok ? okLabel : ngLabel}
      </span>
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="border rounded p-3 bg-gray-50">
      <div className="text-xs text-gray-600">{label}</div>
      <div className={`text-xl font-bold mt-1 ${accent}`}>{value}</div>
    </div>
  );
}
