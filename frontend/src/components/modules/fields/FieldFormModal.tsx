"use client";
import { Loader2, Save, X } from "lucide-react";
import type { MeasurementField } from "./FieldsPage";
type Props = {
  field: MeasurementField;
  busy: boolean;
  onChange: (field: MeasurementField) => void;
  onCancel: () => void;
  onSave: () => void;
};
export default function FieldFormModal({
  field,
  busy,
  onChange,
  onCancel,
  onSave,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Measurement field form"
        className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {field.id ? "Edit Measurement Field" : "Create Measurement Field"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Enter a unique field name and measurement unit.
            </p>
          </div>
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
          onSubmit={(e) => {
            e.preventDefault();
            onSave();
          }}
        >
          <label className="mt-6 block text-sm font-semibold text-slate-700">
            Field Name <span className="text-red-500">*</span>
            <input
              autoFocus
              required
              maxLength={100}
              className="mt-2 w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-violet-500"
              placeholder="e.g. Chest"
              value={field.name}
              onChange={(e) => onChange({ ...field, name: e.target.value })}
            />
          </label>
          <label className="mt-5 block text-sm font-semibold text-slate-700">
            Measurement Unit <span className="text-red-500">*</span>
            <select
              required
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 outline-none focus:border-violet-500"
              value={field.unit || "in"}
              onChange={(e) => onChange({ ...field, unit: e.target.value })}
            >
              <option value="in">Inches (in)</option>
              <option value="cm">Centimeters (cm)</option>
            </select>
          </label>
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
              {busy ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
              {busy ? "Saving..." : field.id ? "Save Changes" : "Create Field"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
