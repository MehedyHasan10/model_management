"use client";

import { useEffect, useMemo, useState } from "react";

import toast from "react-hot-toast";

import {
  ShieldCheck,
  Shield,
  Users,
  LockKeyhole,
  CheckCheck,
  RotateCcw,
  Search,
} from "lucide-react";

import ResourcePage, { type FormProps } from "@/components/shared/ResourcePage";

import { TextField } from "@/components/shared/FormFields";

import { api } from "@/lib/client-api";

const modules = [
  "dashboard",
  "suppliers",

  "categories",

  "fields",

  "templates",

  "products",

  "models",

  "assignments",

  "returns",

  "stock",

  "users",

  "roles",

  "settings",

  "audit",
];

const actions = [
  "view",

  "create",

  "edit",

  "delete",

  "assign",

  "receive",

  "export",
];

type Permission = {
  id: string;

  key: string;

  module?: string;

  action?: string;
};

const formatLabel = (value: string) =>
  value

    .replace(/([a-z])([A-Z])/g, "$1 $2")

    .replace(/[-_]/g, " ")

    .replace(/\b\w/g, (char) => char.toUpperCase());

function Form({ value, change }: FormProps) {
  const [permissions, setPermissions] = useState<Permission[]>([]);

  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;

    api<Permission[]>("permissions")
      .then((data) => {
        if (active) {
          setPermissions(Array.isArray(data) ? data : []);
        }
      })

      .catch((error) => {
        if (active) {
          toast.error(error?.message || "Failed to load permissions");
        }
      })

      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const lookup = useMemo(
    () => new Map(permissions.map((p) => [p.key, p.id])),

    [permissions],
  );

  const ids: string[] = value.permissionIds || [];

  const selected = new Set(ids);

  const availableIds = useMemo(
    () =>
      modules.flatMap((module) =>
        actions

          .map((action) => lookup.get(`${module}.${action}`))

          .filter((id): id is string => Boolean(id)),
      ),

    [lookup],
  );

  const selectedCount = availableIds.filter((id) => selected.has(id)).length;

  const toggleIds = (targetIds: string[], checked: boolean) => {
    const next = new Set(ids);

    targetIds.forEach((id) => {
      if (checked) next.add(id);
      else next.delete(id);
    });

    change("permissionIds", [...next]);
  };

  const filteredModules = modules.filter((module) =>
    formatLabel(module).toLowerCase().includes(search.toLowerCase()),
  );

  const allSelected =
    availableIds.length > 0 && availableIds.every((id) => selected.has(id));

  return (
    <>
      {/* Role Details */}

      <div className="col-span-full flex items-center gap-3 border-b border-slate-100 pb-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
          <ShieldCheck size={23} />
        </div>

        <div>
          <h3 className="text-base font-bold text-slate-900">
            {value.id ? "Edit Role" : "Create New Role"}
          </h3>

          <p className="text-xs text-slate-500">
            Configure role information and access permissions
          </p>
        </div>
      </div>

      <div className="col-span-full sm:col-span-1">
        <TextField
          label="Role Name"
          required
          value={value.name || ""}
          onChange={(v) => change("name", v)}
        />
      </div>

      <div className="col-span-full sm:col-span-1">
        <TextField
          label="Description"
          value={value.description || ""}
          onChange={(v) => change("description", v)}
        />
      </div>

      {/* Permission Matrix */}

      <div className="col-span-full mt-3 min-w-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <LockKeyhole size={21} />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900">
                Permission Matrix
              </h3>

              <p className="text-xs text-slate-500">
                Control module-wise access for this role
              </p>
            </div>
          </div>

          <span className="rounded-full border border-violet-100 bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700">
            {selectedCount} / {availableIds.length} Selected
          </span>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {/* Toolbar */}

          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/60 p-4">
            <div className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-slate-500">
              <Search size={16} />

              <input
                type="search"
                placeholder="Search modules..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-44 bg-transparent px-1 py-2.5 text-sm text-slate-700 outline-none sm:w-56"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={loading || availableIds.length === 0}
                onClick={() => toggleIds(availableIds, !allSelected)}
                className="inline-flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 transition hover:bg-violet-100 disabled:opacity-50"
              >
                <CheckCheck size={15} />

                {allSelected ? "Deselect All" : "Select All"}
              </button>

              <button
                type="button"
                disabled={selectedCount === 0}
                onClick={() => toggleIds(availableIds, false)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                <RotateCcw size={14} />
                Clear
              </button>
            </div>
          </div>

          {/* Matrix */}

          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[850px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="sticky left-0 z-10 min-w-44 bg-slate-50 px-4 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                    Module
                  </th>

                  {actions.map((action) => (
                    <th
                      key={action}
                      className="px-3 py-4 text-center text-xs font-bold uppercase tracking-wide text-slate-600"
                    >
                      {formatLabel(action)}
                    </th>
                  ))}

                  <th className="px-3 py-4 text-center text-xs font-bold uppercase tracking-wide text-slate-600">
                    All
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredModules.map((module) => {
                  const moduleIds = actions

                    .map((action) => lookup.get(`${module}.${action}`))

                    .filter((id): id is string => Boolean(id));

                  const moduleSelected =
                    moduleIds.length > 0 &&
                    moduleIds.every((id) => selected.has(id));

                  const moduleSelectedCount = moduleIds.filter((id) =>
                    selected.has(id),
                  ).length;

                  return (
                    <tr
                      key={module}
                      className="border-b border-slate-100 transition hover:bg-violet-50/30"
                    >
                      <td className="sticky left-0 z-10 bg-white px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                            <Shield size={17} />
                          </div>

                          <div>
                            <p className="font-semibold text-slate-800">
                              {formatLabel(module)}
                            </p>

                            <p className="text-[11px] text-slate-400">
                              {moduleSelectedCount}/{moduleIds.length} enabled
                            </p>
                          </div>
                        </div>
                      </td>

                      {actions.map((action) => {
                        const id = lookup.get(`${module}.${action}`);

                        const checked = Boolean(id && selected.has(id));

                        return (
                          <td key={action} className="px-3 py-3 text-center">
                            <input
                              type="checkbox"
                              aria-label={`${formatLabel(module)} ${formatLabel(action)}`}
                              disabled={!id}
                              checked={checked}
                              onChange={(e) => {
                                if (id) {
                                  toggleIds([id], e.target.checked);
                                }
                              }}
                              className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-violet-600 disabled:cursor-not-allowed disabled:opacity-20"
                            />
                          </td>
                        );
                      })}

                      <td className="px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          aria-label={`Select all ${formatLabel(module)} permissions`}
                          disabled={moduleIds.length === 0}
                          checked={moduleSelected}
                          onChange={(e) =>
                            toggleIds(moduleIds, e.target.checked)
                          }
                          className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-indigo-600 disabled:cursor-not-allowed disabled:opacity-20"
                        />
                      </td>
                    </tr>
                  );
                })}

                {!loading && filteredModules.length === 0 && (
                  <tr>
                    <td
                      colSpan={actions.length + 2}
                      className="px-4 py-10 text-center text-slate-500"
                    >
                      No modules found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {loading && (
            <div className="border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
              Loading available permissions...
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50/50 px-4 py-3">
            <p className="text-xs text-slate-500">
              Disabled checkboxes indicate unavailable permissions.
            </p>

            <p className="text-xs font-semibold text-slate-600">
              {selectedCount} permissions enabled
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export default function RolesPage() {
  return (
    <ResourcePage
      entity="roles"
      title="Roles & Permissions"
      initial={{
        name: "",

        description: "",

        permissionIds: [],
      }}
      Form={Form}
      prepareEdit={(row) => ({
        id: row.id,
        name: row.name || "",
        description: row.description || "",
        permissionIds: row.permissions?.map((p: any) => p.permissionId) || [],
      })}
      columns={[
        {
          label: "Role",

          render: (row) => (
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                <ShieldCheck size={21} />
              </div>

              <div>
                <p className="font-semibold text-slate-900">{row.name}</p>

                {row.system && (
                  <span className="mt-1 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                    SYSTEM ROLE
                  </span>
                )}

                {row.description && (
                  <p className="mt-1 max-w-xs truncate text-xs text-slate-500">
                    {row.description}
                  </p>
                )}
              </div>
            </div>
          ),
        },

        {
          label: "Users",

          center: true,

          render: (row) => (
            <div className="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-1.5 font-semibold text-blue-700">
              <Users size={15} />

              {row.users?.length || 0}
            </div>
          ),
        },

        {
          label: "Permissions",

          center: true,

          render: (row) => (
            <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-700">
              <LockKeyhole size={15} />

              {row.permissions?.length || 0}
            </div>
          ),
        },
      ]}
      validate={(value) =>
        !value.name?.trim() ? "Role name is required" : undefined
      }
    />
  );
}
