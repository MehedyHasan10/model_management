"use client";
import { lazy, Suspense, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useAccount } from "@/components/Shell";
import { api } from "@/lib/client-api";
import { useEscapeKey } from "@/lib/useEscapeKey";
import { EMPTY } from "@/lib/format";

// Same preview the Products page opens from its eye icon.
const ProductPreviewModal = lazy(
  () => import("@/components/modules/products/ProductPreviewModal"),
);

type ContentState = {
  contentDone: boolean;
  contentDoneAt: string | null;
  contentDoneBy: { id: string; name: string } | null;
};

const productCodes = (row: any): string =>
  Array.from(
    new Set(
      (row.items || [])
        .map((item: any) => item.product?.sn)
        .filter(Boolean) as string[],
    ),
  ).join(", ") || EMPTY;

function ConfirmCard({
  title,
  text,
  confirmLabel,
  busy,
  onCancel,
  onConfirm,
}: {
  title: string;
  text: string;
  confirmLabel: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEscapeKey(() => {
    if (!busy) onCancel();
  });
  return createPortal(
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center bg-slate-950/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-sm rounded-2xl bg-white p-6 text-left shadow-2xl"
      >
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        <p className="mt-2 text-sm text-slate-600">{text}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200"
          >
            Cancel
          </button>
          <button
            type="button"
            autoFocus
            disabled={busy}
            onClick={onConfirm}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {busy && <Loader2 size={15} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** CONTENT column: a checkbox until marked, then a green tick. */
export function ContentCell({ row }: { row: any }) {
  const account = useAccount();
  const canMark =
    account.permissions.includes("*") ||
    account.permissions.includes("assignments.edit");
  const isAdmin = account.roles.some((role) =>
    ["super admin", "admin"].includes(role.trim().toLowerCase()),
  );
  const fromRow = (): ContentState => ({
    contentDone: Boolean(row.contentDone),
    contentDoneAt: row.contentDoneAt ?? null,
    contentDoneBy: row.contentDoneBy ?? null,
  });
  const [state, setState] = useState<ContentState>(fromRow);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setState(fromRow());
  }, [row.id, row.contentDone, row.contentDoneAt]);

  const context = `${productCodes(row)} · ${row.model?.name || EMPTY}`;

  async function save(done: boolean) {
    setBusy(true);
    try {
      const result = await api<ContentState>(
        `assignments/${encodeURIComponent(row.id)}/content`,
        { method: "PATCH", body: JSON.stringify({ done }) },
      );
      setState({
        contentDone: result.contentDone,
        contentDoneAt: result.contentDoneAt,
        contentDoneBy: result.contentDoneBy,
      });
      // Keep the row object in sync so a re-render of the table keeps it.
      Object.assign(row, result);
      toast.success(done ? "Content marked as done" : "Content done undone");
      setConfirming(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to update content",
      );
    } finally {
      setBusy(false);
    }
  }

  const tooltip = state.contentDone
    ? [
        "Content done",
        state.contentDoneBy?.name,
        state.contentDoneAt
          ? new Date(state.contentDoneAt).toLocaleDateString()
          : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <>
      {state.contentDone ? (
        isAdmin ? (
          <button
            type="button"
            title={tooltip}
            aria-label={`${tooltip}. Undo`}
            onClick={() => setConfirming(true)}
            className="inline-flex rounded-full p-0.5 text-emerald-600 hover:bg-emerald-50"
          >
            <CheckCircle2 size={22} />
          </button>
        ) : (
          <span
            title={tooltip}
            aria-label={tooltip}
            className="inline-flex p-0.5 text-emerald-600"
          >
            <CheckCircle2 size={22} />
          </span>
        )
      ) : (
        <input
          type="checkbox"
          checked={false}
          disabled={!canMark}
          title={canMark ? "Mark content as done" : "Content not done yet"}
          aria-label="Mark content as done"
          onChange={() => setConfirming(true)}
          className="h-4 w-4 cursor-pointer accent-violet-600 disabled:cursor-not-allowed"
        />
      )}
      {confirming && (
        <ConfirmCard
          title={state.contentDone ? "Undo content done?" : "Mark content as done?"}
          text={context}
          confirmLabel={state.contentDone ? "Yes, undo" : "Yes, mark done"}
          busy={busy}
          onCancel={() => setConfirming(false)}
          onConfirm={() => void save(!state.contentDone)}
        />
      )}
    </>
  );
}

const loadingOverlay = (
  <div className="fixed inset-0 z-[10050] flex items-center justify-center bg-slate-950/50">
    <Loader2 className="animate-spin text-white" size={32} />
  </div>
);

/** Spinner shown while a dialog fetches its full record. */
export function LoadingOverlay() {
  return loadingOverlay;
}

/**
 * Directory rows are light (no images/measurements). Dialogs call this to
 * load the full assignment; it returns null until loaded and closes on error.
 */
export function useFullAssignment(assignment: any, onClose: () => void) {
  const [full, setFull] = useState<any | null>(
    assignment?.items?.some((i: any) => i.product?.measurements)
      ? assignment
      : null,
  );
  const id = assignment?.id;
  useEffect(() => {
    if (!id || full?.id === id) return;
    let cancelled = false;
    api<any>(`assignments/${id}`)
      .then((row) => {
        if (!cancelled) setFull(row);
      })
      .catch((error) => {
        if (cancelled) return;
        toast.error(error?.message || "Failed to load assignment");
        onClose();
      });
    return () => {
      cancelled = true;
    };
  }, [id]);
  return full?.id === id ? full : null;
}

/** PRODUCT CODE pill that opens the shared Product Preview modal. */
export function ProductCodeButton({ product }: { product: any }) {
  const [open, setOpen] = useState(false);
  const [full, setFull] = useState<any | null>(
    product?.measurements ? product : null,
  );
  // List rows carry only codes; fetch images/measurements on first open.
  useEffect(() => {
    if (!open || full || !product?.id) return;
    let cancelled = false;
    api<{ items?: any[] }>(
      `products?ids=${encodeURIComponent(product.id)}&page=1&limit=1`,
    )
      .then((result) => {
        if (!cancelled) setFull(result.items?.[0] ?? product);
      })
      .catch((error) => {
        if (cancelled) return;
        toast.error(error?.message || "Failed to load product");
        setOpen(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, full, product]);
  return (
    <>
      <button
        type="button"
        title="Preview product"
        onClick={() => setOpen(true)}
        className="cursor-pointer rounded-md bg-violet-50 px-2 py-1 text-xs font-semibold text-violet-700 transition hover:bg-violet-600 hover:text-white focus-visible:outline-2 focus-visible:outline-violet-600"
      >
        {product.sn || EMPTY}
      </button>
      {open &&
        createPortal(
          !full ? (
            loadingOverlay
          ) : (
            <Suspense fallback={loadingOverlay}>
              {/* Above the assignment details dialog (z-10000) when opened from there. */}
              <div className="relative z-[10040]">
                <ProductPreviewModal
                  product={full}
                  onClose={() => setOpen(false)}
                />
              </div>
            </Suspense>
          ),
          document.body,
        )}
    </>
  );
}
