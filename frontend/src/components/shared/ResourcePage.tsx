"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import toast from "react-hot-toast";

import { createPortal } from "react-dom";

import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Save,
  X,
  Loader2,
  RefreshCw,
  ClipboardList,
  Send,
  RotateCcw,
  Package,
  Shirt,
} from "lucide-react";

import { useAccount } from "../Shell";

import { compressToWebp, uploadImage } from "@/lib/image";
import { api, saveEntity, deleteEntity } from "@/lib/client-api";
import { plural } from "@/lib/format";

import Pagination from "./Pagination";

import DeleteConfirmModal from "./DeleteConfirmModal";
import { EscapeKey } from "@/lib/useEscapeKey";

export type FormProps = {
  value: any;

  change: (key: string, value: any) => void;

  related: Record<string, any[]>;

  data: any[];

  upload: (file: File) => Promise<void>;
};

export type Column = {
  label: string;

  render: (row: any) => ReactNode;

  center?: boolean;
};

type Props = {
  entity: string;

  title: string;

  initial?: any;

  columns: Column[];

  Form?: (props: FormProps) => ReactNode;

  relatedKeys?: string[];

  endpoint?: string;

  rowActions?: (row: any, reload: () => Promise<void>) => ReactNode;

  validate?: (value: any, data: any[]) => string | undefined;

  prepareEdit?: (row: any) => any;

  /** Per-row gates for the built-in Edit / Delete buttons (default: allowed). */
  rowEditable?: (row: any) => boolean;

  rowDeletable?: (row: any) => boolean;

  /** Text of the header button that opens the create form. */
  createLabel?: string;
};

function structuredCloneSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export default function ResourcePage({
  entity,

  title,

  initial,

  columns,

  Form,

  relatedKeys = [],

  endpoint,

  validate,

  rowActions,

  prepareEdit,

  rowEditable,

  rowDeletable,

  createLabel = "Create New",
}: Props) {
  const account = useAccount();

  // Read-only pages (e.g. Audit Logs) have nothing to put in an Actions column.
  const showActions = Boolean(rowActions || Form);

  const has = (action: string) =>
    account.permissions.includes("*") ||
    account.permissions.includes(`${entity}.${action}`);

  const [data, setData] = useState<any[]>([]);

  const [related, setRelated] = useState<Record<string, any[]>>({});

  const [editing, setEditing] = useState<any | null>(null);

  const [deleting, setDeleting] = useState<any | null>(null);

  const [search, setSearch] = useState("");

  const [page, setPage] = useState(1);

  const [limit, setLimit] = useState(10);

  const [busy, setBusy] = useState(false);

  const [loading, setLoading] = useState(true);

  const [mounted, setMounted] = useState(false);

  const [statusFilter, setStatusFilter] = useState("ALL");

  const [modelFilter, setModelFilter] = useState("ALL");

  const [fromDate, setFromDate] = useState("");

  const [toDate, setToDate] = useState("");

  useEffect(() => setMounted(true), []);

  const relatedKeyString = relatedKeys.join(",");

  const reload = useCallback(async () => {
    setLoading(true);

    try {
      const keys = relatedKeyString ? relatedKeyString.split(",") : [];

      const [rows, ...refs] = await Promise.all([
        api<any[]>(endpoint || entity),

        ...keys.map((key) => api<any[]>(key)),
      ]);

      setData(Array.isArray(rows) ? rows : []);

      setRelated(
        Object.fromEntries(
          keys.map((key, index) => [
            key,

            Array.isArray(refs[index]) ? refs[index] : [],
          ]),
        ),
      );
    } catch (error: any) {
      toast.error(error?.message || "Failed to load records");
    } finally {
      setLoading(false);
    }
  }, [entity, endpoint, relatedKeyString]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const isAssignmentDirectory =
    entity === "assignments" ||
    (entity === "returns" && (endpoint || entity) === "assignments");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return data.filter((item) => {
      if (
        isAssignmentDirectory &&
        statusFilter !== "ALL" &&
        String(item.status || "").toUpperCase() !== statusFilter
      )
        return false;

      if (
        isAssignmentDirectory &&
        modelFilter !== "ALL" &&
        String(item.modelId || item.model?.id || "") !== modelFilter
      )
        return false;

      if (isAssignmentDirectory) {
        const date = item.sentDate ? String(item.sentDate).slice(0, 10) : "";

        if (fromDate && (!date || date < fromDate)) return false;

        if (toDate && (!date || date > toDate)) return false;
      }

      return !query || JSON.stringify(item).toLowerCase().includes(query);
    });
  }, [
    data,

    search,

    isAssignmentDirectory,

    statusFilter,

    modelFilter,

    fromDate,

    toDate,
  ]);

  const pages = Math.max(1, Math.ceil(filtered.length / limit));

  const current = Math.min(page, pages);

  const paginated = filtered.slice((current - 1) * limit, current * limit);

  const change = (key: string, value: any) => {
    setEditing((previous: any) => {
      if (!previous) return previous;

      // Reset dependent selections when category changes.

      if (
        entity === "products" &&
        key === "categoryId" &&
        previous.categoryId !== value
      ) {
        return {
          ...previous,

          categoryId: value,

          templateId: "",

          measurements: [],
        };
      }

      // Reset measurements when the template changes.

      if (
        entity === "products" &&
        key === "templateId" &&
        previous.templateId !== value
      ) {
        return {
          ...previous,

          templateId: value,

          measurements: [],
        };
      }

      return {
        ...previous,

        [key]: value,
      };
    });
  };

  const open = (row?: any) => {
    const nextValue = row
      ? prepareEdit
        ? prepareEdit(row)
        : row
      : initial || {};

    setEditing(structuredCloneSafe(nextValue));
  };

  async function upload(file: File): Promise<void> {
    try {
      // Same compression and upload as the shared ImageUpload component.
      const result = await uploadImage(await compressToWebp(file));

      setEditing((previous: any) => {
        if (!previous) return previous;

        if (entity === "models") {
          return {
            ...previous,

            photoUrl: result.url,
          };
        }

        const images: string[] = previous.images || [];

        if (images.length >= 15) {
          toast.error("Maximum 15 images allowed");

          return previous;
        }

        return {
          ...previous,

          images: [...images, result.url],
        };
      });

      toast.success("Image uploaded successfully");
    } catch (error: any) {
      toast.error(error?.message || "Image upload failed");
    }
  }

  async function save() {
    if (!editing || busy) return;

    const error = validate?.(editing, data);

    if (error) {
      toast.error(error);

      return;
    }

    setBusy(true);

    try {
      let payload: any = editing;

      if (entity === "users") {
        payload = editing.id
          ? {
              name: editing.name?.trim(),
              status: editing.status || "ACTIVE",
              roleIds: editing.roleIds || [],
            }
          : {
              name: editing.name?.trim(),
              email: editing.email?.trim(),
              password: editing.password,
              status: editing.status || "ACTIVE",
              roleIds: editing.roleIds || [],
            };
      }

      if (entity === "assignments") {
        const chosen = (editing.items || []).filter(
          (item: any) => !item._placeholder && item.productId && item.size,
        );
        if (!editing.modelId) throw new Error("Please select a model");
        if (!editing.sentDate) throw new Error("Please select a sent date");
        if (!chosen.length)
          throw new Error("Please select at least one product and size");
        const invalid = chosen.find(
          (item: any) =>
            item.sentQty === "" ||
            item.sentQty === null ||
            item.sentQty === undefined ||
            !Number.isSafeInteger(Number(item.sentQty)) ||
            Number(item.sentQty) < 1,
        );
        if (invalid)
          throw new Error(
            `Please enter a valid quantity greater than 0 for ${invalid.size}`,
          );
        if (
          editing.expectedReturnDate &&
          new Date(editing.expectedReturnDate) < new Date(editing.sentDate)
        )
          throw new Error(
            "Expected return date cannot be earlier than sent date",
          );
        // The API schema is strict: send only the editable fields.
        payload = {
          id: editing.id,

          modelId: editing.modelId,

          sentDate: editing.sentDate,

          expectedReturnDate: editing.expectedReturnDate || null,

          notes: editing.notes || null,

          items: (editing.items || [])

            .filter(
              (item: any) => !item._placeholder && item.productId && item.size,
            )

            .map((item: any) => ({
              productId: item.productId,

              size: item.size,

              sentQty: Number(item.sentQty),
            })),
        };
      }

      if (entity === "roles") {
        const rolePayload = {
          name: String(editing.name || "").trim(),

          description: String(editing.description || ""),

          permissionIds: Array.isArray(editing.permissionIds)
            ? editing.permissionIds
            : [],
        };

        await api(`roles${editing.id ? `/${editing.id}` : ""}`, {
          method: editing.id ? "PATCH" : "POST",

          body: JSON.stringify(rolePayload),
        });
      } else if (entity === "users" && editing.id) {
        // Update user without sending its ID inside the JSON body.
        await api(`users/${encodeURIComponent(String(editing.id))}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await saveEntity(entity, payload);
      }

      toast.success(
        editing.id ? "Updated successfully" : "Created successfully",
      );

      setEditing(null);

      await reload();
    } catch (error: any) {
      toast.error(error?.message || "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!deleting || busy) return;

    setBusy(true);

    try {
      await deleteEntity(entity, deleting.id);

      toast.success("Deleted successfully");

      setDeleting(null);

      await reload();
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {entity === "assignments" && (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
          {[
            {
              label: "Total Assign",

              count: data.length,

              Icon: ClipboardList,

              bg: "bg-violet-100",

              color: "text-violet-700",
            },

            {
              label: "Total Sent",

              count: data.reduce(
                (n, r) =>
                  n +
                  (r.items || []).reduce(
                    (sum: number, i: any) => sum + Number(i.sentQty || 0),

                    0,
                  ),

                0,
              ),

              Icon: Send,

              bg: "bg-blue-100",

              color: "text-blue-700",
            },

            {
              label: "Total Returned",

              count: data.reduce(
                (n, r) =>
                  n +
                  (r.items || []).reduce(
                    (sum: number, i: any) =>
                      sum +
                      (i.returnItems || []).reduce(
                        (q: number, x: any) => q + Number(x.quantity || 0),

                        0,
                      ),

                    0,
                  ),

                0,
              ),

              Icon: RotateCcw,

              bg: "bg-emerald-100",

              color: "text-emerald-700",
            },

            {
              label: "Don't Wear",

              count: data.reduce(
                (n, r) =>
                  n +
                  (r.items || []).reduce(
                    (sum: number, i: any) =>
                      sum +
                      (i.returnItems || []).reduce(
                        (q: number, x: any) => q + Number(x.dontWearQty || 0),

                        0,
                      ),

                    0,
                  ),

                0,
              ),

              Icon: Shirt,

              bg: "bg-fuchsia-100",

              color: "text-fuchsia-700",
            },

            {
              label: "On Hand",

              count: data.reduce(
                (n, r) =>
                  n +
                  (r.items || []).reduce(
                    (sum: number, i: any) =>
                      sum +
                      Number(i.sentQty || 0) -
                      (i.returnItems || []).reduce(
                        (q: number, x: any) => q + Number(x.quantity || 0),

                        0,
                      ),

                    0,
                  ),

                0,
              ),

              Icon: Package,

              bg: "bg-orange-100",

              color: "text-orange-700",
            },
          ].map(({ label, count, Icon, bg, color }) => (
            <div
              key={label}
              className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div>
                <p className="text-xs font-medium text-slate-500">{label}</p>

                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {count}
                </p>
              </div>

              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${bg}`}
              >
                <Icon
                  size={24}
                  strokeWidth={2}
                  className={color}
                  aria-hidden="true"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Page heading */}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>

          <p className="mt-1 text-sm text-slate-500">
            Manage {title.toLowerCase()} with role-based access control
          </p>
        </div>

        {Form && has("create") && (
          <button
            type="button"
            onClick={() => open()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 font-semibold text-white shadow-sm transition hover:bg-violet-700"
          >
            <Plus size={17} />
            {createLabel}
          </button>
        )}
      </div>

      {/* Records */}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="p-5">
          <div className="mb-5 flex flex-nowrap items-center justify-between gap-3 overflow-x-auto">
            {entity === "assignments" && (
              <div className="shrink-0">
                <h2 className="font-bold text-slate-900">Assign Directory</h2>
              </div>
            )}

            <div className="flex shrink-0 items-center gap-2">
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-slate-500">
                <Search size={17} />

                <input
                  type="search"
                  placeholder="Search records..."
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);

                    setPage(1);
                  }}
                  className="min-w-0 bg-transparent px-2 py-3 text-sm outline-none"
                />
              </div>

              {isAssignmentDirectory && (
                <>
                  <select
                    value={modelFilter}
                    onChange={(e) => {
                      setModelFilter(e.target.value);

                      setPage(1);
                    }}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"
                    aria-label="Filter by model"
                  >
                    <option value="ALL">All Models</option>

                    {Array.from(
                      new Map<string, string>(
                        data

                          .filter((r) => r.modelId || r.model?.id)

                          .map((r) => [
                            String(r.modelId || r.model?.id),

                            String(
                              r.model?.name ||
                                r.model?.code ||
                                r.modelId ||
                                "Unknown Model",
                            ),
                          ]),
                      ),
                    )

                      .sort((a, b) => a[1].localeCompare(b[1]))

                      .map(([id, name]) => (
                        <option key={id} value={id}>
                          {name}
                        </option>
                      ))}
                  </select>

                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);

                      setPage(1);
                    }}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"
                  >
                    <option value="ALL">All Status</option>

                    {[
                      ...new Set(
                        data

                          .map((r) => String(r.status || "").toUpperCase())

                          .filter(Boolean),
                      ),
                    ].map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>

                  <label className="flex shrink-0 items-center gap-1 text-xs text-slate-500">
                    From
                    <input
                      type="date"
                      value={fromDate}
                      max={toDate || undefined}
                      onChange={(e) => {
                        setFromDate(e.target.value);

                        setPage(1);
                      }}
                      className="rounded-xl border border-slate-200 bg-white px-2 py-3 text-sm text-slate-700"
                    />
                  </label>

                  <label className="flex shrink-0 items-center gap-1 text-xs text-slate-500">
                    To
                    <input
                      type="date"
                      value={toDate}
                      min={fromDate || undefined}
                      onChange={(e) => {
                        setToDate(e.target.value);

                        setPage(1);
                      }}
                      className="rounded-xl border border-slate-200 bg-white px-2 py-3 text-sm text-slate-700"
                    />
                  </label>

                  <button
                    type="button"
                    title="Refresh"
                    aria-label="Refresh"
                    onClick={() => void reload()}
                    className="rounded-xl border border-slate-200 p-3 text-slate-600 hover:bg-violet-50 hover:text-violet-700"
                  >
                    <RefreshCw
                      size={18}
                      className={loading ? "animate-spin" : ""}
                    />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");

                      setStatusFilter("ALL");

                      setModelFilter("ALL");

                      setFromDate("");

                      setToDate("");

                      setPage(1);
                    }}
                    className="rounded-xl border border-slate-200 px-3 py-3 text-sm"
                  >
                    Reset
                  </button>
                </>
              )}

              {!isAssignmentDirectory && (
                <span className="text-sm text-slate-500">
                  {plural(filtered.length, "record")}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                {columns.map((column) => (
                  <th
                    key={column.label}
                    className={`whitespace-nowrap px-4 py-3 font-semibold text-slate-600 ${column.center ? "text-center" : "text-left"}`}
                  >
                    {column.label}
                  </th>
                ))}

                {showActions && (
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    Actions
                  </th>
                )}
              </tr>
            </thead>

            <tbody>
              {paginated.map((row) => (
                <tr key={row.id} className="transition hover:bg-violet-50/30">
                  {columns.map((column) => (
                    <td
                      key={column.label}
                      className={`border-b border-slate-100 px-4 py-3 ${column.center ? "text-center" : ""}`}
                    >
                      {column.render(row)}
                    </td>
                  ))}

                  {showActions && (
                  <td className="border-b border-slate-100 px-4 py-3">
                    <div className="flex items-center gap-2">
                      {rowActions?.(row, reload)}

                      {Form &&
                        has("edit") &&
                        (rowEditable?.(row) ?? true) && (
                        <button
                          type="button"
                          title="Edit"
                          onClick={() => open(row)}
                          className="rounded-lg border border-slate-200 p-2 text-violet-600 transition hover:bg-violet-50"
                        >
                          <Pencil size={17} />
                        </button>
                      )}

                      {Form &&
                        has("delete") &&
                        (rowDeletable?.(row) ?? true) && (
                        <button
                          type="button"
                          title="Delete"
                          onClick={() => setDeleting(row)}
                          className="rounded-lg border border-red-100 p-2 text-red-500 transition hover:bg-red-50"
                        >
                          <Trash2 size={17} />
                        </button>
                      )}
                    </div>
                  </td>
                  )}
                </tr>
              ))}

              {loading && (
                <tr>
                  <td
                    colSpan={columns.length + (showActions ? 1 : 0)}
                    className="px-4 py-10 text-center text-slate-500"
                  >
                    <Loader2 className="mx-auto animate-spin" />

                    <span className="mt-2 block">Loading records...</span>
                  </td>
                </tr>
              )}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={columns.length + (showActions ? 1 : 0)}
                    className="px-4 py-10 text-center text-slate-500"
                  >
                    No records found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3">
          <Pagination
            page={current}
            setPage={setPage}
            total={filtered.length}
            limit={limit}
            setLimit={setLimit}
          />
        </div>
      </section>

      {/* Create / Edit Modal */}

      {mounted &&
        editing &&
        Form &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-4">
            <EscapeKey onEscape={() => !busy && setEditing(null)} />
            <div
              className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ${
                entity === "products" ||
                entity === "assignments" ||
                entity === "roles"
                  ? "max-w-[1250px]"
                  : "max-w-3xl"
              }`}
            >
              {/* Fixed modal header */}

              <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
                <h2 className="text-lg font-bold text-slate-900 sm:text-xl">
                  {editing.id ? "Edit" : "Create"} {title}
                </h2>

                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  aria-label="Close"
                  disabled={busy}
                  className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100"
                >
                  <X size={20} />
                </button>
              </div>

              <form
                onSubmit={(event) => {
                  event.preventDefault();

                  void save();
                }}
                className="flex min-h-0 flex-1 flex-col"
              >
                {/* Scrollable form body */}

                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                  <div
                    className="grid grid-cols-1 gap-4 sm:grid-cols-2

                  [&_label]:flex

                  [&_label]:flex-col

                  [&_label]:gap-2

                  [&_label]:text-sm

                  [&_label]:font-medium

                  [&_label]:text-slate-700

                  [&_input:not([type=checkbox])]:w-full

                  [&_input:not([type=checkbox])]:rounded-xl

                  [&_input:not([type=checkbox])]:border

                  [&_input:not([type=checkbox])]:border-slate-200

                  [&_input:not([type=checkbox])]:p-3

                  [&_select]:w-full

                  [&_select]:rounded-xl

                  [&_select]:border

                  [&_select]:border-slate-200

                  [&_select]:bg-white

                  [&_select]:p-3"
                  >
                    <Form
                      value={editing}
                      change={change}
                      related={related}
                      data={data}
                      upload={upload}
                    />
                  </div>
                </div>

                {/* Fixed modal footer */}

                <div className="flex shrink-0 justify-end gap-3 border-t border-slate-100 bg-white px-5 py-4 sm:px-6">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setEditing(null)}
                    className="rounded-xl bg-slate-100 px-5 py-2.5 font-semibold text-slate-700 transition hover:bg-slate-200 disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={busy}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
                  >
                    {busy ? (
                      <Loader2 size={17} className="animate-spin" />
                    ) : (
                      <Save size={17} />
                    )}

                    {busy ? "Saving..." : "Save"}
                  </button>
                </div>
              </form>
            </div>
          </div>,

          document.body,
        )}

      {/* Delete confirmation */}

      {mounted &&
        deleting &&
        createPortal(
          <DeleteConfirmModal
            name={
              deleting.name ||
              deleting.itemName ||
              deleting.number ||
              deleting.sn ||
              (deleting.model?.name &&
                `assignment for ${deleting.model.name}`) ||
              "Selected record"
            }
            busy={busy}
            onCancel={() => setDeleting(null)}
            onConfirm={remove}
          />,

          document.body,
        )}
    </>
  );
}
