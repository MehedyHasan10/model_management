"use client";

import { useMemo, useRef } from "react";
import { Printer, X } from "lucide-react";
import { useEscapeKey } from "@/lib/useEscapeKey";
import { measurementText } from "@/lib/measurement";
import { EMPTY } from "@/lib/format";

export type PreviewProduct = {
  sn: string;
  code?: string | null;
  itemName: string;
  category?: { name: string };
  template?: {
    name: string;
    sizes?: string[];
    fields?: { fieldId: string; field?: { name: string; unit?: { name: string; symbol: string } | null } }[];
    noMeasurementFieldId?: string | null;
    noMeasurementText?: string | null;
  };
  pp?: string | null;
  sp?: string | null;
  supplierCode?: string | null;
  supplier?: { name: string } | null;
  wp?: string | null;
  fabric?: string | null;
  notes?: string | null;
  noSizeText?: string | null;
  images?: Array<string | { url: string }>;
  measurements?: Array<{
    size: string;
    fieldId: string;
    value: number | string | null;
  }>;
};

const printableCSS = `
  @page { size: A4 portrait; margin: 11mm; }
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; color: #172033; background: white; font: 10px/1.35 Arial, Helvetica, sans-serif; }
  .print-document { width: 100%; }
  .print-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding-bottom: 8px; margin-bottom: 10px; border-bottom: 2px solid #6d28d9; }
  .print-kicker { color: #6d28d9; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; }
  .print-title { margin: 3px 0 0; font-size: 18px; line-height: 1.2; }
  .print-id { font-size: 10px; font-weight: 700; color: #475569; white-space: nowrap; }
  .print-section { margin: 12px 0 6px; font-size: 12px; font-weight: 700; }
  .print-details { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
  .print-detail { border: 1px solid #e2e8f0; border-radius: 5px; padding: 6px 8px; min-width: 0; overflow-wrap: anywhere; break-inside: avoid; }
  .print-detail-label { font-size: 8px; color: #64748b; margin-bottom: 3px; }
  .print-detail-value { font-size: 10px; font-weight: 600; white-space: pre-wrap; }
  .print-images { display: flex; flex-wrap: wrap; gap: 7px; }
  .print-image { width: 94px; height: 94px; object-fit: cover; border: 1px solid #e2e8f0; border-radius: 5px; break-inside: avoid; }
  .print-table-wrap { width: 100%; }
  .print-table { width: 100%; border-collapse: collapse; table-layout: auto; font-size: 9px; }
  .print-table th, .print-table td { border: 1px solid #cbd5e1; padding: 5px 6px; text-align: left; overflow-wrap: anywhere; }
  .print-table th { background: #f1f5f9; font-weight: 700; }
  .print-table thead { display: table-header-group; }
  .print-table tr { break-inside: avoid; page-break-inside: avoid; }
  .print-empty { color: #64748b; font-size: 10px; }
  @media print { .print-section, .print-header { break-after: avoid; } .print-table-wrap { break-inside: auto; } }
`;

export default function ProductPreviewModal({
  product,
  onClose,
}: {
  product: PreviewProduct;
  onClose: () => void;
}) {
  const printingRef = useRef(false);
  const images = useMemo(
    () =>
      (product.images || []).map((image) =>
        typeof image === "string" ? image : image.url,
      ),
    [product.images],
  );
  const fields = product.template?.fields || [];
  const allSizes = product.template?.sizes?.length
    ? product.template.sizes
    : Array.from(
        new Set(
          (product.measurements || []).map((measurement) => measurement.size),
        ),
      );
  const valueFor = (size: string, fieldId: string) =>
    measurementText(
      product.measurements?.find(
        (measurement) =>
          measurement.size === size && measurement.fieldId === fieldId,
      )?.value,
    );
  // Only sizes with at least one value are shown (on screen and in print).
  const sizes = allSizes.filter((size) =>
    fields.some((field) => valueFor(size, field.fieldId) !== ""),
  );
  const noMeasurementTemplate =
    !!product.template &&
    !(product.template.sizes?.length ?? 0) &&
    fields.length === 0;

  const details = [
    ["Code", product.sn],
    ["Supplier Name", product.supplier?.name],
    ["Supplier Code", product.supplierCode],
    ["Category", product.category?.name],
    ["Template", product.template?.name],
    ["PP", product.pp],
    ["SP", product.sp],
    ["WP", product.wp],
    ["Fabric", product.fabric],
    ["Notes", product.notes],
  ] as const;

  useEscapeKey(onClose);

  const print = async () => {
    if (printingRef.current) return;
    const content = document.getElementById("product-measurement-print-area");
    if (!content) return;
    printingRef.current = true;
    const iframe = document.createElement("iframe");
    iframe.setAttribute("title", "Product print document");
    iframe.style.cssText =
      "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none";
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument;
    if (!doc) {
      iframe.remove();
      printingRef.current = false;
      return;
    }
    const escapedTitle = `Product ${product.sn}`.replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c] || c,
    );
    doc.open();
    doc.write(
      `<!doctype html><html><head><meta charset="utf-8"/><title>${escapedTitle}</title><style>${printableCSS}</style></head><body>${content.innerHTML}</body></html>`,
    );
    doc.close();
    try {
      await Promise.race([
        Promise.all(
          Array.from(doc.images).map((img) => {
            if (img.complete) return Promise.resolve();
            return new Promise<void>((resolve) => {
              img.addEventListener("load", () => resolve(), { once: true });
              img.addEventListener("error", () => resolve(), { once: true });
            });
          }),
        ),
        new Promise<void>((resolve) => setTimeout(resolve, 5000)),
      ]);
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      // Allow the browser print dialog time to consume the iframe document.
      setTimeout(() => {
        iframe.remove();
        printingRef.current = false;
      }, 30000);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-3"
      role="presentation"
    >
      <div
        className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Product preview"
      >
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b p-5">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-violet-600">
              Product Preview
            </h2>
            {/* <h2 className="text-xl font-bold text-slate-900">
              {product.itemName} · {product.sn}
            </h2> */}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void print()}
              className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
            >
              <Printer size={16} /> Print / PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-lg p-2 hover:bg-slate-100"
            >
              <X />
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
          <div id="product-measurement-print-area" className="print-document">
            <div className="print-header flex items-start justify-between gap-3 border-b-2 border-violet-600 pb-3">
              <div>
                <div className="print-kicker text-xs font-bold uppercase tracking-widest text-violet-700">
                  Product Information
                </div>
                <h1 className="print-title mt-1 text-2xl font-bold text-slate-900">
                  {product.itemName}
                </h1>
              </div>
              <span className="print-id whitespace-nowrap text-sm font-bold text-slate-600">
                {product.sn}
              </span>
            </div>
            <h2 className="print-section mb-3 mt-5 text-base font-bold text-slate-900">
              Product Details
            </h2>
            <div className="print-details grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {details.map(([label, value]) => (
                <div
                  className="print-detail rounded-lg border border-slate-200 p-3"
                  key={label}
                >
                  <div className="print-detail-label text-xs text-slate-500">
                    {label}
                  </div>
                  <div className="print-detail-value mt-1 break-words text-sm font-semibold text-slate-800">
                    {value?.trim() || EMPTY}
                  </div>
                </div>
              ))}
            </div>
            <h2 className="print-section mb-3 mt-5 text-base font-bold text-slate-900">
              Product Images ({images.length})
            </h2>
            <div className="print-images flex flex-wrap gap-3">
              {images.length ? (
                images.map((url, index) => (
                  <img
                    className="print-image h-28 w-28 rounded-lg border border-slate-200 object-cover"
                    loading="lazy"
                    decoding="async"
                    src={url}
                    alt={`Product image ${index + 1}`}
                    key={`${index}-${url.slice(0, 30)}`}
                  />
                ))
              ) : (
                <p className="print-empty text-sm text-slate-500">No images</p>
              )}
            </div>
            <h2 className="print-section mb-3 mt-5 text-base font-bold text-slate-900">
              Size Measurements
            </h2>
            {noMeasurementTemplate && product.template ? (
              <div className="print-table-wrap overflow-x-auto rounded-lg border border-slate-200">
                <table className="print-table w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="w-1/4 border border-slate-200 p-2">
                        SIZE TAG
                      </th>
                      <th className="border border-slate-200 p-2">TEXT</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-slate-200 p-2 font-semibold">
                        No Size / Free Size
                      </td>
                      <td className="whitespace-pre-wrap border border-slate-200 p-2">
                        {product.noSizeText ||
                          product.template.noMeasurementText ||
                          EMPTY}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : sizes.length ? (
              <div className="print-table-wrap overflow-x-auto rounded-lg border border-slate-200">
                <table className="print-table w-full min-w-max border-collapse text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="border border-slate-200 p-2 text-left">
                        Size
                      </th>
                      {fields.map((field) => (
                        <th
                          className="border border-slate-200 p-2 text-left"
                          key={field.fieldId}
                        >
                          {field.field?.name || field.fieldId}
                          {field.field?.unit?.symbol ? ` (${field.field.unit.symbol})` : ""}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sizes.map((size) => (
                      <tr key={size}>
                        <td className="border border-slate-200 p-2 font-semibold">
                          {size}
                        </td>
                        {fields.map((field) => (
                          <td
                            className="border border-slate-200 p-2"
                            key={field.fieldId}
                          >
                            {valueFor(size, field.fieldId) || EMPTY}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="print-empty text-sm text-slate-500">
                No measurements added yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
