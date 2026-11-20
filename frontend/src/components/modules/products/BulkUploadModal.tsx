"use client";

import { useRef, useState } from "react";
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import toast from "react-hot-toast";

import { api } from "@/lib/client-api";
import { EscapeKey } from "@/lib/useEscapeKey";

type BulkRow = {
  row: number;
  code: string;
  supplierCode: string;
  autoSupplierCode: boolean;
  supplierName: string;
  itemName: string;
  category: string;
  template: string;
  pp: string;
  sp: string;
  errors: string[];
};

type BulkResponse = { rows: BulkRow[]; created?: string[] };

const readableError = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong";

export default function BulkUploadModal({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: () => void | Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<BulkRow[] | null>(null);
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [busy, setBusy] = useState<"" | "sample" | "check" | "import">("");

  const ready = rows?.filter((r) => !r.errors.length).length ?? 0;
  const failed = (rows?.length ?? 0) - ready;
  const shown = rows?.filter((r) => !errorsOnly || r.errors.length) ?? [];

  const send = (selected: File, mode: "preview" | "import") => {
    const form = new FormData();
    form.append("file", selected);
    form.append("mode", mode);
    return api<BulkResponse>("products/bulk", { method: "POST", body: form });
  };

  const downloadSample = async () => {
    setBusy("sample");
    try {
      const res = await fetch("/api/products/bulk/template");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Download failed (${res.status})`);
      }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = "product-bulk-upload-sample.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(readableError(e));
    } finally {
      setBusy("");
    }
  };

  const check = async (selected: File) => {
    setFile(selected);
    setRows(null);
    setErrorsOnly(false);
    if (!/\.xlsx$/i.test(selected.name)) {
      toast.error("Please choose an Excel .xlsx file");
      return;
    }
    setBusy("check");
    try {
      const data = await send(selected, "preview");
      setRows(data.rows);
    } catch (e) {
      toast.error(readableError(e));
      setFile(null);
    } finally {
      setBusy("");
    }
  };

  const importRows = async () => {
    if (!file || !ready) return;
    setBusy("import");
    try {
      const data = await send(file, "import");
      const created = data.created?.length ?? 0;
      const skipped = data.rows.length - created;
      if (!created) {
        // Data changed since the preview; show the fresh result.
        setRows(data.rows);
        toast.error("No products were imported. Fix the errors and try again.");
        return;
      }
      toast.success(
        `${created} product${created === 1 ? "" : "s"} imported` +
          (skipped ? `, ${skipped} skipped` : ""),
      );
      await onImported();
      onClose();
    } catch (e) {
      toast.error(readableError(e));
    } finally {
      setBusy("");
    }
  };

  const reset = () => {
    setFile(null);
    setRows(null);
    if (input.current) input.current.value = "";
  };

  return (
    <>
      <EscapeKey onEscape={() => !busy && onClose()} />
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3">
        <div className="flex max-h-[94vh] w-full max-w-[1100px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="flex shrink-0 items-center justify-between border-b px-6 py-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-violet-600">
                Catalog Management
              </p>
              <h2 className="text-xl font-bold">Bulk Upload Products</h2>
            </div>
            <button
              disabled={!!busy}
              onClick={onClose}
              className="rounded-lg p-2 hover:bg-slate-100"
            >
              <X />
            </button>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 p-5">
                <p className="text-sm font-bold text-slate-900">
                  1. Download the sample
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Columns: Code, Supplier Code, Supplier Name, Product Name,
                  Category, Template, PP, SP. Code is generated automatically.
                  Leave Supplier Code blank to auto-generate it.
                </p>
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => void downloadSample()}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-50"
                >
                  {busy === "sample" ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Download size={16} />
                  )}
                  Download Sample
                </button>
              </div>

              <div className="rounded-2xl border border-slate-200 p-5">
                <p className="text-sm font-bold text-slate-900">
                  2. Upload your Excel file
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  .xlsx only, up to 1000 rows. Rows are checked before import.
                </p>
                <input
                  ref={input}
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  onChange={(e) => {
                    const selected = e.target.files?.[0];
                    if (selected) void check(selected);
                  }}
                />
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => {
                      if (input.current) input.current.value = "";
                      input.current?.click();
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                  >
                    {busy === "check" ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Upload size={16} />
                    )}
                    {file ? "Choose Another File" : "Choose File"}
                  </button>
                  {file && (
                    <span className="inline-flex min-w-0 items-center gap-1 text-sm text-slate-600">
                      <FileSpreadsheet size={16} className="shrink-0 text-emerald-600" />
                      <span className="truncate">{file.name}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {rows && (
              <div className="rounded-2xl border border-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <span className="font-bold text-slate-900">
                      {rows.length} rows
                    </span>
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                      <CheckCircle2 size={16} /> {ready} ready
                    </span>
                    {failed > 0 && (
                      <span className="inline-flex items-center gap-1 font-semibold text-red-600">
                        <XCircle size={16} /> {failed} with errors (will be skipped)
                      </span>
                    )}
                  </div>
                  {failed > 0 && (
                    <label className="inline-flex items-center gap-2 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        checked={errorsOnly}
                        onChange={(e) => setErrorsOnly(e.target.checked)}
                      />
                      Show errors only
                    </label>
                  )}
                </div>
                <div className="max-h-[45vh] overflow-auto">
                  <table className="w-full min-w-[1000px] text-left text-sm">
                    <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Row</th>
                        <th className="px-3 py-2">Code</th>
                        <th className="px-3 py-2">Supplier Code</th>
                        <th className="px-3 py-2">Supplier</th>
                        <th className="px-3 py-2">Product Name</th>
                        <th className="px-3 py-2">Category</th>
                        <th className="px-3 py-2">Template</th>
                        <th className="px-3 py-2">PP</th>
                        <th className="px-3 py-2">SP</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shown.map((r) => (
                        <tr
                          key={r.row}
                          className={`border-t ${r.errors.length ? "bg-red-50/60" : ""}`}
                        >
                          <td className="px-3 py-2 text-slate-500">{r.row}</td>
                          <td className="px-3 py-2 font-semibold text-violet-700">
                            {r.code || "-"}
                          </td>
                          <td className="px-3 py-2 font-semibold">
                            {r.supplierCode || "-"}
                            {r.autoSupplierCode && r.supplierCode && (
                              <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-500">
                                auto
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2">{r.supplierName || "-"}</td>
                          <td className="px-3 py-2">{r.itemName || "-"}</td>
                          <td className="px-3 py-2">{r.category || "-"}</td>
                          <td className="px-3 py-2">{r.template || "-"}</td>
                          <td className="px-3 py-2">{r.pp || "-"}</td>
                          <td className="px-3 py-2">{r.sp || "-"}</td>
                          <td className="px-3 py-2">
                            {r.errors.length ? (
                              <ul className="space-y-0.5 text-xs text-red-600">
                                {r.errors.map((err) => (
                                  <li key={err}>{err}</li>
                                ))}
                              </ul>
                            ) : (
                              <span className="font-semibold text-emerald-700">
                                Ready
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="flex shrink-0 justify-end gap-3 border-t px-6 py-4">
            <button
              type="button"
              disabled={!!busy}
              onClick={rows ? reset : onClose}
              className="rounded-xl border px-5 py-3 font-semibold"
            >
              {rows ? "Clear" : "Cancel"}
            </button>
            <button
              type="button"
              disabled={!!busy || !ready}
              onClick={() => void importRows()}
              className="inline-flex items-center rounded-xl bg-violet-600 px-6 py-3 font-semibold text-white disabled:opacity-50"
            >
              {busy === "import" && (
                <Loader2 size={16} className="mr-2 animate-spin" />
              )}
              Import {ready || ""} Product{ready === 1 ? "" : "s"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
