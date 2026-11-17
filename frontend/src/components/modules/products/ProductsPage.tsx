"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  lazy,
  Suspense,
  useState,
  type ReactNode,
} from "react";

import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Grid2X2,
  Image as ImageIcon,
  LayoutList,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
  Package,
  SearchCheck,
} from "lucide-react";

import toast from "react-hot-toast";

import { createPortal } from "react-dom";

import { useAccount } from "@/components/Shell";

import { api, saveEntity, deleteEntity } from "@/lib/client-api";

import SearchableDropdown from "./SearchableDropdown";

import ImageUpload from "@/components/shared/ImageUpload";

import {
  MEASUREMENT_VALUE_MESSAGE,
  isValidMeasurementValue,
  measurementText,
  normalizeMeasurementValue,
} from "@/lib/measurement";

import { EMPTY, localDateInput } from "@/lib/format";
import { EscapeKey } from "@/lib/useEscapeKey";

const ProductPreviewModal = lazy(() => import("./ProductPreviewModal"));

type Field = {
  fieldId: string;

  field?: { name: string; unit?: { name: string; symbol: string } | null };

  order?: number;
};

type Template = {
  id: string;

  name: string;

  categoryId: string;

  status?: string;

  sizes?: string[];
  noMeasurementFieldId?: string | null;
  noMeasurementText?: string | null;

  fields?: Field[];
};

type Category = { id: string; name: string };
type SupplierOption = {
  id: string;
  name: string;
  code: string;
  status: string;
};

type Measurement = { size: string; fieldId: string; value: string };

type Product = {
  id: string;

  sn: string;

  code?: string | null;

  itemName: string;

  categoryId: string;

  templateId?: string | null;

  category?: Category;

  template?: Template;

  images?: Array<{ url: string; order?: number } | string>;

  measurements?: Measurement[];

  pp?: string | null;

  sp?: string | null;

  supplierId?: string | null;
  supplierCode?: string | null;
  supplier?: { id: string; name: string; code: string } | null;

  wp?: string | null;

  fabric?: string | null;

  notes?: string | null;
  noSizeText?: string | null;

  createdAt?: string;
};

type Draft = {
  id?: string;

  sn?: string;

  supplierId: string;

  itemName: string;

  categoryId: string;

  templateId: string;

  pp: string;

  sp: string;

  wp: string;

  fabric: string;

  notes: string;

  noSizeText: string;

  images: string[];

  measurements: Measurement[];
};

const emptyDraft = (): Draft => ({
  supplierId: "",

  itemName: "",

  categoryId: "",

  templateId: "",

  pp: "",

  sp: "",

  wp: "",

  fabric: "",

  notes: "",

  noSizeText: "",

  images: [],

  measurements: [],
});

const getImages = (p: Product) =>
  (p.images || []).map((x) => (typeof x === "string" ? x : x.url));

const dateLabel = (s?: string) => (s ? new Date(s).toLocaleDateString() : "-");

// Local calendar date, so the From/To filter matches the date shown in the list.
const asDate = (s?: string) => (s ? localDateInput(new Date(s)) : "");

function ModalPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(children, document.body);
}

type ListResponse<T> =
  | T[]
  | {
      items?: T[];
      data?: T[];
      pagination?: { totalPages?: number; total?: number; limit?: number };
    };
function unwrapItems<T>(result: ListResponse<T>): T[] {
  if (Array.isArray(result)) return result;
  return Array.isArray(result?.items)
    ? result.items
    : Array.isArray(result?.data)
      ? result.data
      : [];
}
async function loadAll<T>(endpoint: string): Promise<T[]> {
  const first = await api<ListResponse<T>>(`${endpoint}?page=1&limit=50`);
  const items = unwrapItems(first);
  if (Array.isArray(first)) return items;
  const pages = Math.min(
    200,
    Math.max(
      1,
      Number(first.pagination?.totalPages) ||
        Math.ceil(
          (Number(first.pagination?.total) || items.length) /
            (Number(first.pagination?.limit) || 50),
        ),
    ),
  );
  for (let p = 2; p <= pages; p++) {
    const next = await api<ListResponse<T>>(`${endpoint}?page=${p}&limit=50`);
    items.push(...unwrapItems(next));
  }
  return Array.from(
    new Map(items.map((item) => [(item as { id: string }).id, item])).values(),
  );
}
function readableError(error: unknown): string {
  const e = error as {
    message?: string;
    details?: { formErrors?: string[]; fieldErrors?: Record<string, string[]> };
    response?: { data?: any };
  };
  const data = e?.response?.data;
  const details = data?.details || e?.details;
  const messages = [
    ...(details?.formErrors || []),
    ...Object.entries(details?.fieldErrors || {}).flatMap(([key, value]) =>
      (value as string[]).map((v) => `${key}: ${v}`),
    ),
  ];
  if (messages.length) return messages.join("; ");
  const msg = data?.error || e?.message;
  return msg && msg !== "Validation failed"
    ? msg
    : "Please check the required fields and try again.";
}

export default function ProductsPage() {
  const account = useAccount();

  const has = (action: string) =>
    account.permissions.includes("*") ||
    account.permissions.includes(`products.${action}`);

  const [products, setProducts] = useState<Product[]>([]);

  const [categories, setCategories] = useState<Category[]>([]);

  const [templates, setTemplates] = useState<Template[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);

  const [loading, setLoading] = useState(true);
  const [optionsError, setOptionsError] = useState("");
  const [formError, setFormError] = useState("");

  const [busy, setBusy] = useState(false);

  const [uploading, setUploading] = useState(false);

  const [search, setSearch] = useState("");

  const [from, setFrom] = useState("");

  const [to, setTo] = useState("");

  const [sort, setSort] = useState("newest");

  const [view, setView] = useState<"list" | "grid">("list");

  const [page, setPage] = useState(1);

  const [limit, setLimit] = useState(10);

  const [draft, setDraft] = useState<Draft | null>(null);

  const [nextSn, setNextSn] = useState("Loading...");
  const [nextSupplierCode, setNextSupplierCode] = useState("Select supplier");

  const [preview, setPreview] = useState<Product | null>(null);

  const [imageViewer, setImageViewer] = useState<{
    images: string[];

    index: number;
  } | null>(null);

  const [deleting, setDeleting] = useState<Product | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setOptionsError("");
    const results = await Promise.allSettled([
      loadAll<Product>("products"),
      loadAll<Category>("categories"),
      loadAll<Template>("templates"),
      loadAll<SupplierOption>("suppliers"),
    ]);
    const [p, c, t, s] = results;
    if (p.status === "fulfilled") setProducts(p.value);
    else toast.error(`Products: ${readableError(p.reason)}`);
    if (c.status === "fulfilled") setCategories(c.value);
    else setOptionsError(`Categories: ${readableError(c.reason)}`);
    if (t.status === "fulfilled") setTemplates(t.value);
    else
      setOptionsError((old) =>
        [old, `Templates: ${readableError(t.reason)}`]
          .filter(Boolean)
          .join(" | "),
      );
    if (s.status === "fulfilled")
      setSuppliers(s.value.filter((supplier) => supplier.status === "ACTIVE"));
    else toast.error(`Suppliers: ${readableError(s.reason)}`);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const filtered = useMemo(
    () =>
      products

        .filter((p) => {
          const q = search.trim().toLowerCase();

          const text = [
            p.sn,

            p.supplierCode,
            p.supplier?.name,

            p.itemName,

            p.category?.name,

            p.template?.name,

            p.fabric,

            p.pp,

            p.sp,

            p.wp,
          ]

            .join(" ")

            .toLowerCase();

          const date = asDate(p.createdAt);

          return (
            (!q || text.includes(q)) &&
            (!from || date >= from) &&
            (!to || date <= to)
          );
        })

        .sort((a, b) =>
          sort === "oldest"
            ? new Date(a.createdAt || 0).getTime() -
              new Date(b.createdAt || 0).getTime()
            : sort === "name"
              ? a.itemName.localeCompare(b.itemName)
              : new Date(b.createdAt || 0).getTime() -
                new Date(a.createdAt || 0).getTime(),
        ),

    [products, search, from, to, sort],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / limit));

  const currentPage = Math.min(page, totalPages);

  const visible = filtered.slice(
    (currentPage - 1) * limit,

    currentPage * limit,
  );

  const update = (key: keyof Draft, value: any) =>
    setDraft((d) => {
      if (!d) return d;

      if (key === "categoryId" && d.categoryId !== value)
        return {
          ...d,
          categoryId: value,
          templateId: "",
          measurements: [],
          noSizeText: "",
        };

      if (key === "templateId" && d.templateId !== value)
        return { ...d, templateId: value, measurements: [], noSizeText: "" };

      return { ...d, [key]: value };
    });

  const openCreate = () => {
    setFormError("");
    setDraft(emptyDraft());
    setNextSn("Loading...");
    setNextSupplierCode("Select supplier");
  };

  // Preview only: final unique codes are allocated atomically on save.
  useEffect(() => {
    if (!draft || draft.id) return;
    let cancelled = false;
    const loadCodes = async () => {
      setNextSn("Loading...");
      setNextSupplierCode(draft.supplierId ? "Loading..." : "Select supplier");
      try {
        const query = new URLSearchParams();
        if (draft.supplierId) query.set("supplierId", draft.supplierId);
        const data = await api<{
          productCode: string | null;
          supplierCode: string | null;
        }>(`products/preview-codes?${query.toString()}`);
        if (cancelled) return;
        setNextSn(data.productCode || "Not configured");
        setNextSupplierCode(data.supplierCode || "Select supplier");
      } catch {
        if (cancelled) return;
        setNextSn("Preview unavailable");
        setNextSupplierCode(
          draft.supplierId ? "Preview unavailable" : "Select supplier",
        );
      }
    };
    void loadCodes();
    return () => {
      cancelled = true;
    };
  }, [draft?.id, draft?.supplierId]);

  const openEdit = (p: Product) => {
    setFormError("");
    setDraft({
      id: p.id,

      sn: p.sn,

      supplierId: p.supplierId || "",

      itemName: p.itemName,

      categoryId: p.categoryId,

      templateId: p.templateId || "",

      pp: p.pp || "",

      sp: p.sp || "",

      wp: p.wp || "",

      fabric: p.fabric || "",

      notes: p.notes || "",

      noSizeText: p.noSizeText || "",

      images: getImages(p),

      measurements: (p.measurements || []).map((m) => ({
        size: m.size,

        fieldId: m.fieldId,

        value: measurementText(m.value),
      })),
    });
  };

  const chosen = templates.find((t) => t.id === draft?.templateId);

  const options = templates.filter(
    (t) => t.categoryId === draft?.categoryId && t.status !== "ARCHIVED",
  );

  const setMeasurement = (size: string, fieldId: string, text: string) =>
    setDraft((d) => {
      if (!d) return d;

      const rest = d.measurements.filter(
        (m) => !(m.size === size && m.fieldId === fieldId),
      );

      return {
        ...d,

        measurements:
          text.trim() === "" ? rest : [...rest, { size, fieldId, value: text }],
      };
    });

  const measurementValue = (size: string, fieldId: string) =>
    draft?.measurements.find((m) => m.size === size && m.fieldId === fieldId)
      ?.value ?? "";

  const save = async () => {
    if (!draft || busy) return;
    setFormError("");
    const invalid = (message: string) => {
      setFormError(message);
      toast.error(message);
    };

    if (draft.itemName.trim().length < 2) {
      invalid("Enter product name (at least 2 characters)");

      return;
    }

    if (!draft.supplierId) {
      invalid("Select a supplier");
      return;
    }

    if (!draft.categoryId) {
      invalid("Select a category");

      return;
    }

    if (!categories.some((c) => c.id === draft.categoryId)) {
      invalid(
        "Selected category is unavailable. Refresh categories and select again.",
      );
      return;
    }
    if (!draft.templateId) {
      invalid("Select a measurement template");

      return;
    }

    if (
      !templates.some(
        (t) => t.id === draft.templateId && t.categoryId === draft.categoryId,
      )
    ) {
      invalid(
        "Selected template does not belong to this category. Choose another template.",
      );
      return;
    }
    if (uploading) {
      invalid("Wait for the images to finish uploading");

      return;
    }

    if (draft.images.length > 15) {
      invalid("Maximum 15 images allowed");

      return;
    }

    const measurements = draft.measurements.map((m) => ({
      ...m,
      value: normalizeMeasurementValue(m.value),
    }));

    if (measurements.some((m) => !isValidMeasurementValue(m.value))) {
      setDraft((d) => (d ? { ...d, measurements } : d));
      invalid(`Fix the highlighted measurements. ${MEASUREMENT_VALUE_MESSAGE}`);

      return;
    }

    setBusy(true);

    try {
      const { sn: _sn, ...payload } = draft;
      await saveEntity("products", { ...payload, measurements });

      toast.success(draft.id ? "Product updated" : "Product created");

      setDraft(null);

      await reload();
    } catch (e: any) {
      const message = readableError(e);
      setFormError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!deleting || busy) return;

    setBusy(true);

    try {
      await deleteEntity("products", deleting.id);

      toast.success("Product deleted");

      setDeleting(null);

      await reload();
    } catch (e: any) {
      toast.error(readableError(e));
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setSearch("");

    setFrom("");

    setTo("");

    setSort("newest");

    setPage(1);
  };

  const thumb = (p: Product) => {
    const images = getImages(p);

    return images.length ? (
      <button
        type="button"
        onClick={() => setImageViewer({ images, index: 0 })}
        className="flex items-center gap-2 text-left"
      >
        <img
          loading="lazy"
          decoding="async"
          src={images[0]}
          alt={p.itemName}
          className="h-12 w-12 rounded-xl border border-slate-200 object-cover"
        />

        {images.length > 1 && (
          <span className="rounded-lg bg-violet-50 px-2 py-1 text-xs font-bold text-violet-700">
            +{images.length - 1}
          </span>
        )}
      </button>
    ) : (
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
        <ImageIcon size={19} />
      </div>
    );
  };

  const actions = (p: Product) => (
    <div className="flex items-center gap-1.5">
      <button
        title="Preview"
        aria-label="Preview"
        onClick={() => setPreview(p)}
        className="rounded-lg border border-sky-200 p-2 text-sky-600 hover:bg-sky-50"
      >
        <Eye size={17} />
      </button>

      {has("edit") && (
        <button
          title="Edit"
          aria-label="Edit"
          onClick={() => openEdit(p)}
          className="rounded-lg border border-violet-200 p-2 text-violet-600 hover:bg-violet-50"
        >
          <Pencil size={17} />
        </button>
      )}

      {has("delete") && (
        <button
          title="Delete"
          aria-label="Delete"
          onClick={() => setDeleting(p)}
          className="rounded-lg border border-red-200 p-2 text-red-500 hover:bg-red-50"
        >
          <Trash2 size={17} />
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-6 pb-8">
      {optionsError && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {optionsError}{" "}
          <button
            type="button"
            onClick={() => void reload()}
            className="ml-2 font-bold underline"
          >
            Retry
          </button>
        </div>
      )}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[.2em] text-violet-600">
            Catalog Management
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            Products / Styles
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Manage garment styles, images and size measurements
          </p>
        </div>

        {has("create") && (
          <button
            onClick={() => void openCreate()}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 font-semibold text-white shadow-sm hover:bg-violet-700"
          >
            <Plus size={18} /> Create Product
          </button>
        )}
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Total Products */}
        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <p className="text-sm font-medium text-slate-500">Total Products</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {products.length}
            </p>
          </div>

          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100">
            <Package size={24} className="text-violet-600" />
          </div>
        </div>

        {/* Matching Search */}
        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <p className="text-sm font-medium text-slate-500">
              Matching Search
            </p>
            <p className="mt-2 text-3xl font-bold text-violet-700">
              {filtered.length}
            </p>
          </div>

          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
            <SearchCheck size={24} className="text-blue-600" />
          </div>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
          <div className="flex w-full min-w-0 flex-nowrap items-center gap-4 overflow-x-auto pb-1">
            <div className="min-w-[170px] shrink-0">
              <h2 className="font-bold text-slate-900">Product Directory</h2>
            </div>
            <div className="ml-auto flex min-w-max shrink-0 items-center gap-2">
              <label className="flex w-[220px] shrink-0 items-center gap-2 rounded-xl border border-slate-200 px-3">
                <Search size={17} className="shrink-0 text-slate-400" />
                <input
                  aria-label="Search products"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search products..."
                  className="w-full min-w-0 bg-transparent py-2.5 text-sm outline-none"
                />
              </label>
              <label className="flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs text-slate-500">
                From
                <input
                  type="date"
                  value={from}
                  onChange={(e) => {
                    setFrom(e.target.value);
                    setPage(1);
                  }}
                  className="bg-transparent py-2.5 text-sm text-slate-700"
                />
              </label>
              <label className="flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs text-slate-500">
                To
                <input
                  type="date"
                  min={from || undefined}
                  value={to}
                  onChange={(e) => {
                    setTo(e.target.value);
                    setPage(1);
                  }}
                  className="bg-transparent py-2.5 text-sm text-slate-700"
                />
              </label>
              <select
                aria-label="Sort products"
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value);
                  setPage(1);
                }}
                className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="name">Item Name A-Z</option>
              </select>
              <button
                type="button"
                title="Refresh data"
                aria-label="Refresh data"
                onClick={() => void reload()}
                className="shrink-0 rounded-xl border border-slate-200 p-2.5 text-slate-600 hover:bg-slate-50"
              >
                <RefreshCw size={17} />
              </button>
              <button
                type="button"
                title="Reset filters"
                onClick={reset}
                className="shrink-0 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                Reset
              </button>
              <div className="flex shrink-0 overflow-hidden rounded-xl border border-slate-200">
                <button
                  type="button"
                  title="List view"
                  aria-label="List view"
                  onClick={() => setView("list")}
                  className={`p-2.5 ${view === "list" ? "bg-violet-100 text-violet-700" : "text-slate-500"}`}
                >
                  <LayoutList size={18} />
                </button>
                <button
                  type="button"
                  title="Grid view"
                  aria-label="Grid view"
                  onClick={() => setView("grid")}
                  className={`p-2.5 ${view === "grid" ? "bg-violet-100 text-violet-700" : "text-slate-500"}`}
                >
                  <Grid2X2 size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
        {loading ? (
          <div role="status" className="space-y-3 p-5">
            <div className="flex items-center justify-center gap-2 text-violet-700">
              <Loader2 className="animate-spin" size={18} />
              Loading products...
            </div>
            {Array.from({ length: 5 }, (_, i) => (
              <div
                key={i}
                className="h-12 animate-pulse rounded-lg bg-slate-100"
              />
            ))}
          </div>
        ) : view === "list" ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  {[
                    "Code",

                    "Supplier Code",

                    "Supplier Name",

                    "Image",

                    "Product Name",

                    "Category",

                    "Template",

                    "PP",

                    "SP",

                    "Created",

                    "Actions",
                  ].map((h) => (
                    <th key={h} className="px-4 py-4 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {visible.map((p) => (
                  <tr
                    key={p.id}
                    className="border-t border-slate-100 hover:bg-violet-50/30"
                  >
                    <td className="px-4 py-3 font-bold text-violet-700">
                      {p.sn}
                    </td>

                    <td className="px-4 py-3">{p.supplierCode || "-"}</td>
                    <td className="px-4 py-3">{p.supplier?.name || "-"}</td>

                    <td className="px-4 py-3">{thumb(p)}</td>

                    <td className="px-4 py-3 font-semibold text-slate-800">
                      {p.itemName}
                    </td>

                    <td className="px-4 py-3">{p.category?.name || "-"}</td>

                    <td className="px-4 py-3">{p.template?.name || "-"}</td>

                    <td className="px-4 py-3">{p.pp?.trim() || EMPTY}</td>

                    <td className="px-4 py-3">{p.sp?.trim() || EMPTY}</td>

                    <td className="px-4 py-3 text-slate-500">
                      {dateLabel(p.createdAt)}
                    </td>

                    <td className="px-4 py-3">{actions(p)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visible.map((p) => (
              <div
                key={p.id}
                className="overflow-hidden rounded-2xl border border-slate-200"
              >
                <button
                  className="flex h-44 w-full items-center justify-center bg-slate-50"
                  onClick={() =>
                    getImages(p).length
                      ? setImageViewer({ images: getImages(p), index: 0 })
                      : setPreview(p)
                  }
                >
                  {getImages(p).length ? (
                    <img
                      loading="lazy"
                      decoding="async"
                      src={getImages(p)[0]}
                      alt={p.itemName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="text-slate-300" size={32} />
                  )}
                </button>

                <div className="space-y-2 p-4">
                  <div className="flex justify-between gap-2">
                    <strong className="truncate">{p.itemName}</strong>

                    <span className="text-xs text-violet-700">{p.sn}</span>
                  </div>

                  <p className="text-xs text-slate-500">
                    {p.supplierCode || "No supplier code"} ·{" "}
                    {p.category?.name || "-"}
                  </p>

                  <p className="truncate text-xs text-slate-500">
                    {p.template?.name || "-"}
                  </p>

                  {actions(p)}
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && visible.length === 0 && (
          <div className="p-12 text-center text-slate-500">
            No matching products found
          </div>
        )}

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t p-4 text-sm text-slate-500">
          <span>
            Showing {filtered.length ? (currentPage - 1) * limit + 1 : 0}-
            {Math.min(currentPage * limit, filtered.length)} of{" "}
            {filtered.length}
          </span>

          <div className="flex items-center gap-3">
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));

                setPage(1);
              }}
              className="rounded-lg border px-2 py-1"
            >
              <option value={10}>10 rows</option>

              <option value={20}>20 rows</option>

              <option value={50}>50 rows</option>
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

      {draft && (
        <ModalPortal>
          <EscapeKey onEscape={() => !busy && setDraft(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3">
            <div className="flex max-h-[94vh] w-full max-w-[1100px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex shrink-0 items-center justify-between border-b px-6 py-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-violet-600">
                    Catalog Management
                  </p>

                  <h2 className="text-xl font-bold">
                    {draft.id ? "Edit Product" : "Create Product"}
                  </h2>
                </div>

                <button
                  disabled={busy}
                  onClick={() => setDraft(null)}
                  className="rounded-lg p-2 hover:bg-slate-100"
                >
                  <X />
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();

                  void save();
                }}
                className="flex min-h-0 flex-1 flex-col"
              >
                <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6">
                  {formError && (
                    <div
                      role="alert"
                      className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                    >
                      {formError}
                    </div>
                  )}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm font-semibold text-slate-700">
                      Product Name <span className="text-red-500">*</span>
                      <input
                        value={draft.itemName}
                        onChange={(e) => update("itemName", e.target.value)}
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 font-normal"
                      />
                    </label>
                    <label className="block text-sm font-semibold text-slate-700">
                      Code (Auto-generated)
                      <input
                        readOnly
                        value={draft.sn || nextSn}
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-100 p-3 font-normal"
                      />
                    </label>
                    <SearchableDropdown
                      label="Supplier Name"
                      required
                      value={draft.supplierId}
                      options={suppliers.map((s) => ({
                        id: s.id,
                        name: s.name,
                      }))}
                      onChange={(id) => update("supplierId", id)}
                      placeholder="Search supplier"
                    />
                    <label className="block text-sm font-semibold text-slate-700">
                      Supplier Code (Auto-generated)
                      <input
                        readOnly
                        value={
                          draft.id
                            ? draft.supplierId ===
                              products.find((p) => p.id === draft.id)
                                ?.supplierId
                              ? products.find((p) => p.id === draft.id)
                                  ?.supplierCode || "Not assigned"
                              : "New code assigned on update"
                            : nextSupplierCode
                        }
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-100 p-3 font-normal"
                      />
                    </label>

                    <SearchableDropdown
                      label="Category"
                      required
                      value={draft.categoryId}
                      options={categories}
                      onChange={(id) => update("categoryId", id)}
                      placeholder={
                        loading
                          ? "Loading categories..."
                          : categories.length
                            ? "Search category"
                            : "No categories available"
                      }
                    />

                    <SearchableDropdown
                      label="Template"
                      required
                      value={draft.templateId}
                      options={options}
                      disabled={!draft.categoryId}
                      onChange={(id) => update("templateId", id)}
                      placeholder={
                        loading
                          ? "Loading templates..."
                          : !draft.categoryId
                            ? "Select category first"
                            : "Search template"
                      }
                    />

                    {(
                      [
                        ["pp", "PP"],
                        ["sp", "SP"],
                        ["fabric", "Fabric"],
                        ["wp", "WP"],
                        ["notes", "Notes"],
                      ] as const
                    ).map(([key, label]) => (
                      <label
                        key={key}
                        className={`block text-sm font-semibold text-slate-700 ${key === "notes" ? "sm:col-span-2" : ""}`}
                      >
                        {label}

                        {key === "notes" ? (
                          <textarea
                            value={draft[key]}
                            onChange={(e) => update(key, e.target.value)}
                            rows={3}
                            className="mt-2 w-full rounded-xl border p-3 font-normal"
                          />
                        ) : (
                          <input
                            value={draft[key]}
                            onChange={(e) => update(key, e.target.value)}
                            className="mt-2 w-full rounded-xl border p-3 font-normal"
                          />
                        )}
                      </label>
                    ))}
                  </div>

                  <section className="rounded-2xl border p-4">
                    <h3 className="mb-3 font-bold">
                      Product Images ({draft.images.length}/15)
                    </h3>

                    <ImageUpload
                      value={draft.images}
                      onChange={(images) => update("images", images)}
                      max={15}
                      hint="JPG, PNG or WebP up to 5 MB. Saved as WebP (about 50-70 KB)."
                      disabled={busy}
                      onBusyChange={setUploading}
                      onOpen={(index) =>
                        setImageViewer({ images: draft.images, index })
                      }
                    />
                  </section>

                  <section>
                    <h3 className="mb-3 font-bold">Size Measurements</h3>

                    {!chosen ? (
                      <p className="text-sm text-slate-500">
                        Select category and template to enter measurements.
                      </p>
                    ) : (chosen.sizes || []).length === 0 &&
                      (chosen.fields || []).length === 0 ? (
                      <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-100">
                            <tr>
                              <th className="w-1/4 border border-slate-200 p-3 text-left">
                                SIZE TAG
                              </th>
                              <th className="border border-slate-200 p-3 text-left">
                                TEXT
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td className="border border-slate-200 p-3 font-semibold">
                                {chosen.noMeasurementFieldId
                                  ? "No Size / Free Size"
                                  : "No Size"}
                              </td>
                              <td className="border border-slate-200 p-2">
                                <textarea
                                  rows={2}
                                  maxLength={2000}
                                  value={draft.noSizeText}
                                  onChange={(e) =>
                                    update("noSizeText", e.target.value)
                                  }
                                  placeholder="Enter text for this product"
                                  className="w-full rounded-lg border border-slate-200 p-2 outline-none focus:border-violet-500"
                                />
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border">
                        <table className="w-full min-w-max text-sm">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="p-3 text-left">Size</th>

                              {(chosen.fields || []).map((f) => (
                                <th key={f.fieldId} className="p-3 text-left">
                                  {f.field?.name || f.fieldId}

                                  {f.field?.unit?.symbol ? ` (${f.field.unit.symbol})` : ""}
                                </th>
                              ))}
                            </tr>
                          </thead>

                          <tbody>
                            {(chosen.sizes || []).map((size) => (
                              <tr key={size} className="border-t">
                                <td className="p-3 font-bold">{size}</td>

                                {(chosen.fields || []).map((f) => {
                                  const value = measurementValue(
                                    size,
                                    f.fieldId,
                                  );
                                  const bad =
                                    value !== "" &&
                                    !isValidMeasurementValue(
                                      normalizeMeasurementValue(value),
                                    );
                                  return (
                                    <td
                                      key={f.fieldId}
                                      className="p-2 align-top"
                                    >
                                      <input
                                        type="text"
                                        inputMode="decimal"
                                        maxLength={20}
                                        aria-label={`${size} ${f.field?.name || "measurement"}`}
                                        aria-invalid={bad}
                                        className={`w-28 rounded-lg border px-2 py-2 outline-none ${
                                          bad
                                            ? "border-red-500 bg-red-50 focus:border-red-600"
                                            : "focus:border-violet-500"
                                        }`}
                                        value={value}
                                        onChange={(e) =>
                                          setMeasurement(
                                            size,
                                            f.fieldId,
                                            e.target.value,
                                          )
                                        }
                                        onBlur={(e) =>
                                          setMeasurement(
                                            size,
                                            f.fieldId,
                                            normalizeMeasurementValue(
                                              e.target.value,
                                            ),
                                          )
                                        }
                                      />
                                      {bad && (
                                        <p className="mt-1 w-28 text-[11px] leading-tight text-red-600">
                                          {MEASUREMENT_VALUE_MESSAGE}
                                        </p>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                </div>

                <div className="flex shrink-0 justify-end gap-3 border-t bg-white p-4">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setDraft(null)}
                    className="rounded-xl bg-slate-100 px-5 py-3 font-semibold"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={busy || uploading}
                    className="rounded-xl bg-violet-600 px-6 py-3 font-semibold text-white disabled:opacity-50"
                  >
                    {busy ? (
                      <>
                        <Loader2
                          size={16}
                          className="mr-2 inline animate-spin"
                        />
                        Saving...
                      </>
                    ) : draft.id ? (
                      "Update Product"
                    ) : (
                      "Save Product"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {preview && (
        <ModalPortal>
          <Suspense
            fallback={
              <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/50">
                <Loader2 className="animate-spin text-white" size={32} />
              </div>
            }
          >
            <ProductPreviewModal
              product={preview}
              onClose={() => setPreview(null)}
            />
          </Suspense>
        </ModalPortal>
      )}

      {imageViewer && (
        <ModalPortal>
          <EscapeKey onEscape={() => setImageViewer(null)} />
          <div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-4"
            onClick={() => setImageViewer(null)}
          >
            <button
              className="absolute right-5 top-5 text-white"
              onClick={() => setImageViewer(null)}
            >
              <X size={28} />
            </button>

            <button
              className="absolute left-3 rounded-full bg-white/20 p-2 text-white"
              onClick={(e) => {
                e.stopPropagation();

                setImageViewer((v) =>
                  v
                    ? {
                        ...v,

                        index:
                          (v.index - 1 + v.images.length) % v.images.length,
                      }
                    : v,
                );
              }}
            >
              <ChevronLeft />
            </button>

            <img
              onClick={(e) => e.stopPropagation()}
              src={imageViewer.images[imageViewer.index]}
              alt="Product full size"
              className="max-h-[85vh] max-w-[85vw] object-contain"
            />

            <button
              className="absolute right-3 rounded-full bg-white/20 p-2 text-white"
              onClick={(e) => {
                e.stopPropagation();

                setImageViewer((v) =>
                  v ? { ...v, index: (v.index + 1) % v.images.length } : v,
                );
              }}
            >
              <ChevronRight />
            </button>

            <span className="absolute bottom-5 text-sm text-white">
              {imageViewer.index + 1} / {imageViewer.images.length}
            </span>
          </div>
        </ModalPortal>
      )}

      {deleting && (
        <ModalPortal>
          <EscapeKey onEscape={() => !busy && setDeleting(null)} />
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
              <h2 className="text-lg font-bold">Delete Product?</h2>

              <p className="mt-2 text-sm text-slate-600">
                Delete {deleting.itemName} ({deleting.sn})? This cannot be
                undone.
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
        </ModalPortal>
      )}
    </div>
  );
}
