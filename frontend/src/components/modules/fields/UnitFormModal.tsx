"use client";
import { Loader2, Save, X } from "lucide-react";
import { useEscapeKey } from "@/lib/useEscapeKey";

export type UnitDraft = { id: string; name: string; symbol: string };
export type UnitErrors = { name?: string; symbol?: string };

type Props = {
  unit: UnitDraft;
  errors: UnitErrors;
  busy: boolean;
  onChange: (unit: UnitDraft) => void;
  onCancel: () => void;
  onSave: () => void;
};

const inputClass = (error?: string) =>
  `mt-2 w-full rounded-xl border p-3 font-normal outline-none ${
    error
      ? "border-red-400 focus:border-red-500"
      : "border-slate-200 focus:border-violet-500"
  }`;

export default function UnitFormModal({
  unit,
  errors,
  busy,
  onChange,
  onCancel,
  onSave,
}: Props) {
  useEscapeKey(() => {
    if (!busy) onCancel();
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={unit.id ? "Edit Unit" : "Add Unit"}
        className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">
            {unit.id ? "Edit Unit" : "Add Unit"}
          </h2>
          <button
            type="button"
            aria-label="Close"
            disabled={busy}
            className="rounded-lg p-2 hover:bg-slate-100"
            onClick={onCancel}
          >
            <X size={20} />
          </button>
        </div>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            onSave();
          }}
        >
          <label className="mt-6 block text-sm font-semibold text-slate-700">
            Unit Name <span className="text-red-500">*</span>
            <input
              autoFocus
              maxLength={50}
              aria-invalid={Boolean(errors.name)}
              className={inputClass(errors.name)}
              placeholder="e.g. Inches"
              value={unit.name}
              onChange={(e) => onChange({ ...unit, name: e.target.value })}
            />
          </label>
          {errors.name && (
            <p className="mt-1.5 text-xs text-red-600">{errors.name}</p>
          )}
          <label className="mt-5 block text-sm font-semibold text-slate-700">
            Symbol <span className="text-red-500">*</span>
            <input
              maxLength={10}
              aria-invalid={Boolean(errors.symbol)}
              className={inputClass(errors.symbol)}
              placeholder="e.g. in"
              value={unit.symbol}
              onChange={(e) => onChange({ ...unit, symbol: e.target.value })}
            />
          </label>
          {errors.symbol && (
            <p className="mt-1.5 text-xs text-red-600">{errors.symbol}</p>
          )}
          <div className="mt-7 flex justify-end gap-3 border-t border-slate-100 pt-5">
            <button
              type="button"
              disabled={busy}
              className="rounded-xl bg-slate-100 px-5 py-2.5 font-semibold text-slate-700"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <Save size={17} />
              )}
              {busy ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
