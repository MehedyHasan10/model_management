"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { Save, X, Loader2 } from "lucide-react";
import { useEscapeKey } from "@/lib/useEscapeKey";

export type FieldOption = { id: string; name: string };
export type CategoryOption = { id: string; name: string };
export type QualityChecks = {
  colorGuarantee: boolean;
  shrinkResistance: boolean;
  bubblingResistance: boolean;
  printEmbroideryQuality: boolean;
};
export type TemplateDraft = {
  id?: string;
  name: string;
  categoryId: string;
  status: string;
  sizes: string[];
  fieldIds: string[];
  qualityChecks: QualityChecks;
  noMeasurementFieldId?: string;
  noMeasurementText?: string;
};

export const standardSizes = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];
const standardChecks: QualityChecks = {
  colorGuarantee: false,
  shrinkResistance: false,
  bubblingResistance: false,
  printEmbroideryQuality: false,
};

// Existing DB rows need no new column: empty sizes AND empty fields = No Measurement.
export function isNoMeasurement(
  template: Pick<TemplateDraft, "sizes" | "fieldIds">,
) {
  return (
    (template.sizes?.length ?? 0) === 0 &&
    (template.fieldIds?.length ?? 0) === 0
  );
}

export function defaultDraft(): TemplateDraft {
  return {
    name: "",
    categoryId: "",
    status: "ACTIVE",
    sizes: [...standardSizes],
    fieldIds: [],
    qualityChecks: { ...standardChecks },
    noMeasurementFieldId: "",
    noMeasurementText: "",
  };
}

export function normalizeDraft(row: any): TemplateDraft {
  const fieldIds: string[] = Array.from(
    new Set<string>(
      Array.isArray(row.fields)
        ? row.fields
            .map((f: any) => String(f.fieldId || f.field?.id || ""))
            .filter(Boolean)
        : Array.isArray(row.fieldIds)
          ? row.fieldIds.map(String)
          : [],
    ),
  );
  return {
    id: row.id,
    name: row.name || "",
    categoryId: row.categoryId || "",
    status: row.status || "ACTIVE",
    sizes: Array.isArray(row.sizes) ? [...row.sizes] : [...standardSizes],
    fieldIds,
    qualityChecks: pickQualityChecks(row.qualityChecks),
    noMeasurementFieldId:
      row.noMeasurementFieldId || row.qualityChecks?.noMeasurementFieldId || "",
    noMeasurementText:
      row.noMeasurementText || row.qualityChecks?.noMeasurementText || "",
  };
}

// The only quality checks. No Measurement settings are separate template
// values and must never be listed here.
export const checkLabels: Record<keyof QualityChecks, string> = {
  colorGuarantee: "Color Guarantee",
  shrinkResistance: "Shrink Resistance",
  bubblingResistance: "Bubbling Resistance",
  printEmbroideryQuality: "Print / Embroidery Quality",
};

/** Keeps only the known boolean checks from saved data. */
export function pickQualityChecks(value: unknown): QualityChecks {
  const source = (value && typeof value === "object" ? value : {}) as Record<
    string,
    unknown
  >;
  const checks = { ...standardChecks };
  for (const key of Object.keys(checks) as Array<keyof QualityChecks>)
    checks[key] = source[key] === true;
  return checks;
}
const inputStyle =
  "mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

type Props = {
  value: TemplateDraft;
  onChange: (next: TemplateDraft) => void;
  categories: CategoryOption[];
  fields: FieldOption[];
  busy: boolean;
  onCancel: () => void;
  onSave: () => void;
};

export default function TemplateFormModal({
  value,
  onChange,
  categories,
  fields,
  busy,
  onCancel,
  onSave,
}: Props) {
  const titleId = useId();
  const noMeasurement = isNoMeasurement(value);
  const [sizesText, setSizesText] = useState((value.sizes || []).join(", "));
  // Preserve previous selections if user switches back before saving.
  const [lastMeasured, setLastMeasured] = useState({
    sizes: value.sizes.length ? [...value.sizes] : [...standardSizes],
    fieldIds: [...value.fieldIds],
  });

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  useEscapeKey(() => {
    if (!busy) onCancel();
  });

  function update<K extends keyof TemplateDraft>(
    key: K,
    next: TemplateDraft[K],
  ) {
    onChange({ ...value, [key]: next });
  }
  function changeMode(next: "measured" | "none") {
    if (next === "none") {
      if (!noMeasurement)
        setLastMeasured({ sizes: value.sizes, fieldIds: value.fieldIds });
      onChange({ ...value, sizes: [], fieldIds: [] });
      setSizesText("");
    } else {
      const restored = lastMeasured.sizes.length
        ? lastMeasured.sizes
        : standardSizes;
      onChange({
        ...value,
        sizes: [...restored],
        fieldIds: [...lastMeasured.fieldIds],
      });
      setSizesText(restored.join(", "));
    }
  }
  function updateSizes(text: string) {
    setSizesText(text);
    const sizes = Array.from(
      new Set(
        text
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    );
    update("sizes", sizes);
    setLastMeasured((old) => ({ ...old, sizes }));
  }
  function updateFields(ids: string[]) {
    const next = Array.from(new Set(ids));
    update("fieldIds", next);
    setLastMeasured((old) => ({ ...old, fieldIds: next }));
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!busy) onSave();
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-3 sm:p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[calc(100dvh-24px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
            <div>
              <h2 id={titleId} className="text-xl font-bold text-slate-900">
                {value.id ? "Edit Template" : "Create Template"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Choose whether this garment needs a size-wise measurement chart.
              </p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={onCancel}
              aria-label="Close"
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
            >
              <X size={20} />
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-slate-700">
                Template Name <span className="text-red-500">*</span>
                <input
                  required
                  maxLength={100}
                  autoFocus
                  value={value.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="e.g. Saree Collection"
                  className={inputStyle}
                />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Category <span className="text-red-500">*</span>
                <select
                  required
                  value={value.categoryId}
                  onChange={(e) => update("categoryId", e.target.value)}
                  className={inputStyle}
                >
                  <option value="">Select category...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Measurement Type
                <select
                  value={noMeasurement ? "none" : "measured"}
                  onChange={(e) =>
                    changeMode(e.target.value as "none" | "measured")
                  }
                  className={inputStyle}
                >
                  <option value="measured">Size-wise Measurement</option>
                  <option value="none">No Measurement</option>
                </select>
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Status
                <select
                  value={value.status}
                  onChange={(e) => update("status", e.target.value)}
                  className={inputStyle}
                >
                  {["DRAFT", "ACTIVE", "ARCHIVED"].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {noMeasurement ? (
              <div className="mt-6 rounded-2xl border border-indigo-200 bg-indigo-50 p-5 text-center">
                <h3 className="font-bold text-indigo-900">
                  No Measurement Template
                </h3>
                <p className="mt-2 text-sm text-indigo-700">
                  Choose a size field and enter printable text.
                </p>
                <label className="mt-4 block text-left text-sm font-semibold text-slate-700">
                  Size Field
                  <select
                    required
                    value={value.noMeasurementFieldId || ""}
                    onChange={(e) =>
                      update("noMeasurementFieldId", e.target.value)
                    }
                    className={inputStyle}
                  >
                    <option value="">Select No Size / Free Size...</option>
                    {fields
                      .filter((f) =>
                        ["no size", "free size"].includes(
                          f.name.trim().toLowerCase(),
                        ),
                      )
                      .map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="mt-4 block text-left text-sm font-semibold text-slate-700">
                  Text Column
                  <textarea
                    rows={3}
                    maxLength={2000}
                    value={value.noMeasurementText || ""}
                    onChange={(e) =>
                      update("noMeasurementText", e.target.value)
                    }
                    placeholder="Write description for preview and print..."
                    className={inputStyle}
                  />
                </label>
              </div>
            ) : (
              <>
                <label className="mt-6 block text-sm font-semibold text-slate-700">
                  Sizes (comma separated)
                  <input
                    value={sizesText}
                    onChange={(e) => updateSizes(e.target.value)}
                    placeholder="XS, S, M, L, XL"
                    className={inputStyle}
                  />
                </label>
                <section className="mt-6 border-t border-slate-100 pt-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-slate-900">
                        Measurement Columns
                      </h3>
                      <p className="mt-1 text-xs text-slate-500">
                        {value.fieldIds.length} selected
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busy || !fields.length}
                        onClick={() =>
                          updateFields([
                            ...value.fieldIds,
                            ...fields
                              .filter(
                                (f) =>
                                  !["no size", "free size"].includes(
                                    f.name.trim().toLowerCase(),
                                  ),
                              )
                              .map((f) => f.id),
                          ])
                        }
                        className="rounded-xl bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        disabled={busy || !fields.length}
                        onClick={() =>
                          updateFields(
                            value.fieldIds.filter(
                              (id) => !fields.some((f) => f.id === id),
                            ),
                          )
                        }
                        className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-50"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>
                  {fields.length ? (
                    <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {fields
                        .filter(
                          (f) =>
                            !["no size", "free size"].includes(
                              f.name.trim().toLowerCase(),
                            ),
                        )
                        .map((f) => (
                          <label
                            key={f.id}
                            className="flex cursor-pointer items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-700 hover:bg-slate-100"
                          >
                            <input
                              type="checkbox"
                              disabled={busy}
                              className="h-4 w-4 accent-indigo-600"
                              checked={value.fieldIds.includes(f.id)}
                              onChange={(e) =>
                                updateFields(
                                  e.target.checked
                                    ? [...value.fieldIds, f.id]
                                    : value.fieldIds.filter(
                                        (id) => id !== f.id,
                                      ),
                                )
                              }
                            />
                            {f.name}
                          </label>
                        ))}
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-amber-700">
                      No fields found. Create measurement fields first.
                    </p>
                  )}
                </section>
              </>
            )}
            <section className="mt-6 border-t border-slate-100 pt-5">
              <h3 className="font-bold text-slate-900">Quality Checks</h3>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {(Object.keys(checkLabels) as Array<keyof QualityChecks>).map(
                  (key) => (
                    <label
                      key={key}
                      className="flex cursor-pointer items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-700 hover:bg-slate-100"
                    >
                      <input
                        type="checkbox"
                        disabled={busy}
                        className="h-4 w-4 accent-indigo-600"
                        checked={!!value.qualityChecks[key]}
                        onChange={(e) =>
                          update("qualityChecks", {
                            ...value.qualityChecks,
                            [key]: e.target.checked,
                          })
                        }
                      />
                      {checkLabels[key]}
                    </label>
                  ),
                )}
              </div>
            </section>
          </div>
          <footer className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-100 px-5 py-4 sm:px-6">
            <button
              type="button"
              disabled={busy}
              onClick={onCancel}
              className="rounded-xl bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <Save size={17} />
              )}{" "}
              {busy
                ? "Saving..."
                : value.id
                  ? "Save Changes"
                  : "Create Template"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
