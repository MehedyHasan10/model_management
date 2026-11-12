"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  RefreshCcw,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ImageOff,
} from "lucide-react";

type HistoryRow = {
  product: {
    id: string;
    sn: string | null;
    supplierCode: string | null;
    itemName: string | null;
    images: { url: string }[];
  };
  sent: number;
  returned: number;
  dontWear: number;
  statuses: string[];
  dates: string[];
};
type Result = {
  items: HistoryRow[];
  pageTotals: { sent: number; returned: number; dontWear: number };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

function ProductImage({ src, alt }: { src?: string; alt: string }) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setReady(false);
    setFailed(false);
  }, [src]);
  return (
    <div className="relative mx-auto flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
      {src && !failed ? (
        <>
          {!ready && (
            <Loader2
              aria-label="Loading image"
              size={18}
              className="absolute animate-spin text-violet-600"
            />
          )}
          {/* Images are already returned by the application API (including base64 data URLs). */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            loading="lazy"
            decoding="async"
            onLoad={() => setReady(true)}
            onError={() => setFailed(true)}
            className={`h-full w-full object-cover transition-opacity duration-200 ${ready ? "opacity-100" : "opacity-0"}`}
          />
        </>
      ) : (
        <ImageOff size={18} className="text-slate-400" aria-label="No image" />
      )}
    </div>
  );
}

export default function SupplierProductHistory({
  supplierId,
  supplierName,
}: {
  supplierId: string;
  supplierName: string;
}) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [refreshKey, setRefreshKey] = useState(0);
  const [data, setData] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      setError("");
      try {
        const query = new URLSearchParams({
          page: String(page),
          limit: String(limit),
          search: debouncedSearch,
          status,
          from,
          to,
        });
        const res = await fetch(
          `/api/suppliers/${encodeURIComponent(supplierId)}/product-history?${query}`,
          {
            credentials: "same-origin",
            cache: "no-store",
            signal,
          },
        );
        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("application/json"))
          throw new Error(
            `History API returned non-JSON response (${res.status})`,
          );
        const payload = await res.json();
        if (!res.ok)
          throw new Error(payload?.error || `Request failed (${res.status})`);
        if (!signal.aborted) setData(payload as Result);
      } catch (e) {
        if (!signal.aborted) {
          setData(null);
          setError(e instanceof Error ? e.message : "Unable to load history");
        }
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [supplierId, page, limit, debouncedSearch, status, from, to],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, refreshKey]);

  const changeFilters = (fn: () => void) => {
    setPage(1);
    fn();
  };
  const reset = () => {
    setSearch("");
    setDebouncedSearch("");
    setStatus("");
    setFrom("");
    setTo("");
    setPage(1);
  };
  const total = data?.pagination.total ?? 0;
  const pages = Math.max(1, data?.pagination.totalPages ?? 1);
  const effectivePage = Math.min(page, pages);
  const first = total ? (effectivePage - 1) * limit + 1 : 0;
  const last = Math.min(effectivePage * limit, total);
  const totals = data?.pageTotals ?? { sent: 0, returned: 0, dontWear: 0 };
  const btn =
    "rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 text-slate-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold">
          {supplierName} — Product &amp; Assignment History
        </h3>
        <button
          type="button"
          disabled={loading}
          onClick={() => setRefreshKey((n) => n + 1)}
          className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs disabled:opacity-50"
        >
          <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />{" "}
          Refresh
        </button>
      </div>

      {/* Page-scoped quantities: never mislabel these as supplier-wide totals. */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {(
          [
            ["Total Products", total],
            ["Sent", totals.sent],
            ["Returned", totals.returned],
            ["On Hand", totals.sent - totals.returned],
            ["Don't Wear", totals.dontWear],
          ] as const
        ).map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border border-slate-200 bg-slate-50 p-3"
          >
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-1 text-xl font-bold text-violet-700">
              {loading ? "…" : value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <input
          aria-label="Search products"
          placeholder="Search product name or code"
          value={search}
          onChange={(e) => changeFilters(() => setSearch(e.target.value))}
          className="rounded-lg border p-2 text-sm"
        />
        <select
          aria-label="History status"
          value={status}
          onChange={(e) => changeFilters(() => setStatus(e.target.value))}
          className="rounded-lg border p-2 text-sm"
        >
          <option value="">All Status</option>
          <option value="ISSUED">Issued</option>
          <option value="PARTIAL">Partial</option>
          <option value="COMPLETED">Completed</option>
        </select>
        <input
          aria-label="From sent date"
          type="date"
          value={from}
          max={to || undefined}
          onChange={(e) => changeFilters(() => setFrom(e.target.value))}
          className="rounded-lg border p-2 text-sm"
        />
        <input
          aria-label="To sent date"
          type="date"
          value={to}
          min={from || undefined}
          onChange={(e) => changeFilters(() => setTo(e.target.value))}
          className="rounded-lg border p-2 text-sm"
        />
        <button
          type="button"
          onClick={reset}
          className="rounded-lg border p-2 text-sm hover:bg-slate-50"
        >
          Reset Filters
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
        >
          {error}{" "}
          <button
            type="button"
            className="ml-2 underline"
            onClick={() => setRefreshKey((n) => n + 1)}
          >
            Retry
          </button>
        </div>
      )}
      <div className="relative overflow-x-auto" aria-busy={loading}>
        <table className="w-full min-w-[850px] text-center text-sm">
          <thead className="bg-slate-100">
            <tr>
              {[
                "Image",
                "Product Code",
                "Supplier Code",
                "Product Name",
                "Sent",
                "Returned",
                "On Hand",
                "Don't Wear",
              ].map((h) => (
                <th key={h} className="px-3 py-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="py-12">
                  <div className="flex items-center justify-center gap-2 text-violet-700">
                    <Loader2 size={22} className="animate-spin" /> Loading
                    products…
                  </div>
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={8} className="py-8 text-slate-500">
                  Unable to display products.
                </td>
              </tr>
            ) : data?.items.length ? (
              data.items.map((r) => (
                <tr key={r.product.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">
                    <ProductImage
                      src={r.product.images[0]?.url}
                      alt={r.product.itemName || "Product"}
                    />
                  </td>
                  <td className="px-3 py-2">{r.product.sn || "—"}</td>
                  <td className="px-3 py-2">{r.product.supplierCode || "—"}</td>
                  <td className="px-3 py-2">{r.product.itemName || "—"}</td>
                  <td className="px-3 py-2 font-semibold text-blue-600">
                    {r.sent}
                  </td>
                  <td className="px-3 py-2 font-semibold text-emerald-600">
                    {r.returned}
                  </td>
                  <td className="px-3 py-2 font-semibold text-orange-600">
                    {r.sent - r.returned}
                  </td>
                  <td className="px-3 py-2 font-semibold text-violet-600">
                    {r.dontWear}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="py-8 text-slate-500">
                  No linked products match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-4 py-3 text-xs text-slate-600">
        <span className="whitespace-nowrap">
          Showing {loading ? "…" : `${first}–${last} of ${total}`}
        </span>

        <div className="flex items-center gap-2">
          <span className="whitespace-nowrap">Rows</span>

          <select
            aria-label="Rows per page"
            value={limit}
            disabled={loading}
            onChange={(e) => {
              setLimit(Number(e.target.value));
              setPage(1);
            }}
            className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs outline-none focus:border-violet-500 disabled:opacity-50"
          >
            {[10, 20, 50].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>

          <button
            type="button"
            aria-label="First page"
            className={btn}
            disabled={loading || effectivePage <= 1}
            onClick={() => setPage(1)}
          >
            <ChevronsLeft size={15} />
          </button>

          <button
            type="button"
            aria-label="Previous page"
            className={btn}
            disabled={loading || effectivePage <= 1}
            onClick={() => setPage((n) => Math.max(1, n - 1))}
          >
            <ChevronLeft size={15} />
          </button>

          <span className="min-w-[48px] whitespace-nowrap text-center font-medium text-slate-700">
            {effectivePage} / {pages}
          </span>

          <button
            type="button"
            aria-label="Next page"
            className={btn}
            disabled={loading || effectivePage >= pages}
            onClick={() => setPage((n) => Math.min(pages, n + 1))}
          >
            <ChevronRight size={15} />
          </button>

          <button
            type="button"
            aria-label="Last page"
            className={btn}
            disabled={loading || effectivePage >= pages}
            onClick={() => setPage(pages)}
          >
            <ChevronsRight size={15} />
          </button>
        </div>
      </div>
    </section>
  );
}
