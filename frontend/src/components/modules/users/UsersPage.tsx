"use client";

import { useState } from "react";

import ResourcePage, { type FormProps } from "@/components/shared/ResourcePage";

import { TextField, CheckList } from "@/components/shared/FormFields";

import {
  UserRound,
  Mail,
  ShieldCheck,
  CircleCheck,
  CircleX,
  LockKeyhole,
  Eye,
  EyeOff,
} from "lucide-react";

/* ---------------------------------------
   User Form
--------------------------------------- */

function Form({ value, change, related }: FormProps) {
  const isEdit = Boolean(value.id);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <>
      {/* Section Header */}
      <div className="col-span-full mb-1 flex items-center gap-3 border-b border-slate-100 pb-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
          <UserRound size={21} />
        </div>

        <div>
          <h3 className="text-base font-bold text-slate-900">
            {isEdit ? "Edit User Details" : "New User Details"}
          </h3>

          <p className="text-xs text-slate-500">
            Manage account information and access permissions
          </p>
        </div>
      </div>

      {/* Full Name */}
      <div className="col-span-full">
        <TextField
          label="Full Name"
          required
          value={value.name || ""}
          onChange={(v) => change("name", v)}
        />
      </div>

      {/* Create User Fields */}
      {!isEdit && (
        <>
          {/* Email and Password */}
          <div className="col-span-full grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="min-w-0">
              <TextField
                label="Email Address"
                type="email"
                required
                value={value.email || ""}
                onChange={(v) => change("email", v)}
              />
            </div>

            <div className="min-w-0">
              <label
                htmlFor="user-password"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Password (minimum 8 characters){" "}
              
              </label>

              <div className="relative">
                <input
                  id="user-password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={value.password || ""}
                  onChange={(e) => change("password", e.target.value)}
                  placeholder="Enter password"
                  className="h-[46px] w-full rounded-xl border border-slate-200 bg-white px-4 pr-12 text-sm text-slate-700 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-400 hover:text-violet-600"
                >
                  {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Edit User Fields */}
      {isEdit && (
        <>
          {/* Account Email */}
          <div className="col-span-full rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Mail size={16} className="text-slate-400" />
              Account Email
            </div>

            <p className="break-all text-sm text-slate-600">
              {value.email || "—"}
            </p>
          </div>

          {/* Account Status */}
          <div className="col-span-full">
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Account Status
            </label>

            <select
              value={value.status || "ACTIVE"}
              onChange={(e) => change("status", e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-violet-500"
            >
              <option value="ACTIVE">Active</option>
              <option value="DISABLED">Disabled</option>
            </select>

            <p className="mt-2 text-xs text-slate-500">
              Disabled accounts cannot access the application.
            </p>
          </div>
        </>
      )}

      {/* Roles & Permissions */}
      <div className="col-span-full mt-2">
        <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <ShieldCheck size={20} />
          </div>

          <div>
            <h3 className="text-base font-bold text-slate-900">
              Roles & Permissions
            </h3>

            <p className="text-xs text-slate-500">
              Select the roles assigned to this user
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
          <CheckList
            title="Assign Roles"
            options={related.roles || []}
            selected={value.roleIds || []}
            onChange={(v) => change("roleIds", v)}
          />
        </div>
      </div>

      {/* Security Notice */}
      <div className="col-span-full mt-2 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/60 p-4">
        <LockKeyhole size={18} className="mt-0.5 shrink-0 text-blue-600" />

        <p className="text-xs leading-5 text-blue-700">
          User access is controlled by assigned roles and permissions. Make sure
          the selected roles provide the appropriate level of access.
        </p>
      </div>
    </>
  );
}

/* ---------------------------------------
   Users Page
--------------------------------------- */

export default function UsersPage() {
  return (
    <ResourcePage
      entity="users"
      title="Users"
      initial={{
        name: "",
        email: "",
        password: "",
        roleIds: [],
        status: "ACTIVE",
      }}
      Form={Form}
      relatedKeys={["roles"]}
      prepareEdit={(row) => ({
        ...row,
        roleIds: row.roles?.map((role: any) => role.roleId) || [],
      })}
      columns={[
        {
          label: "User",
          render: (row) => {
            const name = String(row.name || "Unknown User");

            const initials = name
              .trim()
              .split(/\s+/)
              .slice(0, 2)
              .map((part) => part.charAt(0))
              .join("")
              .toUpperCase();

            return (
              <div className="flex min-w-44 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-sm font-bold text-white shadow-sm">
                  {initials || "U"}
                </div>

                <div>
                  <p className="font-semibold text-slate-900">{name}</p>

                  <p className="mt-0.5 text-xs text-slate-400">User Account</p>
                </div>
              </div>
            );
          },
        },

        {
          label: "Email Address",
          render: (row) => (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Mail size={15} className="shrink-0 text-slate-400" />

              <span className="break-all">{row.email || "—"}</span>
            </div>
          ),
        },

        {
          label: "Assigned Roles",
          render: (row) => {
            const roles = row.roles || [];

            if (!roles.length) {
              return (
                <span className="text-xs text-slate-400">
                  No roles assigned
                </span>
              );
            }

            return (
              <div className="flex max-w-72 flex-wrap gap-1.5">
                {roles.map((item: any, index: number) => (
                  <span
                    key={item.roleId || index}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-violet-100 bg-violet-50 px-2.5 py-1.5 text-xs font-semibold text-violet-700"
                  >
                    <ShieldCheck size={13} />
                    {item.role?.name || "Unknown"}
                  </span>
                ))}
              </div>
            );
          },
        },

        {
          label: "Status",
          center: true,
          render: (row) => {
            const active = row.status === "ACTIVE";

            return (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${
                  active
                    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                    : "bg-red-50 text-red-700 ring-red-200"
                }`}
              >
                {active ? <CircleCheck size={14} /> : <CircleX size={14} />}

                {active ? "Active" : "Disabled"}
              </span>
            );
          },
        },

        {
          label: "Created Date",
          render: (row) => (
            <span className="whitespace-nowrap text-sm text-slate-600">
              {row.createdAt
                ? new Date(row.createdAt).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })
                : "—"}
            </span>
          ),
        },
      ]}
      validate={(value) =>
        !value.name?.trim()
          ? "Name is required"
          : !value.id &&
              (!value.email?.includes("@") || value.password?.length < 8)
            ? "Valid email and password of at least 8 characters are required"
            : undefined
      }
    />
  );
}
