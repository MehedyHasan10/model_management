import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser, can } from "@/lib/auth";
import { fail } from "@/lib/common";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const started = performance.now();

  try {
    const u = await currentUser();

    if (!u) {
      return fail("Unauthorized", 401);
    }

    if (!(await can(u, "dashboard.view"))) {
      return fail("Forbidden", 403);
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      products,
      models,
      assignments,
      sentResult,
      returnedResult,
      suppliers,
      activeSuppliers,
      categories,
      activeTemplates,
      activeModels,
      productsThisMonth,
      contentDone,
      openAssignments,
      overdueAssignments,
      damagedResult,
    ] = await Promise.all([
      db.product.count(),
      db.modelProfile.count(),
      db.assignment.count(),

      db.assignmentItem.aggregate({
        _sum: {
          sentQty: true,
        },
      }),

      db.returnItem.aggregate({
        _sum: {
          quantity: true,
          dontWearQty: true,
        },
      }),

      db.supplier.count(),
      db.supplier.count({ where: { status: "ACTIVE" } }),
      db.garmentCategory.count(),
      db.measurementTemplate.count({ where: { status: "ACTIVE" } }),
      db.modelProfile.count({ where: { active: true } }),
      db.product.count({ where: { createdAt: { gte: monthStart } } }),
      db.assignment.count({ where: { contentDone: true } }),
      db.assignment.count({
        where: { status: { in: ["ISSUED", "PARTIAL"] } },
      }),
      db.assignment.count({
        where: {
          status: { in: ["ISSUED", "PARTIAL"] },
          expectedReturnDate: { lt: now },
        },
      }),
      db.returnItem.aggregate({
        where: { condition: { in: ["DAMAGED", "LOST"] } },
        _sum: { quantity: true },
      }),
    ]);

    const sent = sentResult._sum.sentQty ?? 0;
    const returned = returnedResult._sum.quantity ?? 0;

    const response = NextResponse.json({
      products,
      models,
      assignments,
      sent,
      returned,
      onHand: sent - returned,
      suppliers,
      activeSuppliers,
      categories,
      activeTemplates,
      activeModels,
      productsThisMonth,
      contentDone,
      contentPending: assignments - contentDone,
      openAssignments,
      overdueAssignments,
      dontWear: returnedResult._sum.dontWearQty ?? 0,
      damagedLost: damagedResult._sum.quantity ?? 0,
    });

    response.headers.set("Cache-Control", "private, no-store");

    if (process.env.NODE_ENV === "development") {
      console.log(`[dashboard] ${Math.round(performance.now() - started)}ms`);
    }

    return response;
  } catch (error) {
    console.error("Dashboard API error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
