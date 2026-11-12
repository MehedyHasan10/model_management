"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Eye, RotateCcw } from "lucide-react";

import { useAccount } from "@/components/Shell";
import ResourcePage from "@/components/shared/ResourcePage";
import {
  assignmentColumns,
  AssignmentDetails,
  ReceiveReturn,
} from "../assignments/AssignmentsPage";

const sentQty = (row: any): number =>
  (row.items || []).reduce(
    (total: number, item: any) => total + Number(item.sentQty || 0),
    0,
  );

const returnedQty = (row: any): number =>
  (row.items || []).reduce(
    (total: number, item: any) =>
      total +
      (item.returnItems || []).reduce(
        (sum: number, ret: any) => sum + Number(ret.quantity || 0),
        0,
      ),
    0,
  );

export default function ReturnsPage() {
  const account = useAccount();
  const canReceive =
    account.permissions.includes("*") ||
    account.permissions.includes("returns.receive") ||
    account.permissions.includes("assignments.receive");

  const [selectedReturn, setSelectedReturn] = useState<any | null>(null);
  const [selectedDetails, setSelectedDetails] = useState<any | null>(null);
  const [reload, setReload] = useState<(() => Promise<void>) | null>(null);

  return (
    <>
      <ResourcePage
        entity="returns"
        endpoint="assignments"
        title="Return Management"
        columns={assignmentColumns}
        rowActions={(row, refresh) => {
          const status = String(row.status || "").toUpperCase();
          const canReturn =
            canReceive &&
            !["COMPLETED", "CANCELLED", "DRAFT"].includes(status) &&
            sentQty(row) > returnedQty(row);

          return (
            <div className="flex items-center justify-center gap-1">
              <button
                type="button"
                title="View Assignment Details"
                aria-label="View Assignment Details"
                onClick={() => setSelectedDetails(row)}
                className="rounded-lg p-2 text-blue-600 transition hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
              >
                <Eye size={18} />
              </button>

              {canReturn && (
                <button
                  type="button"
                  title="Receive Return"
                  aria-label="Receive Return"
                  onClick={() => {
                    setSelectedReturn(row);
                    setReload(() => refresh);
                  }}
                  className="rounded-lg p-2 text-violet-600 transition hover:bg-violet-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500"
                >
                  <RotateCcw size={17} />
                </button>
              )}
            </div>
          );
        }}
      />

      {selectedDetails &&
        typeof document !== "undefined" &&
        createPortal(
          <AssignmentDetails
            assignment={selectedDetails}
            onClose={() => setSelectedDetails(null)}
          />,
          document.body,
        )}

      {selectedReturn &&
        typeof document !== "undefined" &&
        createPortal(
          <ReceiveReturn
            assignment={selectedReturn}
            onClose={() => setSelectedReturn(null)}
            onSaved={() => {
              void reload?.();
            }}
          />,
          document.body,
        )}
    </>
  );
}
