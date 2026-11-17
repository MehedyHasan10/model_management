"use client";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { useEscapeKey } from "@/lib/useEscapeKey";

type Option = { id: string; name: string };
export default function SearchableDropdown({
  label,
  value,
  options,
  onChange,
  placeholder = "Select...",
  disabled = false,
  required = false,
}: {
  label: string;
  value?: string | null;
  options: Option[];
  onChange: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEscapeKey(() => setOpen(false), open);
  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const selected = options.find((o) => o.id === value);
  const filtered = options.filter((o) =>
    o.name.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div ref={ref} className="relative min-w-0">
      <label className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        onClick={() => {
          setQuery("");
          setOpen((v) => !v);
        }}
        className="flex h-11 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 text-left text-sm text-slate-700 disabled:bg-slate-100"
      >
        <span className="truncate">{selected?.name || placeholder}</span>
        <ChevronDown size={16} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-[100] mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Search size={16} className="text-slate-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${label.toLowerCase()}...`}
              className="w-full border-0 bg-transparent text-sm outline-none"
            />
          </div>
          <div className="max-h-56 overflow-y-auto p-1">
            {filtered.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => {
                  onChange(o.id);
                  setOpen(false);
                  setQuery("");
                }}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-violet-50"
              >
                {o.name}
                {o.id === value && (
                  <Check size={15} className="text-violet-600" />
                )}
              </button>
            ))}
            {!filtered.length && (
              <p className="px-3 py-3 text-sm text-slate-500">
                No matching options
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
