"use client";

import { Printer, X, ClipboardList } from "lucide-react";
import { checkLabels, type FieldOption, type QualityChecks } from "./TemplateFormModal";
import { useEscapeKey } from "@/lib/useEscapeKey";

type TemplatePreview = {
  id: string;
  name: string;
  status?: string;
  category?: { name: string } | null;
  sizes?: string[];
  fields?: Array<{ fieldId?: string; field?: { id?: string; name?: string }; name?: string }>;
  fieldIds?: string[];
  qualityChecks?: Partial<QualityChecks>;
  noMeasurementFieldId?: string | null;
  noMeasurementText?: string | null;
};
const checks = Object.entries(checkLabels) as Array<[keyof QualityChecks, string]>;

export default function TemplatePreviewModal({ template, fields, onClose }: {
  template: TemplatePreview;
  fields: FieldOption[];
  onClose: () => void;
}) {
  useEscapeKey(onClose);

  const linked = Array.isArray(template.fields) ? template.fields : [];
  const ids = linked.length ? linked.map((f) => f.fieldId || f.field?.id || "") : template.fieldIds || [];
  const byId = new Map(fields.map((f) => [f.id, f.name]));
  const names = ids.map((id, index) => byId.get(id) || linked[index]?.field?.name || linked[index]?.name || "Unknown field");
  const uniqueNames = names.filter((n, i) => names.findIndex((x) => x.toLowerCase() === n.toLowerCase()) === i);
  const sizes = Array.isArray(template.sizes) ? template.sizes : [];
  const noMeasurement = sizes.length === 0 && uniqueNames.length === 0;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/70 p-3 sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={`Preview ${template.name}`} className="flex max-h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 print:hidden">
          <div className="flex items-center gap-3"><span className="rounded-xl bg-indigo-100 p-2 text-indigo-700"><ClipboardList size={20}/></span>
            <div><h2 className="font-bold text-slate-900">Measurement Table Preview</h2><p className="text-xs text-slate-500">{template.name} · {noMeasurement ? "No measurement" : "Blank size chart"}</p></div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"><Printer size={16}/> Print</button>
            <button type="button" onClick={onClose} aria-label="Close preview" className="rounded-lg p-2 hover:bg-slate-100"><X size={20}/></button>
          </div>
        </div>
        <div className="overflow-auto bg-slate-100 p-3 sm:p-6 print:overflow-visible print:bg-white print:p-0">
          <div className={`mx-auto max-w-5xl bg-white p-4 text-slate-950 shadow-sm sm:p-8 print:min-w-0 print:p-0 print:shadow-none ${noMeasurement ? "" : "min-w-[760px]"}`}>
            {noMeasurement ? (
              <>
                <table className="w-full table-fixed border-collapse text-center text-[11px] sm:text-xs"><tbody>
                  <tr><th colSpan={6} className="border-2 border-slate-800 bg-slate-200 py-3 text-lg font-extrabold tracking-wide">MEASUREMENT TABLE</th></tr>
                  <tr><th className="border border-slate-800 bg-slate-100 p-2 text-left">Item Name:</th><td colSpan={2} className="border border-slate-800 p-2 text-left font-semibold">{template.name}</td><th className="border border-slate-800 bg-slate-100 p-2">PP:</th><td className="border border-slate-800 p-2"/><th className="border border-slate-800 bg-slate-100 p-2">SN:</th></tr>
                  <tr><th className="border border-slate-800 bg-slate-100 p-2">SPN:</th><td colSpan={2} className="border border-slate-800 p-2"/><th className="border border-slate-800 bg-slate-100 p-2">WP:</th><td className="border border-slate-800 p-2"/><th className="border border-slate-800 bg-slate-100 p-2">Fabric:</th></tr>
                </tbody></table>
                <table className="mt-4 w-full table-fixed border-collapse text-center text-xs"><thead><tr>
                  <th className="w-1/4 border-2 border-slate-800 bg-slate-200 px-2 py-3 font-extrabold">SIZE TAG</th>
                  <th className="border-2 border-slate-800 bg-slate-200 px-2 py-3 font-extrabold">TEXT</th>
                </tr></thead><tbody><tr>
                  <th className="border border-slate-800 bg-slate-50 px-3 py-4 font-bold">{byId.get(template.noMeasurementFieldId || "") || "No Size"}</th>
                  <td className="whitespace-pre-wrap break-words border border-slate-800 px-3 py-4 text-left">{template.noMeasurementText || "-"}</td>
                </tr></tbody></table>
              </>
            ) : (
              <>
                <table className="w-full table-fixed border-collapse text-center text-[11px] sm:text-xs"><tbody>
                  <tr><th colSpan={6} className="border-2 border-slate-800 bg-slate-200 py-3 text-lg font-extrabold tracking-wide">MEASUREMENT TABLE</th></tr>
                  <tr><th className="border border-slate-800 bg-slate-100 p-2 text-left">Item Name:</th><td colSpan={2} className="border border-slate-800 p-2 text-left font-semibold">{template.name}</td><th className="border border-slate-800 bg-slate-100 p-2">PP:</th><td className="border border-slate-800 p-2"/><th className="border border-slate-800 bg-slate-100 p-2">SN:</th></tr>
                  <tr><th className="border border-slate-800 bg-slate-100 p-2">SPN:</th><td colSpan={2} className="border border-slate-800 p-2"/><th className="border border-slate-800 bg-slate-100 p-2">WP:</th><td className="border border-slate-800 p-2"/><th className="border border-slate-800 bg-slate-100 p-2">Fabric:</th></tr>
                </tbody></table>
                <div className="overflow-x-auto"><table className="mt-4 w-full min-w-[650px] border-collapse text-center text-xs"><thead><tr>
                  <th className="border-2 border-slate-800 bg-slate-200 px-2 py-3 font-extrabold">SIZE TAG</th>
                  {uniqueNames.map((name) => <th key={name} className="border-2 border-slate-800 bg-slate-200 px-2 py-3 font-extrabold uppercase">{name}</th>)}
                </tr></thead><tbody>
                  {sizes.map((size, i) => <tr key={`${size}-${i}`}><th className="border border-slate-800 bg-slate-50 px-3 py-4 font-bold">{size}</th>
                    {uniqueNames.map((name) => <td key={name} className="h-11 border border-slate-800">&nbsp;</td>)}
                  </tr>)}
                </tbody></table></div>
                {!uniqueNames.length && <p className="mt-3 text-center text-sm text-amber-700">No measurement fields are linked to this template.</p>}
              </>
            )}
            <div className="mt-8 grid grid-cols-2 border-l border-t border-slate-800 sm:grid-cols-4">
              {checks.map(([key, label]) => <div key={key} className="flex min-h-16 items-center justify-between gap-2 border-b border-r border-slate-800 px-3 py-2"><span className="text-xs font-semibold">{label}</span>
                <span aria-label={template.qualityChecks?.[key] ? "Enabled" : "Not enabled"} className="flex h-5 w-5 shrink-0 items-center justify-center border border-slate-800 text-sm font-bold">{template.qualityChecks?.[key] ? "✓" : ""}</span>
              </div>)}
            </div>
            <p className="mt-3 text-right text-[10px] text-slate-500">Preview only · Measurement values are not stored in this template.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
