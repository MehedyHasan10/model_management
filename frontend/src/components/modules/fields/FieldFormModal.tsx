"use client";
import { Loader2, Save, X } from "lucide-react";
import { useEscapeKey } from "@/lib/useEscapeKey";
import type {
  FieldErrors,
  MeasurementField,
  MeasurementUnit,
} from "./FieldsPage";
import { unitLabel } from "./FieldsPage";
type Props = {
  field: MeasurementField;
  units: MeasurementUnit[];
  errors: FieldErrors;
  busy: boolean;
  onChange: (field: MeasurementField) => void;
  onGoToUnits: () => void;
  onCancel: () => void;
  onSave: () => void;
};
const inputClass = (error?: string) =>
  `mt-2 w-full rounded-xl border p-3 outline-none ${
    error
      ? "border-red-400 focus:border-red-500"
      : "border-slate-200 focus:border-violet-500"
  }`;
export default function FieldFormModal({
  field,
  units,
  errors,
  busy,
  onChange,
  onGoToUnits,
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
          noValidate
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
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? "field-name-error" : undefined}
              className={inputClass(errors.name)}
              placeholder="e.g. Chest"
              value={field.name}
              onChange={(e) => onChange({ ...field, name: e.target.value })}
            />
          </label>
          {errors.name && (
            <p id="field-name-error" className="mt-1.5 text-xs text-red-600">
              {errors.name}
            </p>
          )}
          <label className="mt-5 block text-sm font-semibold text-slate-700">
            Measurement Unit <span className="text-red-500">*</span>
            {units.length > 0 ? (
              <select
                required
                aria-invalid={Boolean(errors.unitId)}
                className={`${inputClass(errors.unitId)} bg-white`}
                value={field.unitId}
                onChange={(e) =>
                  onChange({ ...field, unitId: e.target.value })
                }
              >
                {!units.some((u) => u.id === field.unitId) && (
                  <option value="">Select a unit</option>
                )}
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unitLabel(unit)}
                  </option>
                ))}
              </select>
            ) : (
              <span className="mt-2 block rounded-xl border border-dashed border-slate-300 p-3 font-normal text-slate-500">
                No units yet.{" "}
                <button
                  type="button"
                  className="font-semibold text-violet-700 underline"
                  onClick={onGoToUnits}
                >
                  Add one in the Units tab
                </button>
              </span>
            )}
          </label>
          {errors.unitId && (
            <p className="mt-1.5 text-xs text-red-600">{errors.unitId}</p>
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
              disabled={busy || units.length === 0}
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
