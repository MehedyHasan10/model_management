"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Truck } from "lucide-react";
import type { Supplier } from "@/lib/suppliers";

type Props = {
  supplier: Supplier;
  onClose: () => void;
};

export default function SupplierDetails({ supplier, onClose }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const rows: [string, string][] = [
    ["Name", supplier.name],
    ["Contact Person", supplier.contactPerson || "—"],
    ["Phone", supplier.phone || "—"],
    ["Email", supplier.email || "—"],
    ["Address", supplier.address || "—"],
    ["Notes", supplier.notes || "—"],
    [
      "Created",
      supplier.createdAt ? new Date(supplier.createdAt).toLocaleString() : "—",
    ],
  ];

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Supplier details"
        className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-3 inline-flex rounded-xl bg-violet-100 p-2.5 text-violet-700">
              <Truck size={20} />
            </div>

            <h2 className="text-xl font-bold text-slate-900">
              Supplier Details
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Supplier information and current status.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          >
            <X size={20} />
          </button>
        </div>

        <dl className="mt-5 divide-y divide-slate-100 border-t border-slate-100">
          {rows.map(([label, value]) => (
            <div key={label} className="grid grid-cols-3 gap-3 py-3 text-sm">
              <dt className="text-slate-500">{label}</dt>

              <dd className="col-span-2 break-words font-medium text-slate-800">
                {value}
              </dd>
            </div>
          ))}

          <div className="grid grid-cols-3 gap-3 py-3 text-sm">
            <dt className="text-slate-500">Status</dt>

            <dd className="col-span-2">
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  supplier.status === "ACTIVE"
                    ? "bg-green-50 text-green-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                {supplier.status === "ACTIVE" ? "Active" : "Inactive"}
              </span>
            </dd>
          </div>
        </dl>

        <div className="mt-5 flex justify-end border-t border-slate-100 pt-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-violet-700 px-5 py-2.5 font-semibold text-white hover:bg-violet-800"
          >
            Close
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
