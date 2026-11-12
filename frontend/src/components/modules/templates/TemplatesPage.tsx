"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { createPortal } from "react-dom";

import toast from "react-hot-toast";

import {
  ArrowUpDown,
  ClipboardList,
  Grid2X2,
  List,
  Eye,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
  Loader2,
} from "lucide-react";

import { useAccount } from "@/components/Shell";

import { deleteEntity, saveEntity } from "@/lib/client-api";

import Pagination from "@/components/shared/Pagination";

import DeleteConfirmModal from "@/components/shared/DeleteConfirmModal";

import TemplatePreviewModal from "./TemplatePreviewModal";

import TemplateFormModal, {
  type TemplateDraft,
  type FieldOption,
  type CategoryOption,
  defaultDraft,
  normalizeDraft,
  isNoMeasurement,
} from "./TemplateFormModal";

type Template = TemplateDraft & {
  id: string;

  createdAt?: string;

  category?: { name: string } | null;

  fields?: Array<{
    fieldId: string;

    field?: { name: string };
  }>;
};

type PaginatedResponse<T> = {
  items: T[];

  pagination?: {
    page?: number;

    limit?: number;

    total?: number;

    totalPages?: number;
  };
};

type TemplateResponse = PaginatedResponse<Template> & {
  stats?: {
    total: number;

    matching: number;
  };
};

const dateOf = (value?: string) =>
  value ? new Date(value).toLocaleDateString() : "—";

const statusColor: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700",

  DRAFT: "bg-amber-50 text-amber-700",

  ARCHIVED: "bg-slate-100 text-slate-600",
};

function noMeasurement(row: Template) {
  return (
    (row.sizes?.length ?? 0) === 0 &&
    (row.fields?.length ?? row.fieldIds?.length ?? 0) === 0
  );
}

function getItems<T>(response: T[] | PaginatedResponse<T>): T[] {
  if (Array.isArray(response)) return response;

  if (response && Array.isArray(response.items)) {
    return response.items;
  }

  return [];
}

// Supports legacy array responses and paginated API responses.*

// Loads additional pages when the API exposes totalPages.*

async function loadAllOptions<T>(
  endpoint: string,

  signal: AbortSignal,
): Promise<T[]> {
  const firstResponse = await fetch(
    `/api/${endpoint}`,

    {
      signal,

      cache: "no-store",
    },
  );

  if (!firstResponse.ok) {
    throw new Error(`Unable to load ${endpoint} (${firstResponse.status})`);
  }

  const firstData = (await firstResponse.json()) as T[] | PaginatedResponse<T>;

  const allItems = getItems(firstData);

  if (Array.isArray(firstData)) {
    return allItems;
  }

  const totalPages = Math.max(
    1,

    Math.ceil(Number(firstData.pagination?.totalPages) || 1),
  );

  if (totalPages === 1) {
    return allItems;
  }

  const pageLimit = Number(firstData.pagination?.limit) || 50;

  // Fetch remaining pages sequentially to avoid flooding the API.*

  for (let page = 2; page <= totalPages; page++) {
    if (signal.aborted) {
      throw new DOMException(
        "Request aborted",

        "AbortError",
      );
    }

    const params = new URLSearchParams({
      page: String(page),

      limit: String(pageLimit),
    });

    const response = await fetch(
      `/api/${endpoint}?${params}`,

      {
        signal,

        cache: "no-store",
      },
    );

    if (!response.ok) {
      throw new Error(`Unable to load ${endpoint} page ${page}`);
    }

    const data = (await response.json()) as T[] | PaginatedResponse<T>;

    allItems.push(...getItems(data));
  }

  return allItems;
}

type ValidationDetails = {
  formErrors?: string[];
  fieldErrors?: Record<string, string[] | undefined>;
};

function readableError(error: unknown): string {
  const fallback = "Unable to save template. Please try again.";
  if (!(error instanceof Error)) return fallback;
  const raw = error.message || "";
  let parsed: { error?: string; details?: ValidationDetails } | null = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    /* plain error message */
  }
  const augmented = error as Error & { details?: ValidationDetails };
  const details = parsed?.details ?? augmented.details;
  const messages: string[] = [];
  for (const [field, issues] of Object.entries(details?.fieldErrors ?? {})) {
    for (const issue of issues ?? []) messages.push(`${field}: ${issue}`);
  }
  messages.push(...(details?.formErrors ?? []));
  const combined = messages.join("\n") || raw;
  if (
    /Unrecognized key\(s\).*noMeasurementFieldId|Unrecognized key\(s\).*noMeasurementText/i.test(
      combined,
    )
  ) {
    return "Template data format does not match the server validation rules. Please contact the administrator.";
  }
  if (combined === "Validation failed") {
    return "The template could not be saved because some information is invalid. Please check the fields and try again.";
  }
  return combined || parsed?.error || fallback;
}

export default function TemplatesPage() {
  const account = useAccount();

  const can = (action: string) =>
    account.permissions.includes("*") ||
    account.permissions.includes(`templates.${action}`);

  const [rows, setRows] = useState<Template[]>([]);

  const [categories, setCategories] = useState<CategoryOption[]>([]);

  const [fields, setFields] = useState<FieldOption[]>([]);

  const [loading, setLoading] = useState(true);

  const [optionsLoading, setOptionsLoading] = useState(true);

  const [stats, setStats] = useState({
    total: 0,

    matching: 0,
  });

  const [debouncedQuery, setDebouncedQuery] = useState("");

  const [refreshKey, setRefreshKey] = useState(0);

  const [busy, setBusy] = useState(false);

  const [view, setView] = useState<"list" | "grid">("list");

  const [query, setQuery] = useState("");

  const [sort, setSort] = useState("newest");

  const [page, setPage] = useState(1);

  const [limit, setLimit] = useState(10);

  const [editing, setEditing] = useState<TemplateDraft | null>(null);

  const [deleting, setDeleting] = useState<Template | null>(null);

  const [previewing, setPreviewing] = useState<Template | null>(null);

  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  // Debounced search*

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const reload = useCallback(() => {
    setRefreshKey((value) => value + 1);
  }, []);

  // Load categories and measurement fields*

  useEffect(() => {
    const controller = new AbortController();

    const loadOptions = async () => {
      setOptionsLoading(true);

      try {
        const [categoryList, fieldList] = await Promise.all([
          loadAllOptions<CategoryOption>(
            "categories",

            controller.signal,
          ),

          loadAllOptions<FieldOption>(
            "fields",

            controller.signal,
          ),
        ]);

        if (controller.signal.aborted) return;

        const uniqueCategories = Array.from(
          new Map(
            categoryList.map((category) => [category.id, category]),
          ).values(),
        );

        const uniqueFields = Array.from(
          new Map(fieldList.map((field) => [field.id, field])).values(),
        );

        setCategories(uniqueCategories);

        setFields(uniqueFields);
      } catch (error) {
        if (!controller.signal.aborted) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Unable to load template options",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setOptionsLoading(false);
        }
      }
    };

    void loadOptions();

    return () => controller.abort();
  }, [refreshKey]);

  // Server-side template pagination*

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);

      try {
        const params = new URLSearchParams({
          page: String(page),

          limit: String(limit),

          search: debouncedQuery,

          sort,
        });

        const response = await fetch(
          `/api/templates?${params}`,

          {
            signal: controller.signal,

            cache: "no-store",
          },
        );

        if (!response.ok) {
          throw new Error(`Unable to load templates (${response.status})`);
        }

        const result = (await response.json()) as TemplateResponse;

        if (controller.signal.aborted) return;

        setRows(Array.isArray(result.items) ? result.items : []);

        setStats({
          total: Number(result.stats?.total) || 0,

          matching: Number(result.stats?.matching) || 0,
        });
      } catch (error) {
        if (!controller.signal.aborted) {
          setRows([]);

          toast.error(
            error instanceof Error ? error.message : "Unable to load templates",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => controller.abort();
  }, [page, limit, debouncedQuery, sort, refreshKey]);

  const current = Math.min(
    page,

    Math.max(
      1,

      Math.ceil(stats.matching / limit),
    ),
  );

  const visible = rows;

  const uniqueFields = useMemo(() => {
    const seen = new Set<string>();

    return fields.filter((field) => {
      const key = field.name.trim().toLowerCase();

      if (seen.has(key)) return false;

      seen.add(key);

      return true;
    });
  }, [fields]);

  const getNoMeasurementSize = (row: Template) => {
    const fieldId = row.qualityChecks?.noMeasurementFieldId;

    return fields.find((field) => field.id === fieldId)?.name || "No Size";
  };

  async function save() {
    if (!editing) return;

    const name = editing.name.trim();

    if (!name) {
      toast.error("Template name is required");

      return;
    }

    if (!editing.categoryId) {
      toast.error("Select a category");

      return;
    }

    if (!categories.some((category) => category.id === editing.categoryId)) {
      toast.error("Selected category is unavailable");

      return;
    }

    const none = isNoMeasurement(editing);

    if (none) {
      const validNoMeasurementField = fields.some(
        (field) =>
          field.id === editing.noMeasurementFieldId &&
          ["no size", "free size"].includes(field.name.trim().toLowerCase()),
      );

      if (!validNoMeasurementField) {
        toast.error("Select No Size or Free Size from Measurement Fields");

        return;
      }
    } else {
      if (!editing.sizes.length) {
        toast.error("Add at least one size");

        return;
      }

      if (!editing.fieldIds.length) {
        toast.error("Select at least one measurement field");

        return;
      }

      if (
        editing.fieldIds.some((id) => !fields.some((field) => field.id === id))
      ) {
        toast.error("A selected measurement field is unavailable");

        return;
      }
    }

    setBusy(true);

    try {
      const { noMeasurementFieldId, noMeasurementText, ...templateData } =
        editing;
      await saveEntity("templates", {
        ...templateData,
        id: editing.id || undefined,
        name,
        sizes: none ? [] : editing.sizes,
        fieldIds: none ? [] : editing.fieldIds,
        qualityChecks: {
          ...(editing.qualityChecks || {}),
          noMeasurementFieldId: none ? noMeasurementFieldId : "",
          noMeasurementText: none ? noMeasurementText : "",
        },
      });

      toast.success(editing.id ? "Template updated" : "Template created");

      setEditing(null);

      reload();
    } catch (error: unknown) {
      toast.error(readableError(error), {
        duration: 6000,
        style: { maxWidth: "480px", whiteSpace: "pre-line" },
      });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!deleting) return;

    setBusy(true);

    try {
      await deleteEntity(
        "templates",

        deleting.id,
      );

      toast.success("Template deleted");

      setDeleting(null);

      reload();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete template",
      );
    } finally {
      setBusy(false);
    }
  }

  const actions = (row: Template) => (
    <div className="flex justify-end gap-2">
      <button
        type="button"
        title="Preview template"
        aria-label={`Preview ${row.name}`}
        onClick={() => setPreviewing(row)}
        className="rounded-lg border border-slate-200 p-2 text-sky-700 hover:bg-sky-50"
      >
        <Eye size={16} />
      </button>

      {can("edit") && (
        <button
          type="button"
          title="Edit"
          aria-label={`Edit ${row.name}`}
          onClick={() => setEditing(normalizeDraft(row))}
          className="rounded-lg border border-slate-200 p-2 text-indigo-700 hover:bg-indigo-50"
        >
          <Pencil size={16} />
        </button>
      )}

      {can("delete") && (
        <button
          type="button"
          title="Delete"
          aria-label={`Delete ${row.name}`}
          onClick={() => setDeleting(row)}
          className="rounded-lg border border-red-100 p-2 text-red-600 hover:bg-red-50"
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* PAGE HEADER */}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[.2em] text-indigo-600">
            Catalog management
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Measurement Templates
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Manage size charts, no-measurement templates and quality checks.
          </p>
        </div>

        {can("create") && (
          <button
            type="button"
            disabled={optionsLoading}
            onClick={() => setEditing(defaultDraft())}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50"
          >
            <Plus size={18} />
            Create Template
          </button>
        )}
      </div>

      {/* STATS */}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-500">
              Total Templates
            </span>

            <span className="rounded-xl bg-indigo-100 p-3 text-indigo-700">
              <ClipboardList size={20} />
            </span>
          </div>

          <p className="mt-2 text-3xl font-extrabold text-slate-900">
            {loading ? "…" : stats.total}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-500">
              Matching Search
            </span>

            <span className="rounded-xl bg-indigo-100 p-3 text-indigo-700">
              <Search size={20} />
            </span>
          </div>

          <p className="mt-2 text-3xl font-extrabold text-slate-900">
            {loading ? "…" : stats.matching}
          </p>
        </div>
      </div>

      {/* TEMPLATE DIRECTORY */}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 p-5">
          <h2 className="text-lg font-bold text-slate-900">
            Template Directory
          </h2>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 text-slate-400">
              <Search size={17} />

              <input
                aria-label="Search templates"
                className="w-40 bg-transparent py-2.5 text-sm text-slate-800 outline-none sm:w-52"
                placeholder="Search templates..."
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);

                  setPage(1);
                }}
              />
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3">
              <ArrowUpDown size={15} className="text-slate-400" />

              <select
                aria-label="Sort templates"
                className="bg-transparent py-2.5 text-sm outline-none"
                value={sort}
                onChange={(event) => {
                  setSort(event.target.value);

                  setPage(1);
                }}
              >
                <option value="newest">Newest first</option>

                <option value="oldest">Oldest first</option>

                <option value="az">Name A–Z</option>

                <option value="za">Name Z–A</option>
              </select>
            </div>

            <div className="flex rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                aria-label="List view"
                onClick={() => setView("list")}
                className={`rounded-lg p-2 ${
                  view === "list"
                    ? "bg-white text-indigo-700 shadow-sm"
                    : "text-slate-500"
                }`}
              >
                <List size={18} />
              </button>

              <button
                type="button"
                aria-label="Grid view"
                onClick={() => setView("grid")}
                className={`rounded-lg p-2 ${
                  view === "grid"
                    ? "bg-white text-indigo-700 shadow-sm"
                    : "text-slate-500"
                }`}
              >
                <Grid2X2 size={18} />
              </button>
            </div>

            <button
              type="button"
              aria-label="Refresh templates"
              title="Refresh"
              onClick={reload}
              className="rounded-xl border border-slate-200 p-2.5 text-slate-500 hover:bg-slate-50"
            >
              <RefreshCcw
                size={16}
                className={loading || optionsLoading ? "animate-spin" : ""}
              />
            </button>
          </div>
        </div>

        {/* LOADING SKELETON */}

        {loading ? (
          <div
            className="space-y-3 p-6"
            role="status"
            aria-label="Loading templates"
          >
            <div className="flex items-center justify-center gap-2 text-indigo-700">
              <Loader2 className="animate-spin" size={20} />
              Loading templates...
            </div>

            {Array.from(
              { length: 5 },

              (_, index) => (
                <div
                  key={index}
                  className="h-12 animate-pulse rounded-lg bg-slate-100"
                />
              ),
            )}
          </div>
        ) : !visible.length ? (
          <div className="p-12 text-center text-sm text-slate-500">
            No templates found.
          </div>
        ) : view === "list" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-6 py-4">Template Name</th>

                  <th className="px-6 py-4">Category</th>

                  <th className="px-6 py-4">Sizes</th>

                  <th className="px-6 py-4">Fields</th>

                  <th className="px-6 py-4">Status</th>

                  <th className="px-6 py-4">Created</th>

                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>

              <tbody>
                {visible.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-slate-100 hover:bg-indigo-50/40"
                  >
                    <td className="px-6 py-4 font-semibold text-slate-800">
                      <span className="inline-flex items-center gap-3">
                        <span className="rounded-xl bg-indigo-100 p-2.5 text-indigo-700">
                          <ClipboardList size={18} />
                        </span>

                        {row.name}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-slate-600">
                      {row.category?.name ||
                        categories.find(
                          (category) => category.id === row.categoryId,
                        )?.name ||
                        "—"}
                    </td>

                    <td className="px-6 py-4 text-slate-600">
                      {noMeasurement(row) ? (
                        <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                          {getNoMeasurementSize(row)}
                        </span>
                      ) : (
                        (row.sizes || []).join(", ") || "—"
                      )}
                    </td>

                    <td className="px-6 py-4 text-slate-600">
                      {noMeasurement(row)
                        ? "—"
                        : (row.fields?.length ?? row.fieldIds?.length ?? 0)}
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          statusColor[row.status] || statusColor.DRAFT
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-slate-500">
                      {dateOf(row.createdAt)}
                    </td>

                    <td className="px-6 py-4">{actions(row)}</td>
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
                  <span className="rounded-xl bg-indigo-100 p-3 text-indigo-700">
                    <ClipboardList size={23} />
                  </span>

                  {actions(row)}
                </div>

                <h3 className="mt-5 text-lg font-bold text-slate-900">
                  {row.name}
                </h3>

                <p className="mt-2 text-sm text-slate-500">
                  {row.category?.name ||
                    categories.find(
                      (category) => category.id === row.categoryId,
                    )?.name ||
                    "Uncategorized"}
                </p>

                <p className="mt-2 text-xs text-slate-500">
                  {noMeasurement(row)
                    ? getNoMeasurementSize(row)
                    : `${
                        row.fields?.length ?? row.fieldIds?.length ?? 0
                      } fields · ${(row.sizes || []).length} sizes`}
                </p>

                <div className="mt-4 flex items-center justify-between">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      statusColor[row.status] || statusColor.DRAFT
                    }`}
                  >
                    {row.status}
                  </span>

                  <span className="text-xs text-slate-400">
                    {dateOf(row.createdAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* PAGINATION */}

        <div className="border-t border-slate-100 px-5 pb-4">
          <Pagination
            page={current}
            setPage={setPage}
            total={stats.matching}
            limit={limit}
            setLimit={setLimit}
          />
        </div>
      </section>

      {/* MODALS */}

      {portalReady &&
        previewing &&
        createPortal(
          <TemplatePreviewModal
            template={previewing}
            fields={fields}
            onClose={() => setPreviewing(null)}
          />,

          document.body,
        )}

      {portalReady &&
        editing &&
        createPortal(
          <TemplateFormModal
            value={editing}
            onChange={setEditing}
            categories={categories}
            fields={uniqueFields}
            busy={busy}
            onCancel={() => {
              if (!busy) setEditing(null);
            }}
            onSave={() => void save()}
          />,

          document.body,
        )}

      {portalReady &&
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
