"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  HEALTH_INSURANCE_TABLE,
  HEALTH_INSURANCE_MAX_GRADE,
  PENSION_TABLE,
  PENSION_MAX_GRADE,
} from "@/lib/tax-tables";
import { formatYen } from "@/lib/format";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Row {
  grade: number;
  from: number;
  to: number;
  standard: number;
}

function buildRows(table: [number, number][], maxStandard: number): Row[] {
  const rows: Row[] = [];
  let prev = 0;
  table.forEach(([limit, standard], i) => {
    rows.push({ grade: i + 1, from: prev, to: limit, standard });
    prev = limit;
  });
  rows.push({ grade: table.length + 1, from: prev, to: Infinity, standard: maxStandard });
  return rows;
}

function Table({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <section>
      <h3 className="font-bold mb-2 text-sm">{title}</h3>
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-2 py-1">等級</th>
            <th className="border px-2 py-1">月額範囲</th>
            <th className="border px-2 py-1">標準報酬</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.grade}>
              <td className="border px-2 py-0.5 text-center">{r.grade}</td>
              <td className="border px-2 py-0.5 text-right">
                {r.from === 0 ? "～" : `${formatYen(r.from)}～`}
                {r.to === Infinity ? "" : formatYen(r.to)}
              </td>
              <td className="border px-2 py-0.5 text-right">{formatYen(r.standard)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function StandardRemunerationTableDialog({ open, onOpenChange }: Props) {
  const healthRows = buildRows(HEALTH_INSURANCE_TABLE, HEALTH_INSURANCE_MAX_GRADE);
  const pensionRows = buildRows(PENSION_TABLE, PENSION_MAX_GRADE);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>標準報酬月額テーブル</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Table title="健康保険" rows={healthRows} />
          <Table title="厚生年金" rows={pensionRows} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
