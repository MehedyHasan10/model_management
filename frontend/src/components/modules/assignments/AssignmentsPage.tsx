"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  RotateCcw,
  X,
  Eye,
  Trash2,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAccount } from "@/components/Shell";
import ResourcePage, { type FormProps } from "@/components/shared/ResourcePage";
import { TextField, SelectField } from "@/components/shared/FormFields";
import { api } from "@/lib/client-api";
import {
  ContentCell,
  LoadingOverlay,
  ProductCodeButton,
  useFullAssignment,
} from "./AssignmentCells";
import { localDateInput, plural } from "@/lib/format";
import { measurementText } from "@/lib/measurement";
import { useEscapeKey } from "@/lib/useEscapeKey";
import ImagePreview, { productImages } from "@/components/shared/ImagePreview";
const returnQty = (i: any) =>
  (i.returnItems || []).reduce(
    (n: number, x: any) => n + Number(x.quantity || 0),
    0,
  );
const dontWearQtyForItem = (i: any) =>
  (i.returnItems || []).reduce(
    (n: number, x: any) => n + Number(x.dontWearQty || 0),
    0,
  );
const dontWearQtyForAssignment = (r: any) =>
  (r.items || []).reduce((n: number, i: any) => n + dontWearQtyForItem(i), 0);
const sentQty = (r: any) =>
  (r.items || []).reduce((n: number, i: any) => n + Number(i.sentQty || 0), 0);
const returnedQty = (r: any) =>
  (r.items || []).reduce((n: number, i: any) => n + returnQty(i), 0);
const dateText = (value: any) =>
  value && !Number.isNaN(new Date(value).getTime())
    ? new Date(value).toLocaleDateString()
    : "-";

// Shape a model like a product so it can reuse ImagePreview.
const modelImage = (model: any) => ({
  itemName: model?.name || "Model",
  images: model?.photoUrl ? [model.photoUrl] : [],
});
const distinctProducts = (r: any) =>
  Array.from(
    new Map(
      (r.items || [])
        .filter((i: any) => i.product)
        .map((i: any) => [
          i.productId || i.product?.id || i.product?.sn,
          i.product,
        ]),
    ).values(),
  ) as any[];
const returnDate = (r: any) => {
  // ReturnTransaction.receivedAt is the actual return date.
  const dates = (r.returns || [])
    .map((x: any) => x.receivedAt)
    .filter(Boolean)
    .map((x: any) => new Date(x).getTime())
    .filter((x: number) => !Number.isNaN(x));
  return dates.length ? dateText(Math.max(...dates)) : "-";
};
function measurementFields(product: any): any[] {
  const configured = Array.isArray(product?.template?.fields)
    ? product.template.fields
    : [];
  const saved = Array.isArray(product?.measurements)
    ? product.measurements
    : [];
  const byId = new Map<string, any>();
  for (const entry of configured) {
    const fieldId = String(entry.fieldId ?? entry.field?.id ?? entry.id ?? "");
    if (fieldId) byId.set(fieldId, { ...entry, fieldId });
  }
  for (const entry of saved) {
    const fieldId = String(entry.fieldId ?? entry.field?.id ?? "");
    if (fieldId && !byId.has(fieldId))
      byId.set(fieldId, { fieldId, field: entry.field });
  }
  return [...byId.values()];
}

function measurementValue(
  product: any,
  size: unknown,
  fieldId: unknown,
): string {
  const saved = Array.isArray(product?.measurements)
    ? product.measurements
    : [];
  const found = saved.find(
    (m: any) =>
      String(m.size) === String(size) &&
      String(m.fieldId ?? m.field?.id) === String(fieldId),
  );
  const value = found?.value;
  return value === null || value === undefined || String(value).trim() === ""
    ? "-"
    : String(value);
}

function AssignmentDetailsView({
  assignment,
  onClose,
}: {
  assignment: any;
  onClose: () => void;
}) {
  const products = distinctProducts(assignment);
  useEscapeKey(onClose);
  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/60 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="View Assignment Details"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex shrink-0 items-center justify-between border-b px-5 py-4 sm:px-7">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              View Assign Details
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close details"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"
          >
            <X size={22} />
          </button>
        </header>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto bg-slate-50 p-4 sm:p-6">
          <div className="grid gap-4 rounded-xl border bg-white p-4 text-sm sm:grid-cols-4">
            <div className="flex items-center gap-2">
              {assignment.model?.photoUrl && (
                <ImagePreview
                  product={modelImage(assignment.model)}
                  className="h-10 w-10"
                  rounded="rounded-full"
                />
              )}
              <div>
                <p className="text-xs text-slate-500">Model</p>
                <b>{assignment.model?.name || "-"}</b>
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-500">Sent Date</p>
              <b>{dateText(assignment.sentDate)}</b>
            </div>
            <div>
              <p className="text-xs text-slate-500">Expected Return</p>
              <b>{dateText(assignment.expectedReturnDate)}</b>
            </div>
            <div>
              <p className="text-xs text-slate-500">Actual Return Date</p>
              <b>{returnDate(assignment)}</b>
            </div>
            {assignment.notes && (
              <div className="sm:col-span-4">
                <p className="text-xs text-slate-500">Assignment Notes</p>
                <p>{assignment.notes}</p>
              </div>
            )}
          </div>
          {products.map((product: any) => {
            const rows = (assignment.items || []).filter(
              (item: any) =>
                (item.productId || item.product?.id) === product.id,
            );
            const fields = measurementFields(product);
            return (
              <section
                key={product.id || product.sn}
                className="overflow-hidden rounded-2xl border bg-white"
              >
                <div className="flex items-center gap-4 border-b p-4">
                  <ImagePreview product={product} className="h-20 w-20" />
                  <div>
                    <h3 className="font-bold text-slate-900">
                      {product.itemName || "Product"}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Product Code: {product.sn || "-"} · Supplier Code:{" "}
                      {product.supplierCode || "-"}
                    </p>
                    <p className="text-xs text-slate-500">
                      Category: {product.category?.name || "-"} · Template:{" "}
                      {product.template?.name || "-"}
                    </p>
                  </div>
                </div>
                <div className="grid gap-3 border-b p-4 text-xs sm:grid-cols-5">
                  <div>
                    <span className="text-slate-500">Fabric</span>
                    <p className="font-semibold">{product.fabric || "-"}</p>
                  </div>
                  {(
                    [
                      ["PP", product.pp],
                      ["SP", product.sp],
                      ["WP", product.wp],
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label}>
                      <span className="text-slate-500">{label}</span>
                      <p className="font-semibold">
                        {String(value ?? "").trim() || "-"}
                      </p>
                    </div>
                  ))}
                  <div>
                    <span className="text-slate-500">Product Notes</span>
                    <p className="font-semibold">{product.notes || "-"}</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[650px] text-center text-xs">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="px-3 py-3 text-center">Size</th>
                        {fields.map((f: any) => (
                          <th
                            key={f.fieldId}
                            className="whitespace-nowrap px-3 py-3 text-center"
                          >
                            {f.field?.name || f.fieldId}
                            {f.field?.unit?.symbol ? ` (${f.field.unit.symbol})` : ""}
                          </th>
                        ))}
                        <th className="px-3 py-3 text-center">Sent</th>
                        <th className="px-3 py-3 text-center">Returned</th>
                        <th className="px-3 py-3 text-center">On Hand</th>
                        <th className="px-3 py-3 text-center">Don't Wear</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((item: any) => (
                        <tr key={item.id} className="border-t">
                          <td className="px-3 py-3 text-center font-semibold">
                            {item.size}
                          </td>
                          {fields.map((f: any) => (
                            <td
                              key={f.fieldId}
                              className="px-3 py-3 text-center"
                            >
                              {measurementValue(product, item.size, f.fieldId)}
                            </td>
                          ))}
                          <td className="px-3 py-3 text-center font-bold text-blue-600">
                            {item.sentQty}
                          </td>
                          <td className="px-3 py-3 text-center font-bold text-emerald-600">
                            {returnQty(item)}
                          </td>
                          <td className="px-3 py-3 text-center font-bold text-orange-600">
                            {Number(item.sentQty || 0) - returnQty(item)}
                          </td>
                          <td className="px-3 py-3 text-center font-bold text-violet-700">
                            {dontWearQtyForItem(item)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
          <section className="rounded-xl border bg-white p-4">
            <h3 className="mb-3 font-bold">Return History</h3>
            {(assignment.returns || []).length ? (
              <div className="space-y-3">
                {assignment.returns.map((ret: any) => (
                  <div key={ret.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex flex-wrap justify-between gap-2">
                      <b>{dateText(ret.receivedAt)}</b>
                      <span className="text-slate-500">
                        Received by: {ret.receivedBy?.name || "-"}
                      </span>
                    </div>
                    <div className="mt-1 text-slate-600">
                      {(ret.items || [])
                        .map((i: any) => {
                          const ai = (assignment.items || []).find(
                            (x: any) => x.id === i.assignmentItemId,
                          );
                          return `${ai?.product?.itemName || "Product"} (${ai?.size || "-"}): ${plural(i.quantity, "pc", "pcs")} returned · Don't Wear: ${Number(i.dontWearQty || 0)}${i.condition ? ` · ${i.condition}` : ""}`;
                        })
                        .join("; ")}
                    </div>
                    {ret.notes && (
                      <p className="mt-1 text-slate-600">Notes: {ret.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No returns recorded yet.</p>
            )}
          </section>
        </div>
        <footer className="flex justify-end border-t bg-white px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-violet-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-800"
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}

export const assignmentColumns = [
  {
    label: "Product Image",
    render: (r: any) => (
      <div className="flex -space-x-2">
        {distinctProducts(r)
          .slice(0, 3)
          .map((p: any, idx: number) => (
            <ImagePreview key={p.id || idx} product={p} />
          ))}
        {distinctProducts(r).length > 3 && (
          <span className="self-center pl-3 text-xs text-slate-500">
            +{distinctProducts(r).length - 3}
          </span>
        )}
      </div>
    ),
  },
  {
    label: "Product Code",
    render: (r: any) => (
      <div className="flex max-w-40 flex-wrap gap-1">
        {distinctProducts(r).map((p: any, idx: number) => (
          <ProductCodeButton key={p.id || idx} product={p} />
        ))}
      </div>
    ),
  },
  {
    label: "Product Name",
    render: (r: any) => (
      <div className="flex min-w-32 max-w-52 flex-col gap-1">
        {distinctProducts(r).map((p: any, idx: number) => (
          <span
            key={p.id || idx}
            title={p.itemName}
            className="truncate text-sm font-medium text-slate-800"
          >
            {p.itemName || "-"}
          </span>
        ))}
      </div>
    ),
  },
  {
    label: "Supplier Code",
    render: (r: any) => (
      <div className="flex max-w-44 flex-wrap gap-1">
        {distinctProducts(r).map((p: any, idx: number) => (
          <span
            key={p.id || idx}
            className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700"
          >
            {p.supplierCode || "-"}
          </span>
        ))}
      </div>
    ),
  },
  {
    label: "Model",
    render: (r: any) => (
      <div className="flex min-w-36 items-center gap-2">
        {r.model?.photoUrl ? (
          <ImagePreview
            product={modelImage(r.model)}
            className="h-9 w-9"
            rounded="rounded-full"
          />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
            {String(r.model?.name || "M").slice(0, 1)}
          </div>
        )}
        <span className="font-medium text-slate-800">
          {r.model?.name || "-"}
        </span>
      </div>
    ),
  },
  { label: "Sent Date", render: (r: any) => dateText(r.sentDate) },
  { label: "Return Date", render: (r: any) => returnDate(r) },
  {
    label: "Sent",
    center: true,
    render: (r: any) => (
      <span className="font-bold text-blue-600">{sentQty(r)}</span>
    ),
  },
  {
    label: "Returned",
    center: true,
    render: (r: any) => (
      <span className="font-bold text-emerald-600">{returnedQty(r)}</span>
    ),
  },
  {
    label: "On Hand",
    center: true,
    render: (r: any) => (
      <span
        className={`font-bold ${sentQty(r) - returnedQty(r) > 0 ? "text-orange-600" : "text-slate-400"}`}
      >
        {sentQty(r) - returnedQty(r)}
      </span>
    ),
  },
  {
    label: "WSR",
    center: true,
    render: (r: any) => (
      <span className="font-bold text-violet-700">
        {dontWearQtyForAssignment(r)}
      </span>
    ),
  },
  {
    label: "Content",
    center: true,
    render: (r: any) => <ContentCell row={r} />,
  },
  {
    label: "Status",
    center: true,
    render: (r: any) => {
      const status = String(r.status || "-").toUpperCase();
      const color =
        status === "COMPLETED"
          ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
          : status === "ISSUED"
            ? "bg-amber-50 text-amber-700 ring-amber-200"
            : status === "CANCELLED"
              ? "bg-red-50 text-red-700 ring-red-200"
              : "bg-slate-100 text-slate-700 ring-slate-200";
      return (
        <span
          className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1 ${color}`}
        >
          {status}
        </span>
      );
    },
  },
];
function Form({ value, change, related }: FormProps) {
  const items: any[] = value.items || [];
  const [productCache, setProductCache] = useState<Record<string, any>>({});
  const [resultIds, setResultIds] = useState<string[]>([]);
  const [searchingProducts, setSearchingProducts] = useState(false);
  const cacheProducts = useCallback((rows: any[]) => {
    if (!rows.length) return;
    setProductCache((cache) => {
      const next = { ...cache };
      for (const row of rows) next[row.id] = { ...row, ...cache[row.id] };
      return next;
    });
  }, []);
  const products: any[] = Object.values(productCache);
  const [productSearch, setProductSearch] = useState("");
  const [productDropdown, setProductDropdown] = useState(false);
  useEscapeKey(() => setProductDropdown(false), productDropdown);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  const updateDropdownPosition = useCallback(() => {
    const input = searchInputRef.current;
    if (!input || typeof window === "undefined") return;
    const rect = input.getBoundingClientRect();
    const viewport = window.innerHeight;
    const gap = 6;
    const below = viewport - rect.bottom - 12;
    const above = rect.top - 12;
    const openAbove = below < 210 && above > below;
    const maxHeight = Math.max(
      80,
      Math.min(280, openAbove ? above - gap : below - gap),
    );
    setDropdownPosition({
      top: openAbove
        ? Math.max(8, rect.top - gap - maxHeight)
        : rect.bottom + gap,
      left: Math.max(8, rect.left),
      width: Math.min(
        rect.width,
        window.innerWidth - Math.max(8, rect.left) - 8,
      ),
      maxHeight,
    });
  }, []);

  useEffect(() => {
    if (!productDropdown) return;
    updateDropdownPosition();
    const onOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !searchWrapRef.current?.contains(target) &&
        !dropdownRef.current?.contains(target)
      ) {
        setProductDropdown(false);
      }
    };
    window.addEventListener("resize", updateDropdownPosition);
    window.addEventListener("scroll", updateDropdownPosition, true);
    document.addEventListener("mousedown", onOutside);
    return () => {
      window.removeEventListener("resize", updateDropdownPosition);
      window.removeEventListener("scroll", updateDropdownPosition, true);
      document.removeEventListener("mousedown", onOutside);
    };
  }, [productDropdown, updateDropdownPosition]);

  const templates: any[] = related.templates || [];
  const resolveTemplate = (product: any) =>
    product.template?.fields || product.template?.sizes
      ? product.template
      : templates.find((t: any) => t.id === product.templateId) ||
        product.template ||
        {};
  const selectedProductIds = [
    ...new Set(items.map((i) => i.productId).filter(Boolean)),
  ];

  // Products already chosen (e.g. when editing) are fetched by id.
  const missingIds = selectedProductIds
    .filter((id) => !productCache[id])
    .join(",");
  useEffect(() => {
    if (!missingIds) return;
    let cancelled = false;
    api<{ items?: any[] }>(
      `products?ids=${encodeURIComponent(missingIds)}&page=1&limit=100`,
    )
      .then((result) => {
        if (!cancelled) cacheProducts(result.items || []);
      })
      .catch((error) => {
        if (!cancelled) toast.error(error?.message || "Failed to load products");
      });
    return () => {
      cancelled = true;
    };
  }, [missingIds, cacheProducts]);

  // The dropdown searches the server instead of holding every product.
  useEffect(() => {
    if (!productDropdown) return;
    let cancelled = false;
    const q = productSearch.trim();
    const timer = setTimeout(() => {
      setSearchingProducts(true);
      api<{ items?: any[] }>(
        `products?page=1&limit=50${q ? `&q=${encodeURIComponent(q)}` : ""}`,
      )
        .then((result) => {
          if (cancelled) return;
          cacheProducts(result.items || []);
          setResultIds((result.items || []).map((p: any) => p.id));
        })
        .catch((error) => {
          if (!cancelled)
            toast.error(error?.message || "Failed to search products");
        })
        .finally(() => {
          if (!cancelled) setSearchingProducts(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [productSearch, productDropdown, cacheProducts]);

  const filteredProducts = resultIds
    .map((id) => productCache[id])
    .filter((p: any) => p && !selectedProductIds.includes(p.id));

  const addProduct = (productId: string) => {
    if (!productId || selectedProductIds.includes(productId)) return;
    change("items", [
      ...items,
      { productId, size: "", sentQty: "", _placeholder: true },
    ]);
  };
  const getSizes = (product: any): string[] => {
    const template = resolveTemplate(product);
    const rawSizes = template?.sizes;
    const templateSizes: string[] = Array.isArray(rawSizes)
      ? rawSizes
          .map((s: any) =>
            String(
              typeof s === "string" ? s : (s?.name ?? s?.size ?? ""),
            ).trim(),
          )
          .filter(Boolean)
      : typeof rawSizes === "string"
        ? rawSizes
            .split(",")
            .map((s: string) => s.trim())
            .filter(Boolean)
        : [];
    const measurements: any[] = Array.isArray(product?.measurements)
      ? product.measurements
      : [];
    const active = new Set<string>(
      measurements
        .filter(
          (m: any) =>
            m.value !== null &&
            m.value !== undefined &&
            String(m.value).trim() !== "",
        )
        .map((m: any) => String(m.size).trim()),
    );
    const assigned = items
      .filter((i) => i.productId === product.id && !i._placeholder && i.size)
      .map((i) => String(i.size).trim());
    const special = (size: string) =>
      /^(no[\s_-]*size|free[\s_-]*size|one[\s_-]*size)$/i.test(size);
    const explicitSpecial = templateSizes.filter(special);
    const fallback =
      !templateSizes.length && !active.size && product?.noSizeText != null
        ? ["No Size"]
        : [];
    return [
      ...new Set([
        ...templateSizes.filter((size) => special(size) || active.has(size)),
        ...active,
        ...assigned,
        ...fallback,
      ]),
    ];
  };
  const getFields = (product: any): any[] => {
    // Only show measurement rows that belong to this product's template
    // AND have a saved value for at least one size.
    const template = resolveTemplate(product);
    const templateFields: any[] = Array.isArray(template?.fields)
      ? template.fields
      : [];
    const measurements: any[] = Array.isArray(product?.measurements)
      ? product.measurements
      : [];
    const hasValue = (value: unknown) =>
      value !== null && value !== undefined && String(value).trim() !== "";
    const populated = new Map<string, any>();
    for (const m of measurements) {
      const id = String(m.fieldId ?? m.field?.id ?? "");
      if (id && hasValue(m.value) && !populated.has(id)) populated.set(id, m);
    }
    const byId = new Map<string, any>();
    if (templateFields.length) {
      for (const entry of templateFields) {
        const id = String(entry.fieldId ?? entry.field?.id ?? entry.id ?? "");
        const saved = populated.get(id);
        if (!id || !saved) continue;
        byId.set(id, {
          ...entry,
          fieldId: id,
          field: entry.field ?? saved.field ?? { name: entry.name ?? id },
        });
      }
    } else {
      // Fallback for products whose template relation is not included in the API.
      for (const [id, saved] of populated) {
        byId.set(id, { fieldId: id, field: saved.field ?? { name: id } });
      }
    }
    return Array.from(byId.values());
  };
  const updateSize = (productId: string, size: string, checked: boolean) => {
    const withoutPlaceholder = items.filter(
      (i) => !(i.productId === productId && i._placeholder),
    );
    const next = checked
      ? [...withoutPlaceholder, { productId, size, sentQty: 1 }]
      : withoutPlaceholder.filter(
          (i) => !(i.productId === productId && i.size === size),
        );
    if (!next.some((i) => i.productId === productId))
      next.push({ productId, size: "", sentQty: "", _placeholder: true });
    change("items", next);
  };
  const setQty = (productId: string, size: string, qty: number | "") =>
    change(
      "items",
      items.map((i) =>
        i.productId === productId && i.size === size
          ? { ...i, sentQty: qty }
          : i,
      ),
    );
  const removeProduct = (productId: string) =>
    change(
      "items",
      items.filter((i) => i.productId !== productId),
    );
  const totalQty = items
    .filter((i) => !i._placeholder && i.size)
    .reduce((n, i) => n + (Number(i.sentQty) || 0), 0);
  return (
    <>
      <SelectField
        label="Model"
        value={value.modelId}
        options={related.models || []}
        onChange={(v) => change("modelId", v)}
      />
      <TextField
        label="Sent Date"
        type="date"
        value={value.sentDate}
        onChange={(v) => change("sentDate", v)}
      />
      <TextField
        label="Expected Return"
        type="date"
        value={value.expectedReturnDate}
        onChange={(v) => change("expectedReturnDate", v)}
      />
      <TextField
        label="Notes"
        value={value.notes}
        onChange={(v) => change("notes", v)}
      />
      <div className="col-span-full mt-2 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Assign Products & Measurements
            </h3>
          </div>
          <div className="rounded-xl bg-violet-50 px-4 py-2 text-sm font-bold text-violet-700">
            Total: {plural(totalQty, "pc", "pcs")}
          </div>
        </div>
        <div className="max-w-md">
          <div ref={searchWrapRef} className="relative">
            <input
              ref={searchInputRef}
              type="search"
              value={productSearch}
              onFocus={() => {
                setProductDropdown(true);
                updateDropdownPosition();
              }}
              onChange={(e) => {
                setProductSearch(e.target.value);
                setProductDropdown(true);
                updateDropdownPosition();
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") setProductDropdown(false);
              }}
              placeholder="Search by product code, supplier code or name..."
              autoComplete="off"
              aria-expanded={productDropdown}
              aria-controls="assignment-product-results"
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-violet-500"
            />
            {productDropdown &&
              dropdownPosition &&
              typeof document !== "undefined" &&
              createPortal(
                <div
                  ref={dropdownRef}
                  id="assignment-product-results"
                  role="listbox"
                  style={{
                    position: "fixed",
                    top: dropdownPosition.top,
                    left: dropdownPosition.left,
                    width: dropdownPosition.width,
                    maxHeight: dropdownPosition.maxHeight,
                    zIndex: 99999,
                  }}
                  className="overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white p-1 shadow-2xl"
                >
                  {filteredProducts.length ? (
                    filteredProducts.map((p: any) => (
                      <button
                        type="button"
                        role="option"
                        aria-selected={false}
                        key={p.id}
                        onClick={() => {
                          addProduct(p.id);
                          setProductSearch("");
                          setProductDropdown(false);
                        }}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-violet-50 focus:bg-violet-50 focus:outline-none"
                      >
                        {productImages(p)[0] ? (
                          <img
                            src={productImages(p)[0]}
                            alt=""
                            className="h-9 w-9 shrink-0 rounded-md object-cover"
                          />
                        ) : (
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs text-slate-400">
                            N/A
                          </span>
                        )}
                        <span className="min-w-0">
                          <strong className="text-violet-700">{p.sn}</strong> -{" "}
                          {p.itemName}
                          <span className="block text-xs text-slate-500">
                            Supplier Code: {p.supplierCode || "-"}
                          </span>
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="px-3 py-4 text-sm text-slate-500">
                      {searchingProducts
                        ? "Searching products..."
                        : "No matching products found."}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => setProductDropdown(false)}
                    className="w-full border-t border-slate-100 p-2 text-center text-xs text-slate-500 hover:text-slate-900"
                  >
                    Close
                  </button>
                </div>,
                document.body,
              )}
          </div>
        </div>
        {selectedProductIds.map((productId) => {
          const product = products.find((p) => p.id === productId);
          if (!product)
            return (
              <div key={productId} className="rounded-xl border p-4">
                Product details unavailable: {productId}
                <button
                  type="button"
                  onClick={() => removeProduct(productId)}
                  className="ml-3 text-red-600"
                >
                  Remove
                </button>
              </div>
            );
          const sizes = getSizes(product);
          const fields = getFields(product);
          const selected = items.filter(
            (i) => i.productId === productId && !i._placeholder && !!i.size,
          );
          const images = (product.images || [])
            .map((img: any) => (typeof img === "string" ? img : img.url))
            .filter(Boolean);
          return (
            <section
              key={productId}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
            >
              <div className="border-b bg-slate-50 p-3 sm:p-4">
                <div className="mb-3 flex items-center gap-3">
                  {images[0] ? (
                    <img
                      src={images[0]}
                      alt={product.itemName}
                      className="h-14 w-14 shrink-0 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-xs text-slate-500">
                      N/A
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h4
                      className="truncate text-sm font-bold text-slate-900"
                      title={product.itemName}
                    >
                      {product.itemName}
                    </h4>
                    <p className="text-xs text-slate-600">
                      Product Code: <b>{product.sn || product.code || "-"}</b>
                    </p>
                    <p className="text-xs text-slate-600">
                      Supplier Code: <b>{product.supplierCode || "-"}</b>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeProduct(productId)}
                    title={`Remove ${product.itemName}`}
                    aria-label={`Remove ${product.itemName}`}
                    className="shrink-0 rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
                <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                    <span className="text-xs font-bold text-slate-700">
                      Select Sizes & Quantity
                    </span>
                    <label className="flex items-center gap-1.5 text-xs text-violet-700">
                      <input
                        type="checkbox"
                        aria-label={`Select all sizes for ${product.itemName}`}
                        checked={
                          sizes.length > 0 &&
                          sizes.every((size) =>
                            selected.some((i) => i.size === size),
                          )
                        }
                        onChange={(e) => {
                          const next = items.filter(
                            (i) => i.productId !== productId,
                          );
                          change("items", [
                            ...next,
                            ...(e.target.checked
                              ? sizes.map((size) => ({
                                  productId,
                                  size,
                                  sentQty:
                                    selected.find((i) => i.size === size)
                                      ?.sentQty ?? 1,
                                }))
                              : [
                                  {
                                    productId,
                                    size: "",
                                    sentQty: 1,
                                    _placeholder: true,
                                  },
                                ]),
                          ]);
                        }}
                      />
                      All
                    </label>
                  </div>
                  {sizes.length ? (
                    <table className="w-full table-fixed border-collapse text-[10px] sm:text-xs">
                      <tbody>
                        <tr className="bg-slate-50">
                          <th className="w-[78px] border-r border-slate-200 px-1 py-2 text-left sm:w-[115px] sm:px-3">
                            Size
                          </th>
                          {sizes.map((size) => {
                            const entry = selected.find((i) => i.size === size);
                            return (
                              <td
                                key={size}
                                className="min-w-0 px-0.5 py-2 text-center"
                              >
                                <label className="flex cursor-pointer flex-col items-center gap-1 font-semibold text-slate-800">
                                  <input
                                    type="checkbox"
                                    checked={!!entry}
                                    onChange={(e) =>
                                      updateSize(
                                        productId,
                                        size,
                                        e.target.checked,
                                      )
                                    }
                                    aria-label={`Select ${size}`}
                                  />
                                  <span className="break-all">{size}</span>
                                </label>
                              </td>
                            );
                          })}
                        </tr>
                        {fields.map((f: any) => (
                          <tr
                            key={f.fieldId}
                            className="border-t border-slate-100"
                          >
                            <th className="break-words border-r border-slate-200 px-1 py-2 text-left font-medium text-slate-600 sm:px-3">
                              {f.field?.name || f.fieldId}
                              {f.field?.unit?.symbol ? ` (${f.field.unit.symbol})` : ""}
                            </th>
                            {sizes.map((size) => (
                              <td
                                key={size}
                                className="min-w-0 px-0.5 py-2 text-center text-slate-700"
                              >
                                {(product.measurements || []).find(
                                  (m: any) =>
                                    String(m.size) === size &&
                                    String(m.fieldId) === String(f.fieldId),
                                )?.value ?? "-"}
                              </td>
                            ))}
                          </tr>
                        ))}
                        <tr className="border-t border-slate-100 bg-violet-50/40">
                          <th className="border-r border-slate-200 px-1 py-2 text-left font-semibold sm:px-3">
                            Quantity
                          </th>
                          {sizes.map((size) => {
                            const entry = selected.find((i) => i.size === size);
                            return (
                              <td
                                key={size}
                                className="min-w-0 px-0.5 py-2 text-center"
                              >
                                <input
                                  type="number"
                                  min={1}
                                  step={1}
                                  disabled={!entry}
                                  value={entry ? (entry.sentQty ?? "") : ""}
                                  onChange={(e) =>
                                    setQty(
                                      productId,
                                      size,
                                      e.target.value === ""
                                        ? ""
                                        : Number(e.target.value),
                                    )
                                  }
                                  aria-label={`Quantity for ${size}`}
                                  className="h-8 w-full min-w-0 rounded-md border border-slate-200 bg-white px-0 text-center text-[10px] font-semibold outline-none focus:border-violet-500 disabled:bg-slate-100 sm:text-xs"
                                />
                              </td>
                            );
                          })}
                        </tr>
                      </tbody>
                    </table>
                  ) : (
                    <p className="p-3 text-xs text-amber-700">
                      No sizes found in this product's template or measurements.
                    </p>
                  )}
                  <div className="border-t border-slate-100 px-3 py-2 text-right text-xs font-semibold text-violet-700">
                    {plural(selected.length, "size")} selected ·{" "}
                    {plural(
                      selected.reduce((n, i) => n + (Number(i.sentQty) || 0), 0),
                      "pc",
                      "pcs",
                    )}
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
function ReceiveReturnView({
  assignment,
  onClose,
  onSaved,
}: {
  assignment: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [qty, setQty] = useState<Record<string, number | "">>({});
  const [dontWearQty, setDontWearQty] = useState<Record<string, number | "">>(
    {},
  );
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  useEscapeKey(() => {
    if (!busy) onClose();
  });

  const assignmentItems: any[] = assignment.items || [];
  const outstanding = (item: any) =>
    Math.max(0, Number(item.sentQty || 0) - returnQty(item));
  const available = assignmentItems.filter((item) => outstanding(item) > 0);
  const grouped = Array.from(
    new Map(
      assignmentItems.map((item) => [
        item.productId || item.product?.id,
        item.product,
      ]),
    ).entries(),
  ).map(([productId, product]) => ({
    productId,
    product,
    items: assignmentItems.filter(
      (item) => (item.productId || item.product?.id) === productId,
    ),
  }));

  const chosen = available.filter((item) => selected[item.id]);
  const totalPieces = chosen.reduce(
    (sum, item) => sum + Number(qty[item.id] || 0),
    0,
  );
  const toggle = (item: any, checked: boolean) => {
    if (outstanding(item) <= 0) return;
    setSelected((prev) => ({ ...prev, [item.id]: checked }));
    setQty((prev) => ({
      ...prev,
      [item.id]: checked ? prev[item.id] || 1 : 0,
    }));
  };

  async function receive() {
    if (busy) return;
    const items = chosen.map((item) => ({
      assignmentItemId: item.id,
      quantity: Number(qty[item.id] || 0),
      dontWearQty: Number(dontWearQty[item.id] || 0),
      condition: "GOOD" as const,
    }));
    if (!items.length) {
      toast.error("Select at least one size to return");
      return;
    }
    if (
      chosen.some(
        (item) =>
          qty[item.id] === "" ||
          !Number.isInteger(Number(qty[item.id])) ||
          Number(qty[item.id]) < 1 ||
          Number(qty[item.id]) > outstanding(item),
      )
    ) {
      toast.error("Return Qty must be between 1 and the On Hand quantity");
      return;
    }
    if (
      chosen.some(
        (item) =>
          !Number.isSafeInteger(Number(dontWearQty[item.id] || 0)) ||
          Number(dontWearQty[item.id] || 0) < 0,
      )
    ) {
      toast.error("Don't Wear Quantity must be a non-negative integer");
      return;
    }
    setBusy(true);
    try {
      await api(`assignments/${assignment.id}`, {
        method: "POST",
        body: JSON.stringify({ items, notes: notes.trim() || undefined }),
      });
      toast.success("Return received successfully");
      onSaved();
      onClose();
    } catch (error: any) {
      toast.error(error?.message || "Unable to receive return");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Receive Product Return"
    >
      <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-7">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Receive Product Return
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"
          >
            <X size={20} />
          </button>
        </header>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto bg-slate-50/70 p-4 sm:p-6">
          <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm sm:grid-cols-3">
            <div>
              <span className="text-xs text-slate-500">Model</span>
              <p className="font-semibold text-slate-900">
                {assignment.model?.name || "-"}
              </p>
            </div>
            <div>
              <span className="text-xs text-slate-500">Sent Date</span>
              <p className="font-semibold text-slate-900">
                {dateText(assignment.sentDate)}
              </p>
            </div>
            <div>
              <span className="text-xs text-slate-500">Expected Return</span>
              <p className="font-semibold text-slate-900">
                {dateText(assignment.expectedReturnDate)}
              </p>
            </div>
          </div>
          {grouped.map(({ productId, product, items }) => {
            const fields: any[] = product?.template?.fields?.length
              ? product.template.fields
              : Array.from(
                  new Map(
                    (product?.measurements || []).map((m: any) => [
                      m.fieldId,
                      { fieldId: m.fieldId, field: m.field },
                    ]),
                  ).values(),
                );
            const image = productImages(product)[0];
            const eligible = items.filter((item) => outstanding(item) > 0);
            const allSelected =
              eligible.length > 0 &&
              eligible.every((item) => selected[item.id]);
            return (
              <section
                key={String(productId)}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
              >
                <div className="flex flex-wrap items-center gap-4 border-b border-slate-200 bg-white p-4">
                  {image ? (
                    <img
                      src={image}
                      alt={product?.itemName || "Product"}
                      className="h-20 w-20 rounded-xl border border-slate-200 object-cover"
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-slate-100 text-xs text-slate-400">
                      No image
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-bold text-slate-900">
                      {product?.itemName || "Product"}
                    </h3>
                    <p className="mt-1 text-xs text-slate-600">
                      Product Code: <b>{product?.sn || "-"}</b> · Supplier Code:{" "}
                      <b>{product?.supplierCode || "-"}</b>
                    </p>
                  </div>
                  <span className="rounded-lg bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700">
                    {plural(items.length, "assigned size")}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[650px] text-left text-xs">
                    <thead className="bg-slate-100/80 text-slate-600">
                      <tr>
                        <th className="px-3 py-3">
                          <input
                            type="checkbox"
                            aria-label="Select all available sizes"
                            disabled={!eligible.length}
                            checked={allSelected}
                            onChange={(e) =>
                              eligible.forEach((item) =>
                                toggle(item, e.target.checked),
                              )
                            }
                          />
                        </th>
                        <th className="whitespace-nowrap px-3 py-3">Size</th>
                        {fields.map((f: any) => (
                          <th
                            key={f.fieldId}
                            className="whitespace-nowrap px-3 py-3"
                          >
                            {f.field?.name || f.fieldId}
                            {f.field?.unit?.symbol ? ` (${f.field.unit.symbol})` : ""}
                          </th>
                        ))}
                        <th className="whitespace-nowrap px-3 py-3">Sent</th>
                        <th className="whitespace-nowrap px-3 py-3">
                          Returned
                        </th>
                        <th className="whitespace-nowrap px-3 py-3">
                          On Hand
                        </th>
                        <th className="whitespace-nowrap px-3 py-3">
                          Return Qty
                        </th>
                        <th className="whitespace-nowrap px-3 py-3">
                          Don't Wear Qty
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item: any) => {
                        const remaining = outstanding(item);
                        const checked =
                          Boolean(selected[item.id]) && remaining > 0;
                        return (
                          <tr
                            key={item.id}
                            className={`border-t border-slate-100 ${checked ? "bg-violet-50/60" : ""} ${remaining === 0 ? "opacity-50" : ""}`}
                          >
                            <td className="px-3 py-3">
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={remaining === 0 || busy}
                                aria-label={`Select ${item.size}`}
                                onChange={(e) => toggle(item, e.target.checked)}
                              />
                            </td>
                            <td className="px-3 py-3 font-bold text-slate-800">
                              {item.size}
                            </td>
                            {fields.map((f: any) => (
                              <td
                                key={f.fieldId}
                                className="px-3 py-3 text-slate-700"
                              >
                                {measurementText(
                                  (product?.measurements || []).find(
                                    (m: any) =>
                                      m.size === item.size &&
                                      m.fieldId === f.fieldId,
                                  )?.value,
                                ) || "-"}
                              </td>
                            ))}
                            <td className="px-3 py-3 font-semibold text-blue-600">
                              {item.sentQty}
                            </td>
                            <td className="px-3 py-3 font-semibold text-emerald-600">
                              {returnQty(item)}
                            </td>
                            <td className="px-3 py-3 font-semibold text-orange-600">
                              {remaining}
                            </td>
                            <td className="px-3 py-3">
                              <input
                                type="number"
                                min={1}
                                max={remaining}
                                step={1}
                                disabled={!checked || busy}
                                value={checked ? (qty[item.id] ?? "") : ""}
                                onChange={(e) =>
                                  setQty((prev) => ({
                                    ...prev,
                                    // Never more than what is still on hand.
                                    [item.id]:
                                      e.target.value === ""
                                        ? ""
                                        : Math.min(
                                            remaining,
                                            Number(e.target.value),
                                          ),
                                  }))
                                }
                                aria-label={`Return quantity for ${item.size}`}
                                className="w-24 rounded-lg border border-slate-200 bg-white px-3 py-2 outline-none focus:border-violet-500 disabled:bg-slate-100"
                              />
                            </td>
                            <td className="px-3 py-3">
                              <input
                                type="number"
                                min={0}
                                step={1}
                                inputMode="numeric"
                                disabled={!checked || busy}
                                value={
                                  checked ? (dontWearQty[item.id] ?? "") : ""
                                }
                                onChange={(e) =>
                                  setDontWearQty((prev) => ({
                                    ...prev,
                                    [item.id]:
                                      e.target.value === ""
                                        ? ""
                                        : Number(e.target.value),
                                  }))
                                }
                                aria-label={`Don't Wear quantity for ${item.size}`}
                                className="w-24 rounded-lg border border-slate-200 bg-white px-3 py-2 outline-none focus:border-violet-500 disabled:bg-slate-100"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="border-t border-slate-100 px-4 py-3 text-right text-xs font-semibold text-violet-700">
                  {plural(
                    items.filter(
                      (item: any) => selected[item.id] && outstanding(item) > 0,
                    ).length,
                    "size",
                  )}{" "}
                  selected ·{" "}
                  {plural(
                    items.reduce(
                      (sum: number, item: any) =>
                        sum +
                        (selected[item.id] && outstanding(item) > 0
                          ? Number(qty[item.id] || 0)
                          : 0),
                      0,
                    ),
                    "pc",
                    "pcs",
                  )}{" "}
                  to return
                </div>
              </section>
            );
          })}
          {!available.length && (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              All assigned quantities have already been returned.
            </p>
          )}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <label
              htmlFor="return-notes"
              className="mb-2 block text-sm font-semibold text-slate-700"
            >
              Return Notes (optional)
            </label>
            <textarea
              id="return-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={5000}
              placeholder="Add any notes about this return..."
              className="w-full resize-y rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-violet-500"
            />
          </div>
        </div>
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:px-7">
          <p className="text-sm font-semibold text-slate-700">
            {plural(chosen.length, "selected size")} ·{" "}
            <span className="text-violet-700">
              {plural(totalPieces, "return piece")}
            </span>
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={receive}
              disabled={busy || !available.length || !chosen.length}
              className="rounded-xl bg-violet-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Receiving..." : "Receive Return"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default function AssignmentsPage() {
  const account = useAccount();
  const canReceive =
    account.permissions.includes("*") ||
    account.permissions.includes("assignments.receive") ||
    account.permissions.includes("returns.receive");
  const [returnAssignment, setReturnAssignment] = useState<any | null>(null);
  const [viewAssignment, setViewAssignment] = useState<any | null>(null);
  const [reload, setReload] = useState<(() => Promise<void>) | null>(null);
  return (
    <>
      <ResourcePage
        entity="assignments"
        title="Model Assign"
        createLabel="Model Assign"
        initial={{
          modelId: "",
          sentDate: localDateInput(),
          expectedReturnDate: "",
          notes: "",
          items: [],
        }}
        Form={Form}
        relatedKeys={["models", "templates"]}
        columns={assignmentColumns}
        prepareEdit={(r) => ({
          id: r.id,
          modelId: r.modelId || r.model?.id || "",
          sentDate: r.sentDate ? localDateInput(new Date(r.sentDate)) : "",
          expectedReturnDate: r.expectedReturnDate
            ? localDateInput(new Date(r.expectedReturnDate))
            : "",
          notes: r.notes || "",
          items: (r.items || []).map((i: any) => ({
            productId: i.productId || i.product?.id,
            size: i.size,
            sentQty: Number(i.sentQty || 0),
          })),
        })}
        // Mirrors the API: edits are locked once returns exist or the
        // assign is completed/cancelled; deletes only once returns exist.
        rowEditable={(r) =>
          !(r.returns || []).length &&
          !["COMPLETED", "CANCELLED"].includes(
            String(r.status || "").toUpperCase(),
          )
        }
        rowDeletable={(r) => !(r.returns || []).length}
        rowActions={(r, refresh) => {
          const pending =
            sentQty(r) > returnedQty(r) &&
            !["COMPLETED", "CANCELLED", "DRAFT"].includes(
              String(r.status || "").toUpperCase(),
            );
          return (
            <div className="flex items-center gap-1">
              <button
                type="button"
                title="View Assignment Details"
                aria-label="View Assignment Details"
                onClick={() => setViewAssignment(r)}
                className="rounded-lg p-2 text-blue-600 hover:bg-blue-50"
              >
                <Eye size={18} />
              </button>
              {canReceive && pending && (
                <button
                  type="button"
                  title="Receive Return"
                  aria-label="Receive Return"
                  onClick={() => {
                    setReturnAssignment(r);
                    setReload(() => refresh);
                  }}
                  className="rounded-lg p-2 text-violet-600 hover:bg-violet-50"
                >
                  <RotateCcw size={17} />
                </button>
              )}
            </div>
          );
        }}
        validate={(v) =>
          !v.modelId
            ? "Select model"
            : !v.sentDate
              ? "Sent date required"
              : !v.items?.filter((i: any) => !i._placeholder && i.size)?.length
                ? "Add at least one item"
                : v.items
                      .filter((i: any) => !i._placeholder)
                      .some(
                        (i: any) =>
                          !i.productId ||
                          !i.size ||
                          !Number.isSafeInteger(Number(i.sentQty)) ||
                          i.sentQty === "" ||
                          Number(i.sentQty) < 1,
                      )
                  ? "Complete all assign items"
                  : undefined
        }
      />
      {viewAssignment &&
        typeof document !== "undefined" &&
        createPortal(
          <AssignmentDetails
            assignment={viewAssignment}
            onClose={() => setViewAssignment(null)}
          />,
          document.body,
        )}
      {returnAssignment &&
        typeof document !== "undefined" &&
        createPortal(
          <ReceiveReturn
            assignment={returnAssignment}
            onClose={() => setReturnAssignment(null)}
            onSaved={() => {
              void reload?.();
            }}
          />,
          document.body,
        )}
    </>
  );
}

/** Loads the full assignment (images, measurements) before showing details. */
export function AssignmentDetails({
  assignment,
  onClose,
}: {
  assignment: any;
  onClose: () => void;
}) {
  const full = useFullAssignment(assignment, onClose);
  return full ? (
    <AssignmentDetailsView assignment={full} onClose={onClose} />
  ) : (
    <LoadingOverlay />
  );
}

/** Loads the full assignment before opening the receive-return dialog. */
export function ReceiveReturn({
  assignment,
  onClose,
  onSaved,
}: {
  assignment: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const full = useFullAssignment(assignment, onClose);
  return full ? (
    <ReceiveReturnView assignment={full} onClose={onClose} onSaved={onSaved} />
  ) : (
    <LoadingOverlay />
  );
}
