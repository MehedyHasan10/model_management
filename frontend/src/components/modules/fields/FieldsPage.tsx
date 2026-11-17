"use client";

import { useCallback, useEffect, useState } from "react";

import { createPortal } from "react-dom";

import toast from "react-hot-toast";

import {
  ArrowUpDown,
  Grid2X2,
  List,
  Plus,
  RefreshCcw,
  Loader2,
  Ruler,
  Search,
} from "lucide-react";

import { useAccount } from "@/components/Shell";

import { api, ApiError, deleteEntity } from "@/lib/client-api";

import Pagination from "@/components/shared/Pagination";

import DeleteConfirmModal from "@/components/shared/DeleteConfirmModal";

import FieldsTable from "./FieldsTable";

import FieldsGrid from "./FieldsGrid";

import FieldFormModal from "./FieldFormModal";

import UnitsPanel from "./UnitsPanel";

export type MeasurementUnit = {
  id: string;
  name: string;
  symbol: string;
  fieldCount: number;
};

export type MeasurementField = {
  id: string;

  name: string;

  unitId: string;

  unit?: { id: string; name: string; symbol: string };

  order?: number;

  createdAt?: string;
};

export type FieldErrors = { name?: string; unitId?: string };

export const unitLabel = (unit?: { name: string; symbol: string } | null) =>
  unit ? `${unit.name} (${unit.symbol})` : "-";

type Sort = "newest" | "oldest" | "az" | "za";

export default function FieldsPage() {
  const account = useAccount();

  const can = (action: string) =>
    account.permissions.includes("*") ||
    account.permissions.includes(`fields.${action}`);

  const [rows, setRows] = useState<MeasurementField[]>([]);
  const [total, setTotal] = useState(0);
  const [matching, setMatching] = useState(0);
  const [pages, setPages] = useState(1);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState("");

  const [loading, setLoading] = useState(true);

  const [busy, setBusy] = useState(false);

  const [view, setView] = useState<"list" | "grid">("list");

  const [query, setQuery] = useState("");

  const [sort, setSort] = useState<Sort>("newest");

  const [page, setPage] = useState(1);

  const [limit, setLimit] = useState(10);

  const [editing, setEditing] = useState<MeasurementField | null>(null);

  const [deleting, setDeleting] = useState<MeasurementField | null>(null);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const [tab, setTab] = useState<"fields" | "units">("fields");

  const [units, setUnits] = useState<MeasurementUnit[]>([]);

  const [unitsLoading, setUnitsLoading] = useState(true);

  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const reload = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(limit),
          search: debouncedQuery,
          sort,
        });
        const response = await fetch(`/api/fields?${params}`, {
          credentials: "same-origin",
          cache: "no-store",
          signal,
        });
        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
          throw new Error(`Fields API returned non-JSON (${response.status})`);
        }
        const result = await response.json();
        if (!response.ok)
          throw new Error(
            result.error || `Request failed (${response.status})`,
          );
        if (signal?.aborted) return;
        setRows(result.items ?? []);
        setTotal(result.stats?.total ?? 0);
        setMatching(result.pagination?.total ?? 0);
        setPages(Math.max(1, result.pagination?.totalPages ?? 1));
      } catch (err) {
        if (signal?.aborted) return;
        setError(err instanceof Error ? err.message : "Unable to load fields");
        setRows([]);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [page, limit, debouncedQuery, sort],
  );

  useEffect(() => {
    const controller = new AbortController();
    void reload(controller.signal);
    return () => controller.abort();
  }, [reload, refreshKey]);

  useEffect(() => {
    if (!loading && page > pages) setPage(pages);
  }, [loading, page, pages]);

  const loadUnits = useCallback(async () => {
    try {
      setUnits(await api<MeasurementUnit[]>("units"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to load units");
    } finally {
      setUnitsLoading(false);
    }
  }, []);

  // Field counts on the Units tab change whenever fields change.
  useEffect(() => {
    void loadUnits();
  }, [loadUnits, refreshKey]);

  const refresh = () => setRefreshKey((n) => n + 1);

  const current = Math.min(page, pages);
  const visible = rows;

  async function save() {
    if (!editing || busy) return;

    const name = editing.name.trim();

    const errors: FieldErrors = {};

    if (!name) errors.name = "Field name is required";
    else if (name.length < 2)
      errors.name = "Field name must be at least 2 characters";
    else if (
      rows.some(
        (r) =>
          r.id !== editing.id &&
          r.name.trim().toLowerCase() === name.toLowerCase(),
      )
    )
      errors.name = "A field with this name already exists";

    if (!units.some((u) => u.id === editing.unitId))
      errors.unitId = "Select a measurement unit";

    setFieldErrors(errors);

    if (errors.name || errors.unitId) return;

    setBusy(true);

    try {
      // Send only the editable values. List rows carry extra keys
      // (categoryId, unit, ...) that the API rejects.
      const path = editing.id
        ? `fields/${encodeURIComponent(editing.id)}`
        : "fields";

      await api(path, {
        method: editing.id ? "PATCH" : "POST",
        body: JSON.stringify({ name, unitId: editing.unitId }),
      });

      toast.success(
        editing.id ? "Measurement field updated" : "Measurement field created",
      );

      setEditing(null);

      refresh();
    } catch (error: unknown) {
      if (
        error instanceof ApiError &&
        (error.field === "name" || error.field === "unitId")
      ) {
        setFieldErrors({ [error.field]: error.message });
      } else {
        toast.error(
          error instanceof Error ? error.message : "Unable to save field",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!deleting || busy) return;

    setBusy(true);

    try {
      await deleteEntity("fields", deleting.id);

      toast.success("Measurement field deleted");

      setDeleting(null);

      refresh();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to delete field. It may be linked to templates.",
      );
    } finally {
      setBusy(false);
    }
  }

  const openCreate = () => {
    setFieldErrors({});
    setEditing({ id: "", name: "", unitId: units[0]?.id ?? "", order: 0 });
  };

  const openEdit = (r: MeasurementField) => {
    setFieldErrors({});
    setEditing({
      id: r.id,
      name: r.name,
      unitId: r.unitId ?? r.unit?.id ?? "",
      unit: r.unit,
      order: r.order,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[.2em] text-violet-600">
            Measurement management
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Measurement Fields
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Organize measurement fields and manage their units.
          </p>
        </div>

        {can("create") && tab === "fields" && (
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-200 hover:bg-violet-700"
            onClick={openCreate}
          >
            <Plus size={18} /> Create Field
          </button>
        )}
      </div>

      <div
        role="tablist"
        aria-label="Measurement sections"
        className="flex gap-1 border-b border-slate-200"
      >
        {(
          [
            ["fields", "Fields", loading && !total ? "..." : total],
            ["units", "Units", unitsLoading ? "..." : units.length],
          ] as const
        ).map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold ${
              tab === key
                ? "border-violet-600 text-violet-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {label} ({count})
          </button>
        ))}
      </div>

      {tab === "units" ? (
        <UnitsPanel
          units={units}
          loading={unitsLoading}
          canCreate={can("create")}
          canEdit={can("edit")}
          canDelete={can("delete")}
          onChanged={() => {
            void loadUnits();
            refresh();
          }}
        />
      ) : (
      <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">
              Total Fields
            </span>

            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
              <Ruler size={24} />
            </span>
          </div>

          <p className="mt-2 text-3xl font-bold text-slate-900">
            {loading ? "..." : total}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">
              Matching Search
            </span>

            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
              <Search size={24} />
            </span>
          </div>

          <p className="mt-2 text-3xl font-bold text-slate-900">
            {loading ? "..." : matching}
          </p>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 p-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Measurement Field Directory
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 text-slate-400">
              <Search size={17} />

              <input
                aria-label="Search measurement fields"
                className="w-40 bg-transparent py-2.5 text-sm text-slate-800 outline-none sm:w-52"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);

                  setPage(1);
                }}
                placeholder="Search fields..."
              />
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3">
              <ArrowUpDown size={15} className="text-slate-400" />

              <select
                aria-label="Sort measurement fields"
                className="bg-transparent py-2.5 text-sm outline-none"
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value as Sort);

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
                aria-pressed={view === "list"}
                onClick={() => setView("list")}
                className={`rounded-lg p-2 ${view === "list" ? "bg-white text-violet-700 shadow-sm" : "text-slate-500"}`}
              >
                <List size={18} />
              </button>

              <button
                type="button"
                aria-label="Grid view"
                title="Grid view"
                aria-pressed={view === "grid"}
                onClick={() => setView("grid")}
                className={`rounded-lg p-2 ${view === "grid" ? "bg-white text-violet-700 shadow-sm" : "text-slate-500"}`}
              >
                <Grid2X2 size={18} />
              </button>
            </div>

            <button
              type="button"
              title="Refresh"
              aria-label="Refresh fields"
              disabled={loading}
              onClick={refresh}
              className="rounded-xl border border-slate-200 p-2.5 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3 p-6" aria-busy="true">
            <div className="flex items-center justify-center gap-2 py-3 text-sm text-violet-700">
              <Loader2 size={20} className="animate-spin" /> Loading measurement
              fields...
            </div>
            {Array.from({ length: Math.min(limit, 5) }, (_, i) => (
              <div
                key={i}
                className="h-12 animate-pulse rounded-lg bg-slate-100"
              />
            ))}
          </div>
        ) : error ? (
          <div role="alert" className="p-8 text-center text-sm text-red-600">
            {error}{" "}
            <button type="button" onClick={refresh} className="ml-2 underline">
              Retry
            </button>
          </div>
        ) : visible.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">
            No measurement fields found.
          </div>
        ) : view === "list" ? (
          <FieldsTable
            rows={visible}
            canEdit={can("edit")}
            canDelete={can("delete")}
            onEdit={openEdit}
            onDelete={setDeleting}
          />
        ) : (
          <FieldsGrid
            rows={visible}
            canEdit={can("edit")}
            canDelete={can("delete")}
            onEdit={openEdit}
            onDelete={setDeleting}
          />
        )}

        <Pagination
          page={current}
          setPage={setPage}
          total={matching}
          limit={limit}
          setLimit={setLimit}
        />
      </section>
      </>
      )}

      {/* Portals keep modal overlays outside the page layout and clipping contexts. */}

      {mounted &&
        editing &&
        createPortal(
          <FieldFormModal
            field={editing}
            units={units}
            errors={fieldErrors}
            busy={busy}
            onChange={(next) => {
              setEditing(next);
              setFieldErrors({});
            }}
            onGoToUnits={() => {
              setEditing(null);
              setTab("units");
            }}
            onCancel={() => {
              if (!busy) setEditing(null);
            }}
            onSave={() => void save()}
          />,

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
