"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

import {
  Eye,
  Pencil,
  Trash2,
  Plus,
  Search,
  RefreshCcw,
  Loader2,
  Truck,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

import { useAccount } from "@/components/Shell";

import Pagination from "@/components/shared/Pagination";

import SupplierProductHistory from "./SupplierProductHistory";

import {
  suppliersApi,
  type Supplier,
  type SupplierListResponse,
} from "@/lib/suppliers";

import SupplierForm from "./SupplierForm";

import SupplierDetails from "./SupplierDetails";

import SupplierDeleteDialog from "./SupplierDeleteDialog";

type SupplierStatus = "ALL" | "ACTIVE" | "INACTIVE";

type SupplierSort = "newest" | "oldest" | "name_asc" | "name_desc";

export default function SupplierList() {
  const account = useAccount();

  const allowed = (action: string) =>
    account.permissions.includes("*") ||
    account.permissions.includes(`suppliers.${action}`);

  const [data, setData] = useState<SupplierListResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const requestId = useRef(0);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");

  const [search, setSearch] = useState("");

  const [debounced, setDebounced] = useState("");

  const [status, setStatus] = useState<SupplierStatus>("ALL");

  const [sort, setSort] = useState<SupplierSort>("newest");

  const [page, setPage] = useState(1);

  const [limit, setLimit] = useState(10);

  const [refresh, setRefresh] = useState(0);

  const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null);

  const [form, setForm] = useState<Supplier | null | "create">(null);

  const [view, setView] = useState<Supplier | null>(null);

  const [deleting, setDeleting] = useState<Supplier | null>(null);

  // SEARCH DEBOUNCE

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(search.trim());
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  // RESET PAGE WHEN FILTER CHANGES

  useEffect(() => {
    setPage(1);
  }, [debounced, status, sort, limit]);

  // LOAD SUPPLIERS

  const load = useCallback(
    async (signal?: AbortSignal) => {
      const currentRequest = ++requestId.current;

      setLoading(true);

      setError("");

      try {
        const params = new URLSearchParams({
          page: String(page),

          limit: String(limit),

          search: debounced,

          status,

          sort,
        });

        const result = await suppliersApi.list(params);

        if (!signal?.aborted && currentRequest === requestId.current) {
          setData(result);
        }
      } catch (err) {
        if (!signal?.aborted && currentRequest === requestId.current) {
          setError(
            err instanceof Error ? err.message : "Unable to load suppliers",
          );
        }
      } finally {
        if (!signal?.aborted && currentRequest === requestId.current) {
          setLoading(false);
        }
      }
    },

    [page, limit, debounced, status, sort],
  );

  useEffect(() => {
    const controller = new AbortController();

    void load(controller.signal);

    return () => {
      controller.abort();
      requestId.current += 1;
    };
  }, [load, refresh]);

  // PAGINATION

  const total = data?.pagination.total ?? 0;

  const totalPages = Math.max(1, data?.pagination.totalPages ?? 1);

  const currentPage = Math.min(page, totalPages);

  useEffect(() => {
    if (loading || !data) return;

    const maxPage = Math.max(1, data.pagination.totalPages);

    if (page > maxPage) {
      setPage(maxPage);
    }
  }, [data, loading, page]);

  // REFRESH AFTER CREATE / EDIT / DELETE

  const updated = () => {
    setForm(null);

    setDeleting(null);

    setRefresh((value) => value + 1);
  };

  // RESET FILTERS

  const reset = () => {
    setSearch("");

    setDebounced("");

    setStatus("ALL");

    setSort("newest");

    setPage(1);

    setRefresh((value) => value + 1);
  };

  return (
    <div className="space-y-6 text-[#29213D]">
      {/* PAGE HEADER */}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[.16em] text-violet-600">
            Supplier Management
          </p>

          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Suppliers
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Manage supplier contacts, details and status.
          </p>
        </div>

        {allowed("create") && (
          <button
            type="button"
            onClick={() => setForm("create")}
            className="inline-flex items-center gap-2 rounded-xl bg-[#7C3AED] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-200 transition hover:bg-[#6D28D9]"
          >
            <Plus size={18} />
            Create Supplier
          </button>
        )}
      </div>

      {/* SUMMARY CARDS */}

      <div className="grid gap-4 sm:grid-cols-2">
        {/* TOTAL SUPPLIERS */}

        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <p className="text-sm font-medium text-slate-500">
              Total Suppliers
            </p>

            <p className="mt-2 text-3xl font-bold text-slate-900">
              {data?.stats.total ?? 0}
            </p>
          </div>

          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
            <Truck size={24} />
          </div>
        </div>

        {/* ACTIVE SUPPLIERS */}

        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <p className="text-sm font-medium text-slate-500">
              Active Suppliers
            </p>

            <p className="mt-2 text-3xl font-bold text-violet-700">
              {data?.stats.active ?? 0}
            </p>
          </div>

          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 text-green-700">
            <Truck size={24} />
          </div>
        </div>
      </div>

      {/* SUPPLIER DIRECTORY */}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* FILTER HEADER */}

        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 p-5">
          <h3 className="text-lg font-bold text-slate-900">
            Supplier Directory
          </h3>

          <div className="flex flex-wrap items-center gap-2">
            {/* SEARCH */}

            <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 text-slate-400">
              <Search size={17} />

              <input
                aria-label="Search suppliers"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);

                  setPage(1);
                }}
                placeholder="Search suppliers..."
                className="w-40 bg-transparent py-2.5 text-sm text-slate-800 outline-none sm:w-52"
              />
            </div>

            {/* STATUS FILTER */}

            <select
              aria-label="Filter suppliers by status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as SupplierStatus);

                setPage(1);
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-500"
            >
              <option value="ALL">All Status</option>

              <option value="ACTIVE">Active</option>

              <option value="INACTIVE">Inactive</option>
            </select>

            {/* SORT */}

            <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3">
              <ArrowUpDown size={15} className="text-slate-400" />

              <select
                aria-label="Sort suppliers"
                value={sort}
                onChange={(event) => {
                  setSort(event.target.value as SupplierSort);

                  setPage(1);
                }}
                className="bg-transparent py-2.5 text-sm outline-none"
              >
                <option value="newest">Newest First</option>

                <option value="oldest">Oldest First</option>

                <option value="name_asc">Name A-Z</option>

                <option value="name_desc">Name Z-A</option>
              </select>
            </div>

            {/* REFRESH */}

            <button
              type="button"
              title="Refresh"
              aria-label="Refresh suppliers"
              onClick={() => {
                setRefreshing(true);
                setRefresh((value) => value + 1);
              }}
              className="rounded-xl border border-slate-200 p-2.5 text-slate-500 hover:bg-slate-50"
            >
              <RefreshCcw
                size={17}
                className={refreshing || loading ? "animate-spin" : ""}
              />
            </button>

            {/* RESET */}

            <button
              type="button"
              onClick={reset}
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Reset
            </button>
          </div>
        </div>

        {/* ERROR MESSAGE */}

        {error && (
          <div
            role="alert"
            className="m-4 rounded-xl bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {/* CENTER-ALIGNED SUPPLIER TABLE */}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-center text-sm">
            {/* TABLE HEADER */}

            <thead className="bg-slate-50 text-center text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-4 text-center">Supplier Name</th>

                <th className="px-4 py-4 text-center">Contact Person</th>

                <th className="px-4 py-4 text-center">Phone</th>

                <th className="px-4 py-4 text-center">Email</th>

                <th className="px-4 py-4 text-center">Address</th>

                <th className="px-4 py-4 text-center">Status</th>

                <th className="px-4 py-4 text-center">Actions</th>
              </tr>
            </thead>

            {/* TABLE BODY */}

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <Loader2
                      size={24}
                      className="mx-auto animate-spin text-violet-600"
                    />

                    <p className="mt-3 text-sm text-slate-500">
                      Loading suppliers...
                    </p>
                  </td>
                </tr>
              ) : data?.items.length ? (
                data.items.map((item) => (
                  <React.Fragment key={item.id}>
                    <tr
                      key={item.id}
                      className="border-t border-slate-100 transition hover:bg-violet-50/40"
                    >
                      {/* SUPPLIER NAME */}

                      <td className="px-4 py-4 text-center font-semibold text-slate-800">
                        <button
                          type="button"
                          aria-expanded={expandedSupplier === item.id}
                          onClick={() =>
                            setExpandedSupplier(
                              expandedSupplier === item.id ? null : item.id,
                            )
                          }
                          className="inline-flex items-center gap-2 text-violet-700 hover:text-violet-900"
                        >
                          {expandedSupplier === item.id ? (
                            <ChevronUp size={17} />
                          ) : (
                            <ChevronDown size={17} />
                          )}

                          <span>{item.name}</span>
                        </button>
                      </td>

                      {/* CONTACT PERSON */}

                      <td className="px-4 py-4 text-center text-slate-600">
                        {item.contactPerson || "-"}
                      </td>

                      {/* PHONE */}

                      <td className="px-4 py-4 text-center text-slate-600">
                        {item.phone || "-"}
                      </td>

                      {/* EMAIL */}

                      <td className="px-4 py-4 text-center text-slate-600">
                        {item.email || "-"}
                      </td>

                      {/* ADDRESS */}

                      <td
                        title={item.address || ""}
                        className="max-w-[220px] truncate px-4 py-4 text-center text-slate-600"
                      >
                        {item.address || "-"}
                      </td>

                      {/* STATUS */}

                      <td className="px-4 py-4 text-center">
                        <span
                          className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold ${
                            item.status === "ACTIVE"
                              ? "bg-green-50 text-green-700"
                              : "bg-red-50 text-red-700"
                          }`}
                        >
                          {item.status === "ACTIVE" ? "Active" : "Inactive"}
                        </span>
                      </td>

                      {/* ACTIONS */}

                      <td className="px-4 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {/* PREVIEW */}

                          <button
                            type="button"
                            aria-label={`View ${item.name}`}
                            title="View"
                            onClick={() => setView(item)}
                            className="rounded-lg border border-blue-200 p-2 text-blue-600 hover:bg-blue-50"
                          >
                            <Eye size={16} />
                          </button>

                          {/* EDIT */}

                          {allowed("edit") && (
                            <button
                              type="button"
                              aria-label={`Edit ${item.name}`}
                              title="Edit"
                              onClick={() => setForm(item)}
                              className="rounded-lg border border-violet-200 p-2 text-violet-600 hover:bg-violet-50"
                            >
                              <Pencil size={16} />
                            </button>
                          )}

                          {/* DELETE */}

                          {allowed("delete") && (
                            <button
                              type="button"
                              aria-label={`Delete ${item.name}`}
                              title="Delete"
                              onClick={() => setDeleting(item)}
                              className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {expandedSupplier === item.id && (
                      <tr className="bg-slate-50/70">
                        <td colSpan={7} className="p-4 text-left">
                          <SupplierProductHistory
                            supplierId={item.id}
                            supplierName={item.name}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    No suppliers found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* SAME PAGINATION AS CATEGORIES */}

        <div
          className="border-t border-slate-100 px-5 pb-4"
          aria-busy={loading}
        >
          {loading && (
            <div className="flex items-center gap-2 py-2 text-xs text-violet-700">
              <Loader2 size={14} className="animate-spin" /> Loading page...
            </div>
          )}

          <Pagination
            page={currentPage}
            setPage={setPage}
            total={total}
            limit={limit}
            setLimit={setLimit}
          />
        </div>
      </section>

      {/* CREATE / EDIT MODAL */}

      {form && (
        <SupplierForm
          key={form === "create" ? "create" : form.id}
          supplier={form === "create" ? null : form}
          onClose={() => setForm(null)}
          onSaved={updated}
        />
      )}

      {/* PREVIEW MODAL */}

      {view && (
        <SupplierDetails supplier={view} onClose={() => setView(null)} />
      )}

      {/* DELETE MODAL */}

      {deleting && (
        <SupplierDeleteDialog
          supplier={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={updated}
        />
      )}
    </div>
  );
}
