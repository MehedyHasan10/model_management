
"use client";

import ResourcePage from "@/components/shared/ResourcePage";

export default function AuditPage() {
  return (
    <ResourcePage
      entity="audit"
      title="Audit Logs"
      columns={[
        {
          label: "Date",
          render: (row) =>
            row.createdAt
              ? new Date(row.createdAt).toLocaleString("en-GB")
              : "—",
        },
        {
          label: "User",
          render: (row) => row.user?.name || "System",
        },
        {
          label: "Action",
          render: (row) => (
            <span
              className={`inline-flex rounded-lg px-3 py-1.5 text-xs font-semibold ${
                row.action === "CREATE"
                  ? "bg-blue-50 text-blue-700"
                  : row.action === "UPDATE"
                    ? "bg-amber-50 text-amber-700"
                    : row.action === "DELETE"
                      ? "bg-red-50 text-red-700"
                      : row.action === "RECEIVE"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-600"
              }`}
            >
              {row.action}
            </span>
          ),
        },
        {
          label: "Entity",
          render: (row) => (
            <span className="font-medium capitalize text-slate-700">
              {row.entity || "—"}
            </span>
          ),
        },
      ]}
    />
  );
}
