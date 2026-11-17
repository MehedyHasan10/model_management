"use client";

import { useCallback, useEffect, useState } from "react";

import { createPortal } from "react-dom";

import toast from "react-hot-toast";

import {
  Grid2X2,
  List,
  Plus,
  Search,
  ArrowUpDown,
  Layers3,
  Pencil,
  Trash2,
  X,
  Save,
  RefreshCcw,
  Loader2,
} from "lucide-react";

import { useAccount } from "@/components/Shell";

import { saveEntity, deleteEntity } from "@/lib/client-api";

import Pagination from "@/components/shared/Pagination";

import DeleteConfirmModal from "@/components/shared/DeleteConfirmModal";

type Category = {
  id: string;

  name: string;

  createdAt?: string;

  _count?: { products?: number; templates?: number };
};

type Sort = "newest" | "oldest" | "az" | "za";

export default function CategoriesPage() {
  const account = useAccount();

  const can = (action: string) =>
    account.permissions.includes("*") ||
    account.permissions.includes(`categories.${action}`);

  const [rows, setRows] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [matching, setMatching] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [loadError, setLoadError] = useState("");

  const [loading, setLoading] = useState(true);

  const [busy, setBusy] = useState(false);

  const [view, setView] = useState<"list" | "grid">("list");

  const [query, setQuery] = useState("");

  const [sort, setSort] = useState<Sort>("newest");

  const [page, setPage] = useState(1);

  const [limit, setLimit] = useState(10);

  const [editing, setEditing] = useState<Category | null>(null);

  const [deleting, setDeleting] = useState<Category | null>(null);

  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const reload = useCallback(() => {
    setRefreshKey((value) => value + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setLoadError("");
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(limit),
          search: debouncedQuery,
          sort,
        });
        const response = await fetch(`/api/categories?${params.toString()}`, {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
          throw new Error(
            `Categories API returned a non-JSON response (${response.status})`,
          );
        }
        const result = await response.json();
        if (!response.ok)
          throw new Error(
            result.error || `Request failed (${response.status})`,
          );
        if (!Array.isArray(result.items) || !result.pagination) {
          throw new Error("Unexpected categories API response");
        }
        if (controller.signal.aborted) return;
        setRows(result.items);
        setTotal(result.stats?.total ?? result.pagination.total);
        setMatching(result.pagination.total);
        setTotalPages(Math.max(1, result.pagination.totalPages));
        if (page > Math.max(1, result.pagination.totalPages)) {
          setPage(Math.max(1, result.pagination.totalPages));
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        setRows([]);
        setLoadError(
          error instanceof Error ? error.message : "Unable to load categories",
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [page, limit, debouncedQuery, sort, refreshKey]);

  useEffect(() => {
    if (!editing && !deleting) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        setEditing(null);

        setDeleting(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editing, deleting, busy]);

  const current = Math.min(page, totalPages);
  const visible = rows;

  async function save() {
    if (!editing || busy) return;

    const name = editing.name.trim();

    if (name.length < 2) {
      toast.error("Category name must contain at least 2 characters");
      return;
    }
    if (name.length > 150) {
      toast.error("Category name must be 150 characters or fewer");
      return;
    }

    setBusy(true);

    try {
      if (editing.id) {
        // The PATCH schema accepts only { name }; id belongs in the URL.
        const response = await fetch(
          `/api/categories/${encodeURIComponent(editing.id)}`,
          {
            method: "PATCH",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name }),
          },
        );
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          const details = data?.details;
          const fieldMessages = Object.entries(
            details?.fieldErrors ?? {},
          ).flatMap(([field, errors]) =>
            Array.isArray(errors)
              ? errors.map((message) => `${field}: ${String(message)}`)
              : [],
          );
          const messages = [
            ...fieldMessages,
            ...(Array.isArray(details?.formErrors)
              ? details.formErrors
              : []),
          ];
          throw new Error(
            messages.join("; ") ||
              data?.error ||
              `Unable to update category (${response.status})`,
          );
        }
      } else {
        await saveEntity("categories", { name });
      }

      toast.success(editing.id ? "Category updated" : "Category created");

      setEditing(null);

      reload();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save category",
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!deleting || busy) return;

    setBusy(true);

    try {
      await deleteEntity("categories", deleting.id);

      toast.success("Category deleted");

      setDeleting(null);

      reload();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to delete category",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[.2em] text-violet-600">
            Catalog management
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Categories
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Organize types and manage your category catalog.
          </p>
        </div>

        {can("create") && (
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-200 hover:bg-brand-dark"
            onClick={() => setEditing({ id: "", name: "" })}
          >
            <Plus size={18} /> Create Category
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <p className="text-sm font-medium text-slate-500">
              Total Categories
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {loading ? "…" : total}
            </p>
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
            <Layers3 size={24} />
          </div>
        </div>
        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <p className="text-sm font-medium text-slate-500">
              Matching Search
            </p>
            <p className="mt-2 text-3xl font-bold text-violet-700">
              {loading ? "…" : matching}
            </p>
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
            <Search size={24} />
          </div>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 p-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Category Directory
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 text-slate-400">
              <Search size={17} />

              <input
                aria-label="Search categories"
                className="w-40 bg-transparent py-2.5 text-sm text-slate-800 outline-none sm:w-52"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);

                  setPage(1);
                }}
                placeholder="Search categories..."
              />
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3">
              <ArrowUpDown size={15} className="text-slate-400" />

              <select
                aria-label="Sort categories"
                className="bg-transparent py-2.5 text-sm outline-none"
                value={sort}
                onChange={(event) => {
                  setSort(event.target.value as Sort);

                  setPage(1);
                }}
              >
                <option value="newest">Newest first</option>

                <option value="oldest">Oldest first</option>

                <option value="az">Name A-Z</option>

                <option value="za">Name Z-A</option>
              </select>
            </div>

            <div className="flex rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                aria-label="List view"
                title="List view"
                onClick={() => setView("list")}
                className={`rounded-lg p-2 ${view === "list" ? "bg-white text-violet-700 shadow-sm" : "text-slate-500"}`}
              >
                <List size={18} />
              </button>

              <button
                type="button"
                aria-label="Grid view"
                title="Grid view"
                onClick={() => setView("grid")}
                className={`rounded-lg p-2 ${view === "grid" ? "bg-white text-violet-700 shadow-sm" : "text-slate-500"}`}
              >
                <Grid2X2 size={18} />
              </button>
            </div>

            <button
              type="button"
              title="Refresh"
              aria-label="Refresh categories"
              onClick={reload}
              disabled={loading}
              className="rounded-xl border border-slate-200 p-2.5 text-slate-500 hover:bg-slate-50"
            >
              <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {loadError && (
          <div
            role="alert"
            className="mx-5 mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700"
          >
            {loadError}{" "}
            <button type="button" onClick={reload} className="ml-2 underline">
              Retry
            </button>
          </div>
        )}
        {loading ? (
          <div className="space-y-3 p-5" aria-busy="true">
            <div className="flex items-center justify-center gap-2 py-3 text-sm text-violet-700">
              <Loader2 size={20} className="animate-spin" /> Loading
              categories...
            </div>
            {Array.from({ length: Math.min(limit, 10) }, (_, i) => (
              <div
                key={i}
                className="h-12 animate-pulse rounded-lg bg-slate-100"
              />
            ))}
          </div>
        ) : loadError ? null : visible.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">
            No categories found.
          </div>
        ) : view === "list" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-6 py-4">Category Name</th>

                  <th className="px-6 py-4">Created</th>

                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>

              <tbody>
                {visible.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-slate-100 hover:bg-violet-50/40"
                  >
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-3 font-semibold text-slate-800">
                        <span className="rounded-xl bg-violet-100 p-2.5 text-violet-700">
                          <Layers3 size={18} />
                        </span>

                        {row.name}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-slate-500">
                      {row.createdAt
                        ? new Date(row.createdAt).toLocaleDateString()
                        : "-"}
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        {can("edit") && (
                          <button
                            type="button"
                            title="Edit"
                            aria-label={`Edit ${row.name}`}
                            className="rounded-lg border border-slate-200 p-2 text-violet-700 hover:bg-violet-50"
                            onClick={() => setEditing({ ...row })}
                          >
                            <Pencil size={16} />
                          </button>
                        )}

                        {can("delete") && (
                          <button
                            type="button"
                            title="Delete"
                            aria-label={`Delete ${row.name}`}
                            className="rounded-lg border border-red-100 p-2 text-red-600 hover:bg-red-50"
                            onClick={() => setDeleting(row)}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((row) => (
              <div
                key={row.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <span className="rounded-xl bg-violet-100 p-3 text-violet-700">
                    <Layers3 size={23} />
                  </span>

                  <div className="flex gap-2">
                    {can("edit") && (
                      <button
                        type="button"
                        aria-label={`Edit ${row.name}`}
                        className="rounded-lg p-2 text-slate-500 hover:bg-violet-50 hover:text-violet-700"
                        onClick={() => setEditing({ ...row })}
                      >
                        <Pencil size={16} />
                      </button>
                    )}

                    {can("delete") && (
                      <button
                        type="button"
                        aria-label={`Delete ${row.name}`}
                        className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"
                        onClick={() => setDeleting(row)}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>

                <h3 className="mt-5 text-lg font-bold text-slate-900">
                  {row.name}
                </h3>

                <p className="mt-2 text-xs text-slate-500">
                  Created:{" "}
                  {row.createdAt
                    ? new Date(row.createdAt).toLocaleDateString()
                    : "Not available"}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-slate-100 px-5 pb-4">
          <Pagination
            page={current}
            setPage={setPage}
            total={matching}
            limit={limit}
            setLimit={(value) => {
              setLimit(value);
              setPage(1);
            }}
          />
        </div>
      </section>

      {mounted &&
        editing &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !busy)
                setEditing(null);
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label={editing.id ? "Edit category" : "Create category"}
              className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    {editing.id ? "Edit Category" : "Create Category"}
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Enter a unique garment category name.
                  </p>
                </div>

                <button
                  type="button"
                  aria-label="Close"
                  disabled={busy}
                  className="rounded-lg p-2 hover:bg-slate-100 disabled:opacity-50"
                  onClick={() => setEditing(null)}
                >
                  <X size={20} />
                </button>
              </div>

              <form
                onSubmit={(event) => {
                  event.preventDefault();

                  void save();
                }}
              >
                <label className="mt-6 block text-sm font-semibold text-slate-700">
                  Category Name <span className="text-red-500">*</span>
                  <input
                    autoFocus
                    required
                    maxLength={100}
                    className="mt-2 w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-violet-500"
                    placeholder="e.g. Jacket"
                    value={editing.name}
                    onChange={(event) =>
                      setEditing({ ...editing, name: event.target.value })
                    }
                  />
                </label>

                <div className="mt-7 flex justify-end gap-3 border-t border-slate-100 pt-5">
                  <button
                    type="button"
                    disabled={busy}
                    className="rounded-xl bg-slate-100 px-5 py-2.5 font-semibold text-slate-700 disabled:opacity-50"
                    onClick={() => setEditing(null)}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={busy}
                    className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 font-semibold text-white disabled:opacity-50"
                  >
                    <Save size={17} />

                    {busy
                      ? "Saving..."
                      : editing.id
                        ? "Save Changes"
                        : "Create Category"}
                  </button>
                </div>
              </form>
            </div>
          </div>,

          document.body,
        )}

      {mounted &&
        deleting &&
        createPortal(
          <DeleteConfirmModal
            name={deleting.name}
            busy={busy}
            onCancel={() => {
              if (!busy) setDeleting(null);
            }}
            onConfirm={() => void remove()}
          />,

          document.body,
        )}
    </div>
  );
}
