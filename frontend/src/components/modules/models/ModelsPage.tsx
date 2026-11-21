"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { createPortal } from "react-dom";

import toast from "react-hot-toast";

import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  History,
  ImagePlus,
  Package,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserRound,
  UsersRound,
  SearchCheck,
  X,
} from "lucide-react";

import { useAccount } from "@/components/Shell";
import ImageUpload from "@/components/shared/ImageUpload";

import { api, saveEntity, deleteEntity } from "@/lib/client-api";
import { EscapeKey } from "@/lib/useEscapeKey";

type Model = {
  id: string;

  code?: string;

  name: string;

  phone?: string | null;

  notes?: string | null;

  photoUrl?: string | null;

  active: boolean;

  createdAt?: string;
};

type ReturnItem = {
  quantity: number;
  dontWearQty?: number | null;
  createdAt?: string;
  return?: {
    createdAt?: string;
    receivedDate?: string;
    date?: string;
  };
};

type AssignmentItem = {
  id: string;

  size?: string;

  sentQty: number;

  product?: {
    sn?: string;
    supplierCode?: string | null;

    code?: string | null;

    itemName?: string;

    images?: Array<{ url: string; order?: number } | string>;
  };

  returnItems?: ReturnItem[];
};

type Assignment = {
  id: string;

  number?: string;

  modelId?: string;

  model?: { id?: string };

  sentDate?: string;

  expectedReturnDate?: string;

  status?: string;

  items?: AssignmentItem[];
};

type Draft = {
  id?: string;

  name: string;

  phone: string;

  notes: string;

  photoUrl: string;

  active: boolean;
};

const emptyDraft = (): Draft => ({
  name: "",

  phone: "",

  notes: "",

  photoUrl: "",

  active: true,
});

const dateText = (s?: string) => (s ? new Date(s).toLocaleDateString() : "-");

function Portal({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  return ready ? createPortal(children, document.body) : null;
}

function LazyPhoto({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className: string;
}) {
  const [state, setState] = useState({ src, loaded: false, failed: false });
  // Reset during render when src changes. A post-mount effect would wipe out
  // an onLoad that already fired for a cached image and spin forever.
  if (state.src !== src) setState({ src, loaded: false, failed: false });
  const loaded = state.src === src && state.loaded;
  const failed = state.src === src && state.failed;
  const setLoaded = () => setState({ src, loaded: true, failed: false });
  const setFailed = () => setState({ src, loaded: false, failed: true });
  // Catch images that finished loading before React attached onLoad.
  const checkComplete = (img: HTMLImageElement | null) => {
    if (!img?.complete || loaded || failed) return;
    if (img.naturalWidth > 0) setLoaded();
    else setFailed();
  };
  return (
    <span className="relative inline-flex shrink-0 overflow-hidden rounded-lg bg-slate-100">
      {!loaded && !failed && (
        <span className="absolute inset-0 z-10 flex items-center justify-center bg-slate-100">
          <Loader2 size={16} className="animate-spin text-violet-500" />
        </span>
      )}
      {failed ? (
        <span className="flex h-12 w-12 items-center justify-center text-slate-400">
          <ImagePlus size={18} />
        </span>
      ) : (
        <img
          ref={checkComplete}
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={setLoaded}
          onError={setFailed}
          className={className}
        />
      )}
    </span>
  );
}

type HistoryRow = {
  id: string;
  product: NonNullable<AssignmentItem["product"]>;
  size: string;
  sentDate: string;
  status: string;
  sent: number;
  returned: number;
  onHand: number;
  dontWear: number;
  image: string | null;
};

function ModelHistory({
  assignments,
  onPreview,
}: {
  assignments: Assignment[];
  onPreview: (image: { url: string; name: string }) => void;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLimit, setHistoryLimit] = useState(10);

  const rows = useMemo<HistoryRow[]>(
    () =>
      assignments.flatMap((assignment) =>
        (assignment.items || []).map((item) => {
          const product = item.product || {};
          const images = (product.images || [])
            .map((img) =>
              typeof img === "string" ? { url: img, order: 0 } : img,
            )
            .filter((img) => Boolean(img?.url))
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
          const sent = Number(item.sentQty || 0);
          const returned = (item.returnItems || []).reduce(
            (sum, ret) => sum + Number(ret.quantity || 0),
            0,
          );
          const dontWear = (item.returnItems || []).reduce(
            (sum, ret) => sum + Number(ret.dontWearQty || 0),
            0,
          );
          return {
            id: `${assignment.id}-${item.id}`,
            product,
            size: item.size || "-",
            sentDate: assignment.sentDate || "",
            status: String(assignment.status || "DRAFT").toUpperCase(),
            sent,
            returned,
            onHand: Math.max(0, sent - returned),
            dontWear,
            image: images[0]?.url || null,
          };
        }),
      ),
    [assignments],
  );

  const filteredRows = useMemo(() => {
    const term = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (
        term &&
        ![
          row.product.sn,
          row.product.supplierCode,
          row.product.itemName,
          row.size,
        ]
          .join(" ")
          .toLowerCase()
          .includes(term)
      )
        return false;
      if (statusFilter && row.status !== statusFilter) return false;
      const day = row.sentDate.slice(0, 10);
      if (fromDate && (!day || day < fromDate)) return false;
      if (toDate && (!day || day > toDate)) return false;
      return true;
    });
  }, [rows, query, statusFilter, fromDate, toDate]);

  const historyTotalPages = Math.max(
    1,
    Math.ceil(filteredRows.length / historyLimit),
  );
  const historyCurrentPage = Math.min(historyPage, historyTotalPages);
  const paginatedHistory = filteredRows.slice(
    (historyCurrentPage - 1) * historyLimit,
    historyCurrentPage * historyLimit,
  );

  const totals = useMemo(
    () =>
      filteredRows.reduce(
        (acc, row) => ({
          sent: acc.sent + row.sent,
          returned: acc.returned + row.returned,
          onHand: acc.onHand + row.onHand,
          dontWear: acc.dontWear + row.dontWear,
        }),
        { sent: 0, returned: 0, onHand: 0, dontWear: 0 },
      ),
    [filteredRows],
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Sent", value: totals.sent, color: "text-blue-700" },
          {
            label: "Total Returned",
            value: totals.returned,
            color: "text-emerald-700",
          },
          { label: "On Hand", value: totals.onHand, color: "text-amber-700" },
          {
            label: "WSR",
            value: totals.dontWear,
            color: "text-violet-700",
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <p className="text-xs font-semibold text-slate-500">{card.label}</p>
            <p className={`mt-1 text-2xl font-bold tabular-nums ${card.color}`}>
              {card.value}
            </p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <label className="min-w-[180px] flex-[2] text-xs font-semibold text-slate-600">
          Search Product / Size
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHistoryPage(1);
            }}
            placeholder="Product code, supplier code, name, size..."
            className="mt-1 block h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-violet-400"
          />
        </label>
        <label className="min-w-[120px] flex-1 text-xs font-semibold text-slate-600">
          Status
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setHistoryPage(1);
            }}
            className="mt-1 block h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm font-normal"
          >
            <option value="">All Status</option>
            {["ISSUED", "PARTIAL", "COMPLETED"].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[135px] flex-1 text-xs font-semibold text-slate-600">
          From (Sent Date)
          <input
            type="date"
            value={fromDate}
            max={toDate || undefined}
            onChange={(e) => {
              setFromDate(e.target.value);
              setHistoryPage(1);
            }}
            className="mt-1 block h-10 w-full rounded-lg border border-slate-200 px-2 text-sm font-normal"
          />
        </label>
        <label className="min-w-[135px] flex-1 text-xs font-semibold text-slate-600">
          To (Sent Date)
          <input
            type="date"
            value={toDate}
            min={fromDate || undefined}
            onChange={(e) => {
              setToDate(e.target.value);
              setHistoryPage(1);
            }}
            className="mt-1 block h-10 w-full rounded-lg border border-slate-200 px-2 text-sm font-normal"
          />
        </label>
        <button
          type="button"
          onClick={() => {
            setQuery("");
            setStatusFilter("");
            setFromDate("");
            setToDate("");
            setHistoryPage(1);
          }}
          className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-medium hover:bg-slate-50"
        >
          Reset
        </button>
      </div>
      <p className="text-xs text-slate-500">
        {filteredRows.length} of {rows.length} history records
      </p>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[1120px] text-sm">
          <thead className="bg-slate-100 text-xs font-semibold text-slate-600">
            <tr>
              {[
                "Product Image",
                "Product Code",
                "Supplier Code",
                "Product / Size",
                "Sent Date",
                "Sent Qty",
                "Returned Qty",
                "On Hand",
                "WSR",
                "Status",
              ].map((heading, index) => (
                <th
                  key={heading}
                  className={`px-3 py-3 ${index >= 5 ? "text-center" : "text-left"}`}
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedHistory.map((row) => {
              const statusClass =
                row.status === "COMPLETED"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : row.status === "ISSUED"
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : row.status === "PARTIAL"
                      ? "border-blue-200 bg-blue-50 text-blue-700"
                      : row.status === "CANCELLED"
                        ? "border-red-200 bg-red-50 text-red-700"
                        : "border-slate-200 bg-slate-100 text-slate-600";
              return (
                <tr
                  key={row.id}
                  className="border-t border-slate-100 hover:bg-violet-50/30"
                >
                  <td className="px-3 py-2.5">
                    {row.image ? (
                      <button
                        type="button"
                        title="Preview product image"
                        onClick={() =>
                          onPreview({
                            url: row.image!,
                            name: row.product.itemName || "Product image",
                          })
                        }
                        className="rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400"
                      >
                        <LazyPhoto
                          src={row.image}
                          alt={row.product.itemName || "Product"}
                          className="h-11 w-11 rounded-lg border border-slate-200 object-cover"
                        />
                      </button>
                    ) : (
                      <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                        <Package size={19} />
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="rounded-lg bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">
                      {row.product.sn || "-"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-semibold text-slate-700">
                    {row.product.supplierCode || "-"}
                  </td>
                  <td className="px-3 py-2.5 text-slate-700">
                    {row.product.itemName || row.product.sn || "-"} / {row.size}
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">
                    {dateText(row.sentDate)}
                  </td>
                  <td className="px-3 py-2.5 text-center font-bold tabular-nums text-blue-600">
                    {row.sent}
                  </td>
                  <td className="px-3 py-2.5 text-center font-bold tabular-nums text-emerald-600">
                    {row.returned}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span
                      className={`inline-flex min-w-9 justify-center rounded-lg px-2 py-1 font-bold tabular-nums ${row.onHand > 0 ? "bg-orange-50 text-orange-600" : "bg-slate-100 text-slate-500"}`}
                    >
                      {row.onHand}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center font-bold tabular-nums text-violet-600">
                    {row.dontWear}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusClass}`}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              );
            })}
            {!filteredRows.length && (
              <tr>
                <td
                  colSpan={10}
                  className="px-4 py-10 text-center text-slate-500"
                >
                  No matching history records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
        <span className="text-slate-500">
          Showing{" "}
          {filteredRows.length
            ? (historyCurrentPage - 1) * historyLimit + 1
            : 0}
          -{Math.min(historyCurrentPage * historyLimit, filteredRows.length)} of{" "}
          {filteredRows.length}
        </span>
        <div className="flex items-center gap-2">
          <label
            htmlFor="model-history-limit"
            className="text-xs text-slate-500"
          >
            Rows
          </label>
          <select
            id="model-history-limit"
            value={historyLimit}
            onChange={(e) => {
              setHistoryLimit(Number(e.target.value));
              setHistoryPage(1);
            }}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
          <button
            type="button"
            aria-label="Previous history page"
            disabled={historyCurrentPage <= 1}
            onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
            className="rounded-lg border border-slate-200 p-2 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-14 text-center tabular-nums text-slate-700">
            {historyCurrentPage} / {historyTotalPages}
          </span>
          <button
            type="button"
            aria-label="Next history page"
            disabled={historyCurrentPage >= historyTotalPages}
            onClick={() =>
              setHistoryPage((p) => Math.min(historyTotalPages, p + 1))
            }
            className="rounded-lg border border-slate-200 p-2 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ModelsPage() {
  const account = useAccount();

  const can = (action: string) =>
    account.permissions.includes("*") ||
    account.permissions.includes(`models.${action}`);

  const [models, setModels] = useState<Model[]>([]);

  const [assignments, setAssignments] = useState<Assignment[]>([]);

  const [historyError, setHistoryError] = useState("");

  const [loading, setLoading] = useState(true);

  const [busy, setBusy] = useState(false);

  const [uploading, setUploading] = useState(false);

  const [draft, setDraft] = useState<Draft | null>(null);

  const [deleting, setDeleting] = useState<Model | null>(null);

  const [expanded, setExpanded] = useState<string | null>(null);

  const [previewImage, setPreviewImage] = useState<{
    url: string;

    name: string;
  } | null>(null);

  const [search, setSearch] = useState("");

  const [status, setStatus] = useState("all");

  const [page, setPage] = useState(1);

  const [limit, setLimit] = useState(10);

  const reload = useCallback(async () => {
    setLoading(true);

    try {
      const m = await api<Model[]>("models");

      setModels(Array.isArray(m) ? m : []);

      try {
        const a = await api<Assignment[]>("assignments");

        setAssignments(Array.isArray(a) ? a : []);

        setHistoryError("");
      } catch (e: unknown) {
        setHistoryError(
          e instanceof Error ? e.message : "Assign history unavailable",
        );

        setAssignments([]);
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Unable to load models");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const filtered = useMemo(
    () =>
      models.filter((m) => {
        const match = `${m.name} ${m.phone || ""} ${m.notes || ""}`

          .toLowerCase()

          .includes(search.trim().toLowerCase());

        return (
          match &&
          (status === "all" || (status === "active" ? m.active : !m.active))
        );
      }),

    [models, search, status],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / limit));

  const currentPage = Math.min(page, totalPages);

  const visible = filtered.slice(
    (currentPage - 1) * limit,

    currentPage * limit,
  );

  const save = async () => {
    if (!draft || busy || uploading) return;

    if (!draft.name.trim()) {
      toast.error("Model name is required");

      return;
    }

    setBusy(true);

    try {
      await saveEntity("models", {
        ...draft,
        name: draft.name.trim(),
        photoUrl: draft.photoUrl || null,
      });

      toast.success(draft.id ? "Model updated" : "Model created");

      setDraft(null);

      await reload();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Unable to save model");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!deleting || busy) return;

    setBusy(true);

    try {
      await deleteEntity("models", deleting.id);

      toast.success("Model deleted");

      setDeleting(null);

      await reload();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Unable to delete model");
    } finally {
      setBusy(false);
    }
  };

  const modelAssignments = (id: string) =>
    assignments.filter((a) => a.modelId === id || a.model?.id === id);

  return (
    <div className="space-y-6 pb-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[.2em] text-violet-600">
            Model Operations
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            Model Management
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Manage model profiles, assign and returns
          </p>
        </div>

        {can("create") && (
          <button
            onClick={() => setDraft(emptyDraft())}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 font-semibold text-white hover:bg-violet-700"
          >
            <Plus size={18} /> Create Model
          </button>
        )}
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <p className="text-sm text-slate-500">Total Models</p>

            <p className="mt-2 text-3xl font-bold text-slate-900">
              {models.length}
            </p>
          </div>

          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100">
            <UsersRound
              size={24}
              className="text-violet-600"
              aria-hidden="true"
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <p className="text-sm text-slate-500">Matching Search</p>

            <p className="mt-2 text-3xl font-bold text-violet-700">
              {filtered.length}
            </p>
          </div>

          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
            <SearchCheck
              size={24}
              className="text-blue-600"
              aria-hidden="true"
            />
          </div>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-4 overflow-x-auto border-b border-slate-100 p-5">
          <div className="min-w-max shrink-0">
            <h2 className="font-bold text-slate-900">Model Directory</h2>
          </div>

          <div className="ml-auto flex min-w-max items-center gap-2">
            <label className="flex w-60 items-center gap-2 rounded-xl border border-slate-200 px-3">
              <Search size={17} className="text-slate-400" />

              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);

                  setPage(1);
                }}
                placeholder="Search name, phone..."
                className="w-full bg-transparent py-2.5 text-sm outline-none"
              />
            </label>

            <select
              aria-label="Filter status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);

                setPage(1);
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
            >
              <option value="all">All Status</option>

              <option value="active">Active</option>

              <option value="inactive">Inactive</option>
            </select>

            <button
              title="Refresh"
              onClick={() => void reload()}
              className="rounded-xl border border-slate-200 p-2.5"
            >
              <RefreshCw size={17} />
            </button>

            <button
              onClick={() => {
                setSearch("");

                setStatus("all");

                setPage(1);
              }}
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                {[
                  "Photo",

                  "Name",

                  "Phone",

                  "Status",

                  "On Hand",

                  "History",

                  "Actions",
                ].map((h) => (
                  <th key={h} className="px-4 py-4 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            {visible.map((m) => {
              const opened = expanded === m.id;

              const history = modelAssignments(m.id);

              const onHand = history.reduce(
                (total, assignment) =>
                  total +
                  (assignment.items || []).reduce(
                    (sum, item) =>
                      sum +
                      Math.max(
                        0,

                        Number(item.sentQty || 0) -
                          (item.returnItems || []).reduce(
                            (n, r) => n + Number(r.quantity || 0),

                            0,
                          ),
                      ),

                    0,
                  ),

                0,
              );

              return (
                <tbody key={m.id}>
                  <tr
                    key={m.id}
                    className="border-t border-slate-100 hover:bg-violet-50/30"
                  >
                    <td className="px-4 py-3">
                      {m.photoUrl ? (
                        <button
                          type="button"
                          title="Preview model photo"
                          aria-label={`Preview ${m.name} photo`}
                          onClick={() =>
                            setPreviewImage({ url: m.photoUrl!, name: m.name })
                          }
                          className="rounded-xl transition hover:ring-2 hover:ring-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-400"
                        >
                          <LazyPhoto
                            src={m.photoUrl}
                            alt={m.name}
                            className="h-12 w-12 rounded-xl border object-cover"
                          />
                        </button>
                      ) : (
                        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                          <UserRound size={21} />
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 font-semibold">{m.name}</td>

                    <td className="px-4 py-3">{m.phone || "-"}</td>

                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${m.active ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}
                      >
                        {m.active ? "Active" : "Inactive"}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      {historyError ? (
                        <span
                          className="text-xs text-amber-700"
                          title={historyError}
                        >
                          Unavailable
                        </span>
                      ) : (
                        <span
                          className={`inline-flex min-w-10 justify-center rounded-lg px-3 py-1.5 text-sm font-bold ${onHand > 0 ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}
                        >
                          {onHand}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <button
                        aria-expanded={opened}
                        onClick={() => setExpanded(opened ? null : m.id)}
                        className="inline-flex items-center gap-2 rounded-lg border border-violet-200 px-3 py-2 text-violet-700 hover:bg-violet-50"
                      >
                        <History size={16} /> History{" "}
                        {opened ? (
                          <ChevronUp size={15} />
                        ) : (
                          <ChevronDown size={15} />
                        )}
                      </button>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {can("edit") && (
                          <button
                            title="Edit"
                            onClick={() =>
                              setDraft({
                                id: m.id,

                                name: m.name,

                                phone: m.phone || "",

                                notes: m.notes || "",

                                photoUrl: m.photoUrl || "",

                                active: m.active,
                              })
                            }
                            className="rounded-lg border border-violet-200 p-2 text-violet-600"
                          >
                            <Pencil size={17} />
                          </button>
                        )}

                        {can("delete") && (
                          <button
                            title="Delete"
                            onClick={() => setDeleting(m)}
                            className="rounded-lg border border-red-200 p-2 text-red-500"
                          >
                            <Trash2 size={17} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {opened && (
                    <tr key={`${m.id}-history`} className="bg-slate-50/80">
                      <td colSpan={7} className="p-5">
                        <h3 className="mb-3 font-bold text-slate-800">
                          Assign & Return History - {m.name}
                        </h3>
                        {historyError ? (
                          <p className="text-sm text-amber-700">
                            History could not be loaded: {historyError}
                          </p>
                        ) : (
                          <ModelHistory
                            assignments={history}
                            onPreview={setPreviewImage}
                          />
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              );
            })}
          </table>
        </div>

        {!loading && !visible.length && (
          <p className="p-10 text-center text-slate-500">
            No matching models found
          </p>
        )}

        {loading && (
          <p className="flex items-center justify-center gap-2 p-10 text-slate-500">
            <Loader2 className="animate-spin" /> Loading...
          </p>
        )}

        <footer className="flex flex-wrap items-center justify-end gap-3 border-t p-4 text-sm text-slate-500">
          <span>
            Showing {filtered.length ? (currentPage - 1) * limit + 1 : 0}-
            {Math.min(currentPage * limit, filtered.length)} of{" "}
            {filtered.length}
          </span>

          <div className="flex items-center gap-3">
            <select
              aria-label="Rows per page"
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));

                setPage(1);
              }}
              className="rounded-lg border px-2 py-1"
            >
              <option value={10}>10</option>

              <option value={20}>20</option>

              <option value={50}>50</option>
            </select>

            <button
              disabled={currentPage === 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border p-2 disabled:opacity-30"
            >
              <ChevronLeft size={16} />
            </button>

            <span>
              {currentPage} / {totalPages}
            </span>

            <button
              disabled={currentPage === totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border p-2 disabled:opacity-30"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </footer>
      </section>

      {previewImage && (
        <Portal>
          <EscapeKey onEscape={() => setPreviewImage(null)} />
          <div
            className="fixed inset-0 z-[200000] flex items-center justify-center bg-slate-950/90 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Image preview"
            onClick={() => setPreviewImage(null)}
          >
            <button
              type="button"
              aria-label="Close image preview"
              onClick={() => setPreviewImage(null)}
              className="absolute right-5 top-5 rounded-full bg-white/15 p-3 text-white hover:bg-white/25"
            >
              <X size={23} />
            </button>

            <img
              src={previewImage.url}
              alt={previewImage.name}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[82vh] max-w-[85vw] rounded-xl object-contain"
            />

            <div className="absolute bottom-5 text-center text-sm text-white">
              {previewImage.name}
            </div>
          </div>
        </Portal>
      )}

      {draft && (
        <Portal>
          <EscapeKey onEscape={() => !busy && setDraft(null)} />
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4">
            <div
              role="dialog"
              aria-modal="true"
              aria-label={draft.id ? "Edit Model" : "Create Model"}
              className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            >
              <header className="flex items-center justify-between border-b p-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-violet-600">
                    Model Management
                  </p>

                  <h2 className="text-xl font-bold">
                    {draft.id ? "Edit Model" : "Create Model"}
                  </h2>
                </div>

                <button disabled={busy} onClick={() => setDraft(null)}>
                  <X />
                </button>
              </header>

              <form
                onSubmit={(e) => {
                  e.preventDefault();

                  void save();
                }}
                className="flex min-h-0 flex-1 flex-col"
              >
                <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-6 sm:grid-cols-2">
                  <label className="text-sm font-semibold">
                    Model Name *
                    <input
                      required
                      value={draft.name}
                      onChange={(e) =>
                        setDraft((d) => d && { ...d, name: e.target.value })
                      }
                      className="mt-2 w-full rounded-xl border p-3 font-normal"
                    />
                  </label>

                  <label className="text-sm font-semibold">
                    Phone
                    <input
                      value={draft.phone}
                      onChange={(e) =>
                        setDraft((d) => d && { ...d, phone: e.target.value })
                      }
                      className="mt-2 w-full rounded-xl border p-3 font-normal"
                    />
                  </label>

                  <label className="sm:col-span-2 text-sm font-semibold">
                    Notes
                    <textarea
                      rows={3}
                      value={draft.notes}
                      onChange={(e) =>
                        setDraft((d) => d && { ...d, notes: e.target.value })
                      }
                      className="mt-2 w-full rounded-xl border p-3 font-normal"
                    />
                  </label>

                  <div className="sm:col-span-2">
                    <p className="mb-2 text-sm font-semibold">Model Photo</p>

                    <ImageUpload
                      value={draft.photoUrl ? [draft.photoUrl] : []}
                      onChange={(urls) =>
                        setDraft((d) => d && { ...d, photoUrl: urls[0] ?? "" })
                      }
                      max={1}
                      hint="JPG, PNG or WebP up to 5 MB. Saved as WebP (about 50-70 KB)."
                      disabled={busy}
                      onBusyChange={setUploading}
                    />
                  </div>

                  <label className="flex items-center gap-2 text-sm font-semibold">
                    <input
                      type="checkbox"
                      checked={draft.active}
                      onChange={(e) =>
                        setDraft((d) => d && { ...d, active: e.target.checked })
                      }
                    />{" "}
                    Active
                  </label>
                </div>

                <footer className="flex justify-end gap-3 border-t p-4">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setDraft(null)}
                    className="rounded-xl border px-5 py-2.5"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={busy || uploading}
                    className="rounded-xl bg-violet-600 px-5 py-2.5 font-semibold text-white disabled:opacity-50"
                  >
                    {busy
                      ? "Saving..."
                      : draft.id
                        ? "Update Model"
                        : "Save Model"}
                  </button>
                </footer>
              </form>
            </div>
          </div>
        </Portal>
      )}

      {deleting && (
        <Portal>
          <EscapeKey onEscape={() => !busy && setDeleting(null)} />
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/60 p-4">
            <div
              role="alertdialog"
              aria-modal="true"
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            >
              <h2 className="text-xl font-bold">Delete Model?</h2>

              <p className="mt-3 text-sm text-slate-600">
                Delete {deleting.name}? This cannot be undone. Linked
                assign records may prevent deletion.
              </p>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  disabled={busy}
                  onClick={() => setDeleting(null)}
                  className="rounded-xl border px-4 py-2"
                >
                  Cancel
                </button>

                <button
                  disabled={busy}
                  onClick={() => void remove()}
                  className="rounded-xl bg-red-600 px-4 py-2 font-semibold text-white"
                >
                  {busy ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
