"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import toast from "react-hot-toast";

import { Search, RefreshCw, Package, RotateCcw } from "lucide-react";

import { api } from "@/lib/client-api";

import Pagination from "@/components/shared/Pagination";

type ProductImage = { url: string; order?: number };

type StockRow = {
  id: string;

  modelId: string;

  model: string;

  sn: string;

  supplierCode: string;

  productName: string;

  image: string | null;

  size: string;

  sent: number;

  returned: number;

  onHand: number;
  dontWear: number;

  sentDate: string | null;

  due: string | null;
};

type Assignment = {
  id: string;

  modelId?: string;

  model?: { id?: string; name?: string };

  sentDate?: string | null;

  expectedReturnDate?: string | null;

  items?: Array<{
    id: string;

    size?: string;

    sentQty?: number;

    product?: {
      sn?: string;

      supplierCode?: string;

      itemName?: string;

      images?: Array<ProductImage | string>;
    };

    returnItems?: Array<{ quantity?: number; dontWearQty?: number }>;
  }>;
};

function dateKey(value: string | null | undefined): string {
  if (!value) return "";

  // ISO date from PostgreSQL; preserve the date portion without timezone shifts.

  const match = value.match(/^\d{4}-\d{2}-\d{2}/);

  if (match) return match[0];

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDate(value: string | null): string {
  const key = dateKey(value);

  if (!key) return "—";

  const [year, month, day] = key.split("-");

  return `${day}/${month}/${year}`;
}

export default function StockPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  const [search, setSearch] = useState("");

  const [modelFilter, setModelFilter] = useState("");

  const [fromDate, setFromDate] = useState("");

  const [toDate, setToDate] = useState("");

  const [page, setPage] = useState(1);

  const [limit, setLimit] = useState(10);

  const [loading, setLoading] = useState(true);

  const loadAssignments = useCallback(async () => {
    setLoading(true);

    try {
      const result = await api<any>("assignments");

      const records = Array.isArray(result)
        ? result
        : Array.isArray(result?.items)
          ? result.items
          : Array.isArray(result?.data)
            ? result.data
            : [];

      setAssignments(records);
    } catch (error: any) {
      toast.error(error?.message || "Failed to load stock");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAssignments();
  }, [loadAssignments]);

  const models = useMemo(() => {
    const unique = new Map<string, string>();

    assignments.forEach((assignment) => {
      const id =
        assignment.modelId ||
        assignment.model?.id ||
        assignment.model?.name ||
        "";

      if (id) unique.set(id, assignment.model?.name || "Unknown model");
    });

    return Array.from(unique, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [assignments]);

  const rows = useMemo<StockRow[]>(() => {
    return assignments.flatMap((assignment) =>
      (assignment.items || []).map((item) => {
        const product = item.product || {};

        const images: ProductImage[] = Array.isArray(product.images)
          ? product.images

              .map((img) => (typeof img === "string" ? { url: img } : img))

              .filter((img): img is ProductImage => Boolean(img?.url))
          : [];

        images.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

        const sent = Number(item.sentQty || 0);

        const dontWear = (item.returnItems || []).reduce(
          (sum, ret) => sum + Number(ret.dontWearQty || 0),
          0,
        );
        const returned = (item.returnItems || []).reduce(
          (sum, ret) => sum + Number(ret.quantity || 0),

          0,
        );

        return {
          id: item.id,

          modelId:
            assignment.modelId ||
            assignment.model?.id ||
            assignment.model?.name ||
            "",

          model: assignment.model?.name || "—",

          sn: product.sn || "—",

          supplierCode: product.supplierCode || "—",

          productName: product.itemName || "—",

          image: images[0]?.url || null,

          size: item.size || "—",

          sent,

          returned,

          onHand: sent - returned,
          dontWear,

          sentDate: assignment.sentDate || null,

          due: assignment.expectedReturnDate || null,
        };
      }),
    );
  }, [assignments]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return rows.filter((row) => {
      if (
        query &&
        ![row.model, row.sn, row.supplierCode, row.productName, row.size]

          .join(" ")

          .toLowerCase()

          .includes(query)
      )
        return false;

      if (modelFilter && row.modelId !== modelFilter) return false;

      const sent = dateKey(row.sentDate);

      if (fromDate && (!sent || sent < fromDate)) return false;

      if (toDate && (!sent || sent > toDate)) return false;

      return true;
    });
  }, [rows, search, modelFilter, fromDate, toDate]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / limit));

  const currentPage = Math.min(page, totalPages);

  const paginated = filtered.slice(
    (currentPage - 1) * limit,

    currentPage * limit,
  );

  const hasFilters = Boolean(search || modelFilter || fromDate || toDate);

  const resetFilters = () => {
    setSearch("");

    setModelFilter("");

    setFromDate("");

    setToDate("");

    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Quantity Tracking</h1>

        <p className="mt-1 text-sm text-slate-500">
          Model-wise issued, returned and outstanding quantities
        </p>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-end gap-3 border-b border-slate-100 p-4 sm:p-5">
          <label className="min-w-[190px] flex-[1.5]">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">
              Search
            </span>

            <span className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 focus-within:border-violet-400">
              <Search size={16} className="shrink-0 text-slate-400" />

              <input
                type="search"
                placeholder="Product code, supplier code, product, model..."
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);

                  setPage(1);
                }}
                className="w-full min-w-0 bg-transparent text-sm text-slate-700 outline-none"
              />
            </span>
          </label>

          <label className="min-w-[155px] flex-1">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">
              Model
            </span>

            <select
              value={modelFilter}
              onChange={(event) => {
                setModelFilter(event.target.value);

                setPage(1);
              }}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-violet-400"
            >
              <option value="">All Models</option>

              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
          </label>

          <label className="min-w-[145px] flex-1">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">
              From (Sent Date)
            </span>

            <span className="relative block">
              <input
                type="date"
                value={fromDate}
                max={toDate || undefined}
                onChange={(event) => {
                  setFromDate(event.target.value);

                  setPage(1);
                }}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-violet-400"
              />
            </span>
          </label>

          <label className="min-w-[145px] flex-1">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">
              To (Sent Date)
            </span>

            <input
              type="date"
              value={toDate}
              min={fromDate || undefined}
              onChange={(event) => {
                setToDate(event.target.value);

                setPage(1);
              }}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-violet-400"
            />
          </label>

          <button
            type="button"
            onClick={resetFilters}
            disabled={!hasFilters}
            className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            title="Reset all filters"
          >
            <RotateCcw size={15} /> Reset
          </button>

          <button
            type="button"
            title="Refresh stock data"
            aria-label="Refresh stock data"
            disabled={loading}
            onClick={() => void loadAssignments()}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-violet-50 hover:text-violet-700 disabled:opacity-50"
          >
            <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 px-5 py-3 text-xs text-slate-500">
          <span>
            {filtered.length} records{hasFilters ? " matching filters" : ""}
          </span>

          {fromDate && toDate && fromDate > toDate && (
            <span className="text-red-600">
              From date must be before To date
            </span>
          )}
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[950px] text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-600">
                {[
                  "Product Image",

                  "Product Code",

                  "Supplier Code",

                  "Model",

                  "Size",

                  "Sent",

                  "Returned",

                  "On Hand",

                  "Don\'t Wear",
                  "Due Date",
                ].map((label) => (
                  <th
                    key={label}
                    className={`px-4 py-4 font-semibold ${["Sent", "Returned", "On Hand", "Don't Wear"].includes(label) ? "text-center" : "text-left"}`}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {!loading &&
                paginated.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-slate-100 transition-colors hover:bg-violet-50/40"
                  >
                    <td className="px-4 py-3">
                      {row.image ? (
                        <img
                          src={row.image}
                          alt={row.productName}
                          loading="lazy"
                          className="h-14 w-14 rounded-xl border border-slate-200 bg-slate-50 object-cover"
                        />
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-400">
                          <Package size={21} />
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-lg bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700">
                        {row.sn}
                      </span>
                    </td>

                    <td className="px-4 py-3 font-semibold text-slate-700">
                      {row.supplierCode}
                    </td>

                    <td className="px-4 py-3 font-medium text-slate-800">
                      {row.model}
                    </td>

                    <td className="px-4 py-3">
                      <span className="inline-flex min-w-10 justify-center rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700">
                        {row.size}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-center">
                      <span className="text-base font-bold tabular-nums text-blue-600">
                        {row.sent}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-center">
                      <span className="text-base font-bold tabular-nums text-emerald-600">
                        {row.returned}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex min-w-10 justify-center rounded-lg px-3 py-1.5 text-sm font-bold tabular-nums ${row.onHand > 0 ? "bg-orange-50 text-orange-600" : "bg-slate-100 text-slate-500"}`}
                      >
                        {row.onHand}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-center">
                      <span className="font-bold text-violet-700">
                        {row.dontWear}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-slate-600">
                      {formatDate(row.due)}
                    </td>
                  </tr>
                ))}

              {loading && (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-12 text-center text-slate-500"
                  >
                    Loading stock records...
                  </td>
                </tr>
              )}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-12 text-center text-slate-500"
                  >
                    No stock records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-4">
          <Pagination
            page={currentPage}
            setPage={setPage}
            total={filtered.length}
            limit={limit}
            setLimit={(value) => {
              setLimit(value);

              setPage(1);
            }}
          />
        </div>
      </section>
    </div>
  );
}
