"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { Loader2, Pencil, Plus, Ruler, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/client-api";
import { plural } from "@/lib/format";
import DeleteConfirmModal from "@/components/shared/DeleteConfirmModal";
import UnitFormModal, { type UnitDraft, type UnitErrors } from "./UnitFormModal";
import type { MeasurementUnit } from "./FieldsPage";
import { unitLabel } from "./FieldsPage";

type Props = {
  units: MeasurementUnit[];
  loading: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onChanged: () => void;
};

export default function UnitsPanel({
  units,
  loading,
  canCreate,
  canEdit,
  canDelete,
  onChanged,
}: Props) {
  const [editing, setEditing] = useState<UnitDraft | null>(null);
  const [errors, setErrors] = useState<UnitErrors>({});
  const [deleting, setDeleting] = useState<MeasurementUnit | null>(null);
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const open = (draft: UnitDraft) => {
    setErrors({});
    setEditing(draft);
  };

  async function save() {
    if (!editing || busy) return;
    const name = editing.name.trim();
    const symbol = editing.symbol.trim();
    const next: UnitErrors = {};
    if (!name) next.name = "Unit name is required";
    if (!symbol) next.symbol = "Symbol is required";
    else if (symbol.length > 10)
      next.symbol = "Symbol must be 10 characters or less";
    const others = units.filter((u) => u.id !== editing.id);
    if (name && others.some((u) => u.name.toLowerCase() === name.toLowerCase()))
      next.name = "A unit with this name already exists";
    if (
      symbol &&
      others.some((u) => u.symbol.toLowerCase() === symbol.toLowerCase())
    )
      next.symbol = "A unit with this symbol already exists";
    setErrors(next);
    if (next.name || next.symbol) return;

    setBusy(true);
    try {
      await api(
        editing.id ? `units/${encodeURIComponent(editing.id)}` : "units",
        {
          method: editing.id ? "PATCH" : "POST",
          body: JSON.stringify({ name, symbol }),
        },
      );
      toast.success(editing.id ? "Unit updated" : "Unit added");
      setEditing(null);
      onChanged();
    } catch (error) {
      if (
        error instanceof ApiError &&
        (error.field === "name" || error.field === "symbol")
      )
        setErrors({ [error.field]: error.message });
      else
        toast.error(error instanceof Error ? error.message : "Unable to save unit");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!deleting || busy) return;
    setBusy(true);
    try {
      await api(`units/${encodeURIComponent(deleting.id)}`, {
        method: "DELETE",
      });
      toast.success("Unit deleted");
      setDeleting(null);
      onChanged();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to delete unit",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 p-5">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Measurement Units</h2>
          <p className="mt-1 text-sm text-slate-500">
            Units shown next to measurement fields, e.g. Bust (in).
          </p>
        </div>
        {canCreate && (
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-200 hover:bg-violet-700"
            onClick={() => open({ id: "", name: "", symbol: "" })}
          >
            <Plus size={17} /> Add Unit
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 p-10 text-sm text-violet-700">
          <Loader2 size={20} className="animate-spin" /> Loading units...
        </div>
      ) : units.length === 0 ? (
        <div className="p-12 text-center text-sm text-slate-500">
          No units yet. Add one to start creating measurement fields.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-6 py-4">Unit Name</th>
                <th className="px-6 py-4">Symbol</th>
                <th className="px-6 py-4">Used By</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {units.map((unit) => {
                const inUse = unit.fieldCount > 0;
                return (
                  <tr
                    key={unit.id}
                    className="border-t border-slate-100 hover:bg-violet-50/40"
                  >
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-3 font-semibold text-slate-800">
                        <span className="rounded-xl bg-violet-100 p-2.5 text-violet-700">
                          <Ruler size={18} />
                        </span>
                        {unit.name}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="rounded-full bg-violet-50 px-3 py-1 font-mono text-xs font-semibold text-violet-700">
                        {unit.symbol}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {plural(unit.fieldCount, "field")}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        {canEdit && (
                          <button
                            type="button"
                            title="Edit"
                            aria-label={`Edit ${unit.name}`}
                            className="rounded-lg border border-slate-200 p-2 text-violet-700 hover:bg-violet-50"
                            onClick={() =>
                              open({
                                id: unit.id,
                                name: unit.name,
                                symbol: unit.symbol,
                              })
                            }
                          >
                            <Pencil size={16} />
                          </button>
                        )}
                        {canDelete && (
                          // Disabled buttons do not show a title, so the wrapper carries it.
                          <span
                            title={
                              inUse
                                ? `Used by ${plural(unit.fieldCount, "field")}`
                                : "Delete"
                            }
                          >
                            <button
                              type="button"
                              aria-label={`Delete ${unit.name}`}
                              disabled={inUse}
                              className="rounded-lg border border-red-100 p-2 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:border-slate-100 disabled:text-slate-300 disabled:hover:bg-transparent"
                              onClick={() => setDeleting(unit)}
                            >
                              <Trash2 size={16} />
                            </button>
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {mounted &&
        editing &&
        createPortal(
          <UnitFormModal
            unit={editing}
            errors={errors}
            busy={busy}
            onChange={(next) => {
              setEditing(next);
              setErrors({});
            }}
            onCancel={() => {
              if (!busy) setEditing(null);
            }}
            onSave={() => void save()}
          />,
          document.body,
        )}

      {mounted &&
        deleting &&
        createPortal(
          <DeleteConfirmModal
            title={`Delete unit ${unitLabel(deleting)}?`}
            name=""
            message="This cannot be undone."
            busy={busy}
            onCancel={() => {
              if (!busy) setDeleting(null);
            }}
            onConfirm={() => void remove()}
          />,
          document.body,
        )}
    </section>
  );
}
