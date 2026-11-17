"use client";
import { Pencil, Ruler, Trash2 } from "lucide-react";
import type { MeasurementField } from "./FieldsPage";
import { unitLabel } from "./FieldsPage";
type Props = {
  rows: MeasurementField[];
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (row: MeasurementField) => void;
  onDelete: (row: MeasurementField) => void;
};
export default function FieldsGrid({
  rows,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: Props) {
  return (
    <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((r) => (
        <div
          key={r.id}
          className="rounded-2xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-md"
        >
          <div className="flex items-start justify-between">
            <span className="rounded-xl bg-violet-100 p-3 text-violet-700">
              <Ruler size={23} />
            </span>
            <div className="flex gap-2">
              {canEdit && (
                <button
                  type="button"
                  aria-label={`Edit ${r.name}`}
                  className="rounded-lg p-2 text-slate-500 hover:bg-violet-50 hover:text-violet-700"
                  onClick={() => onEdit(r)}
                >
                  <Pencil size={16} />
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  aria-label={`Delete ${r.name}`}
                  className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"
                  onClick={() => onDelete(r)}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>
          <h3 className="mt-5 text-lg font-bold text-slate-900">{r.name}</h3>
          <p className="mt-2 text-xs text-slate-500">
            Unit:{" "}
            {unitLabel(r.unit)}
          </p>
        </div>
      ))}
    </div>
  );
}
