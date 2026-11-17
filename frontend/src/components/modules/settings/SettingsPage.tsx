"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  Hash,
  Settings2,
  Save,
  RefreshCw,
  Eye,
  Info,
  LockKeyhole,
  CheckCircle2,
  Loader2,
} from "lucide-react";

import { useAccount } from "@/components/Shell";
import { api } from "@/lib/client-api";

type SerialSettings = {
  id?: string;
  prefix: string;
  digits: number;
  nextNumber: number;
};

export default function SettingsPage() {
  const account = useAccount();

  const canEdit =
    account.permissions.includes("*") ||
    account.permissions.includes("settings.edit");

  const [settings, setSettings] = useState<SerialSettings | null>(null);

  const [original, setOriginal] = useState<SerialSettings | null>(null);

  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadSettings = useCallback(async () => {
    setLoading(true);

    try {
      const data = await api<SerialSettings>("settings");

      setSettings(data);
      setOriginal({ ...data });
    } catch (error: any) {
      toast.error(error?.message || "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const preview = useMemo(() => {
    if (!settings) return "-";

    const prefix = settings.prefix || "";
    const digits = Number(settings.digits) || 1;
    const number = Number(settings.nextNumber) || 1;

    return prefix + String(number).padStart(digits, "0");
  }, [settings]);

  const isChanged =
    settings !== null &&
    original !== null &&
    (settings.prefix !== original.prefix ||
      settings.digits !== original.digits ||
      settings.nextNumber !== original.nextNumber);

  const update = (key: keyof SerialSettings, value: string | number) => {
    setSettings((previous) =>
      previous
        ? {
            ...previous,
            [key]: value,
          }
        : previous,
    );
  };

  const validate = () => {
    if (!settings) return "Settings not loaded";

    if (!settings.prefix.trim()) {
      return "Serial prefix is required";
    }

    if (
      !Number.isInteger(settings.digits) ||
      settings.digits < 1 ||
      settings.digits > 12
    ) {
      return "Digits must be between 1 and 12";
    }

    if (!Number.isInteger(settings.nextNumber) || settings.nextNumber < 1) {
      return "Next number must be a positive integer";
    }

    return null;
  };

  const save = async () => {
    if (!settings || busy || !canEdit) return;

    const error = validate();

    if (error) {
      toast.error(error);
      return;
    }

    setBusy(true);

    try {
      await api("settings/product", {
        method: "PATCH",
        body: JSON.stringify({
          prefix: settings.prefix.trim(),
          digits: settings.digits,
          nextNumber: settings.nextNumber,
        }),
      });

      toast.success("Code settings saved");

      await loadSettings();
    } catch (error: any) {
      toast.error(error?.message || "Failed to save settings");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Heading */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Code Settings</h1>

          <p className="mt-1 text-sm text-slate-500">
            Configure product code generation
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadSettings()}
          disabled={loading || busy}
          title="Refresh Settings"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-violet-50 hover:text-violet-700 disabled:opacity-50"
        >
          <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {loading && !settings ? (
        <div className="flex min-h-64 items-center justify-center rounded-2xl border border-slate-200 bg-white">
          <Loader2 size={28} className="animate-spin text-violet-600" />
        </div>
      ) : settings ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {/* Main Settings Card */}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:col-span-2">
            <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                <Settings2 size={23} />
              </div>

              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Serial Configuration
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Manage the numbering format for new products
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 p-6 sm:grid-cols-2">
              {/* Prefix */}
              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Serial Prefix
                </label>

                <div className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 transition focus-within:border-violet-500">
                  <Hash size={18} className="text-slate-400" />

                  <input
                    type="text"
                    value={settings.prefix}
                    disabled={!canEdit || busy}
                    onChange={(e) => update("prefix", e.target.value)}
                    placeholder="e.g. MT"
                    className="w-full bg-transparent py-3 text-sm text-slate-800 outline-none disabled:cursor-not-allowed"
                  />
                </div>

                <p className="mt-2 text-xs text-slate-500">
                  Text displayed before the numeric serial number.
                </p>
              </div>

              {/* Digits */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Number of Digits
                </label>

                <input
                  type="number"
                  min={1}
                  max={12}
                  step={1}
                  value={settings.digits}
                  disabled={!canEdit || busy}
                  onChange={(e) => update("digits", Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-violet-500 disabled:bg-slate-50"
                />

                <p className="mt-2 text-xs text-slate-500">
                  Minimum numeric width, padded with zeros.
                </p>
              </div>

              {/* Next Number */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Next Code Number
                </label>

                <input
                  type="number"
                  min={1}
                  step={1}
                  value={settings.nextNumber}
                  disabled={!canEdit || busy}
                  onChange={(e) => update("nextNumber", Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-violet-500 disabled:bg-slate-50"
                />

                <p className="mt-2 text-xs text-slate-500">
                  Starting number for the next generated product.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 px-6 py-4">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                {canEdit ? (
                  <>
                    <CheckCircle2 size={16} className="text-emerald-600" />
                    You have permission to manage settings
                  </>
                ) : (
                  <>
                    <LockKeyhole size={16} className="text-amber-600" />
                    Read-only access
                  </>
                )}
              </div>

              {canEdit && (
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={busy || loading || !isChanged}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 size={17} className="animate-spin" />
                  ) : (
                    <Save size={17} />
                  )}

                  {busy ? "Saving..." : "Save Settings"}
                </button>
              )}
            </div>
          </section>

          {/* Preview Panel */}
          <aside className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <Eye size={21} />
                </div>

                <div>
                  <h2 className="font-bold text-slate-900">
                    Live Code Preview
                  </h2>

                  <p className="text-xs text-slate-500">
                    Based on current form values
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-violet-100 bg-gradient-to-br from-violet-50 to-indigo-50 px-4 py-7 text-center">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-violet-500">
                  Next Product Code
                </p>

                <p className="break-all text-3xl font-extrabold tracking-wide text-violet-700">
                  {preview}
                </p>
              </div>

              <p className="mt-4 text-center text-xs text-slate-500">
                Preview updates automatically as values change.
              </p>
            </div>

            {/* Information Card */}
            <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-5">
              <div className="flex items-center gap-2 font-semibold text-blue-800">
                <Info size={18} />
                Important Information
              </div>

              <p className="mt-3 text-sm leading-6 text-blue-700">
                Updating the code prefix or next number affects future product
                code generation. Existing product code numbers remain unchanged.
              </p>
            </div>
          </aside>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          Unable to load code settings.
        </div>
      )}
    </div>
  );
}
