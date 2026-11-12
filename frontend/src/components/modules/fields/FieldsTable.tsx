"use client";
import { Pencil, Ruler, Trash2 } from "lucide-react";
import type { MeasurementField } from "./FieldsPage";
type Props = {
  rows: MeasurementField[];
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (row: MeasurementField) => void;
  onDelete: (row: MeasurementField) => void;
};
export default function FieldsTable({
  rows,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-6 py-4">Field Name</th>
            <th className="px-6 py-4">Unit</th>
            <th className="px-6 py-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              className="border-t border-slate-100 hover:bg-violet-50/40"
            >
              <td className="px-6 py-4">
                <span className="inline-flex items-center gap-3 font-semibold text-slate-800">
                  <span className="rounded-xl bg-violet-100 p-2.5 text-violet-700">
                    <Ruler size={18} />
                  </span>
                  {r.name}
                </span>
              </td>
              <td className="px-6 py-4">
                <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
                  {r.unit === "cm"
                    ? "Centimeters (cm)"
                    : r.unit === "in"
                      ? "Inches (in)"
                      : r.unit}
                </span>
              </td>
              <td className="px-6 py-4">
                <div className="flex justify-end gap-2">
                  {canEdit && (
                    <button
                      type="button"
                      title="Edit"
                      aria-label={`Edit ${r.name}`}
                      className="rounded-lg border border-slate-200 p-2 text-violet-700 hover:bg-violet-50"
                      onClick={() => onEdit(r)}
                    >
                      <Pencil size={16} />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      title="Delete"
                      aria-label={`Delete ${r.name}`}
                      className="rounded-lg border border-red-100 p-2 text-red-600 hover:bg-red-50"
                      onClick={() => onDelete(r)}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
