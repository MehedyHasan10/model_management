"use client";
import type { ReactNode } from "react";
export function TextField({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: any;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
      {label}
      <input
        className="w-full rounded-xl border border-slate-200 bg-white p-3 outline-none focus:border-violet-500"
        type={type}
        required={required}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
export function SelectField({
  label,
  value,
  options,
  onChange,
  empty = "Select...",
}: {
  label: string;
  value: string;
  options: any[];
  onChange: (v: string) => void;
  empty?: string;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
      {label}
      <select
        className="w-full rounded-xl border border-slate-200 bg-white p-3"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{empty}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}
export function CheckList({
  title,
  options,
  selected,
  onChange,
  single = false,
}: {
  title: string;
  options: { id: string; name: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
  /** Radio buttons: exactly one option can be selected. */
  single?: boolean;
}) {
  return (
    <div className="col-span-full">
      <h3>{title}</h3>
      <div className="flex flex-wrap gap-3 [&_label]:flex [&_label]:flex-row [&_label]:items-center [&_label]:gap-2 [&_label]:rounded-xl [&_label]:bg-slate-50 [&_label]:p-3">
        {options.map((o) => (
          <label key={o.id}>
            <input
              type={single ? "radio" : "checkbox"}
              name={single ? title : undefined}
              checked={selected.includes(o.id)}
              onChange={(e) =>
                onChange(
                  single
                    ? [o.id]
                    : e.target.checked
                      ? [...selected, o.id]
                      : selected.filter((x) => x !== o.id),
                )
              }
            />
            {o.name}
          </label>
        ))}
      </div>
    </div>
  );
}
export function FieldSection({ children }: { children: ReactNode }) {
  return <div className="col-span-full">{children}</div>;
}
