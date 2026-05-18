"use client";

interface HeaderProps {
  locked: boolean;
  hasWork: boolean;
  statsText: string | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onToggleLock: () => void;
  onClear: () => void;
  onPickFile: () => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

/** 実績取込ヘッダー（CSV選択・ロック・クリア・統計） */
export function LedgerHeader({
  locked,
  hasWork,
  statsText,
  inputRef,
  onToggleLock,
  onClear,
  onPickFile,
  onFileChange,
}: HeaderProps) {
  return (
    <div className="bg-white border rounded-lg p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-base font-bold">実績取込（総勘定元帳CSV）</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleLock}
            className={`text-xs rounded px-3 py-1 border transition-colors ${
              locked
                ? "border-amber-500 bg-amber-50 text-amber-700"
                : "border-gray-400 text-gray-600 hover:bg-gray-50"
            }`}
            title={
              locked
                ? "ロック中：タブを移動しても保持。解除すると再読込・クリア可。"
                : "ロックすると新規読込・クリアを抑止し誤消去を防止。"
            }
          >
            {locked ? "🔒 ロック中" : "🔓 ロック"}
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={locked || !hasWork}
            className="text-xs border border-gray-400 text-gray-600 rounded px-3 py-1 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
            title={locked ? "ロック中はクリアできません" : "作業内容をクリア"}
          >
            クリア
          </button>
        </div>
      </div>
      <p className="text-sm text-gray-600">
        会計ソフト（freee / MFクラウド / 弥生会計対応）の総勘定元帳CSV（Shift-JIS可）から、資金繰り実績表・明細表を生成します。
        相手勘定科目はルールで自動分類し、未割当はAIまたは手動で割り当てます。
        作業内容はタブを移動しても保持されます（「ロック」で誤操作による消去を防止）。
      </p>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          onClick={onPickFile}
          disabled={locked}
          className="text-sm border border-blue-500 text-blue-700 rounded px-3 py-1.5 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed"
          title={locked ? "ロック中は読み込めません" : undefined}
        >
          総勘定元帳CSVを選択
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={onFileChange}
          className="hidden"
        />
        {statsText && (
          <span className="text-xs text-gray-500">{statsText}</span>
        )}
      </div>
    </div>
  );
}
