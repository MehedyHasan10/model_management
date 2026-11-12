"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Trash2, X } from "lucide-react";
import { suppliersApi, type Supplier } from "@/lib/suppliers";
import toast from "react-hot-toast";

type Props = {
  supplier: Supplier;
  onClose: () => void;
  onDeleted: () => void;
};

export default function SupplierDeleteDialog({
  supplier,
  onClose,
  onDeleted,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) {
        onClose();
      }
    };

    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [busy, onClose]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  async function remove() {
    if (busy) return;

    setBusy(true);

    try {
      await suppliersApi.remove(supplier.id);
      toast.success("Supplier deleted");
      onDeleted();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) {
          onClose();
        }
      }}
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-label="Delete supplier"
        className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between">
          <div className="rounded-xl bg-red-50 p-3 text-red-600">
            <Trash2 size={23} />
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        <h2 className="mt-5 text-xl font-bold text-slate-900">
          Delete Supplier?
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-600">
          Permanently delete{" "}
          <strong className="text-slate-900">{supplier.name}</strong>? This
          action cannot be undone.
        </p>

        <div className="mt-7 flex justify-end gap-3 border-t border-slate-100 pt-5">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-xl bg-slate-100 px-5 py-2.5 font-semibold text-slate-700 disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={remove}
            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {busy ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Trash2 size={16} />
            )}

            {busy ? "Deleting..." : "Delete Supplier"}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
