"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { useSimulationStore } from "@/stores/simulation-store";
import { formatYen, parseYen } from "@/lib/format";
import { StandardRemunerationTableDialog } from "./standard-remuneration-table-dialog";
import type { ExecutiveInput } from "@/types/simulation";

interface Props {
  plan: "current" | "comparison";
  index: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExecutiveDetailDialog({ plan, index, open, onOpenChange }: Props) {
  const exec = useSimulationStore((s) =>
    plan === "current" ? s.currentExecutives[index] : s.comparisonExecutives[index]
  );
  const updateExec = useSimulationStore((s) =>
    plan === "current" ? s.updateCurrentExecutive : s.updateComparisonExecutive
  );
  const [tableOpen, setTableOpen] = useState(false);

  if (!exec) return null;

  const patch = (partial: Partial<ExecutiveInput>) => {
    updateExec(index, { ...exec, ...partial });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {exec.name || `役員${index + 1}`}: 社会保険 詳細設定
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={exec.hasMidYearChange}
                onCheckedChange={(c) => patch({ hasMidYearChange: !!c })}
              />
              期中に標準報酬改定あり
            </label>

            {exec.hasMidYearChange && (
              <div className="space-y-3 pl-6 border-l-2 border-gray-200">
                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 items-center text-sm">
                  <label>変更前月額:</label>
                  <input
                    type="text"
                    className="border rounded px-2 py-1 text-right"
                    defaultValue={
                      exec.preChangeMonthlyRemuneration === 0
                        ? ""
                        : formatYen(exec.preChangeMonthlyRemuneration)
                    }
                    onBlur={(e) =>
                      patch({ preChangeMonthlyRemuneration: parseYen(e.target.value) })
                    }
                    key={`pre-${exec.preChangeMonthlyRemuneration}`}
                  />

                  <label>変更後月額:</label>
                  <input
                    type="text"
                    className="border rounded px-2 py-1 text-right"
                    defaultValue={
                      exec.postChangeMonthlyRemuneration === 0
                        ? ""
                        : formatYen(exec.postChangeMonthlyRemuneration)
                    }
                    onBlur={(e) =>
                      patch({ postChangeMonthlyRemuneration: parseYen(e.target.value) })
                    }
                    key={`post-${exec.postChangeMonthlyRemuneration}`}
                  />

                  <label>改定月 (1〜13):</label>
                  <input
                    type="number"
                    min={1}
                    max={13}
                    className="border rounded px-2 py-1 text-right"
                    value={exec.standardRemunerationChangeMonth}
                    onChange={(e) => {
                      const n = parseInt(e.target.value) || 1;
                      patch({
                        standardRemunerationChangeMonth: Math.min(13, Math.max(1, n)),
                      });
                    }}
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTableOpen(true)}
                >
                  標準報酬月額テーブルを表示
                </Button>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                閉じる
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <StandardRemunerationTableDialog
        open={tableOpen}
        onOpenChange={setTableOpen}
      />
    </>
  );
}
