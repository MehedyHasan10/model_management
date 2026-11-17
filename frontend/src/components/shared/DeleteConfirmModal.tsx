"use client";
import { AlertTriangle, X, Trash2 } from "lucide-react";
import { useEscapeKey } from "@/lib/useEscapeKey";
export default function DeleteConfirmModal({
  name,
  title = "Delete record?",
  message = "This action cannot be undone. Records linked to existing data may be protected by the server.",
  busy,
  onCancel,
  onConfirm,
}: {
  name: string;
  title?: string;
  message?: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEscapeKey(() => {
    if (!busy) onCancel();
  });
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
      role="presentation"
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
        role="alertdialog"
        aria-modal="true"
        aria-label="Confirm deletion"
      >
        <div className="mb-5 flex items-center justify-between gap-3 [&_h2]:text-xl [&_h2]:font-bold [&_button]:rounded-lg [&_button]:p-2 [&_button:hover]:bg-slate-100">
          <h2>{title}</h2>
          <button aria-label="Close" onClick={onCancel}>
            <X />
          </button>
        </div>
        <div
          style={{
            padding: "20px 0",
            display: "flex",
            gap: 14,
            alignItems: "flex-start",
          }}
        >
          <AlertTriangle color="#dc2626" />
          <div>
            <strong>{name}</strong>
            <p>{message}</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5">
          <button
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-50 px-4 py-2.5 font-semibold text-violet-700 hover:bg-violet-100"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            disabled={busy}
            onClick={onConfirm}
          >
            <Trash2 size={16} />
            {busy ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
