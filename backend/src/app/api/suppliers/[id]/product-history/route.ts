import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { currentUser, can } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };
const response = (data: unknown, status = 200) =>
  NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });

export async function GET(req: NextRequest, { params }: Context) {
  try {
    const user = await currentUser();
    if (!user) return response({ error: "Unauthorized" }, 401);
    if (
      !(await can(user, "suppliers.view")) ||
      !(await can(user, "products.view")) ||
      !(await can(user, "assignments.view"))
    )
      return response({ error: "Forbidden" }, 403);

    const { id: supplierId } = await params;
    if (!supplierId || supplierId.length > 128)
      return response({ error: "Invalid supplier" }, 400);
    const q = req.nextUrl.searchParams;
    const page = Number(q.get("page") ?? "1");
    const limit = Number(q.get("limit") ?? "10");
    const search = (q.get("search") ?? "").trim();
    const status = (q.get("status") ?? "").toUpperCase();
    const from = q.get("from") ?? "";
    const to = q.get("to") ?? "";
    if (
      !Number.isSafeInteger(page) ||
      page < 1 ||
      page > 1000000 ||
      ![10, 20, 50].includes(limit)
    )
      return response({ error: "Invalid pagination" }, 400);
    if (
      search.length > 150 ||
      !["", "ISSUED", "PARTIAL", "COMPLETED"].includes(status)
    )
      return response({ error: "Invalid filters" }, 400);
    const validDate = (s: string) =>
      !s ||
      (/^\d{4}-\d{2}-\d{2}$/.test(s) &&
        !Number.isNaN(Date.parse(`${s}T00:00:00.000Z`)));
    if (!validDate(from) || !validDate(to) || (from && to && from > to))
      return response({ error: "Invalid date range" }, 400);

    const assignmentWhere: Prisma.AssignmentWhereInput = {};
    if (status)
      assignmentWhere.status = status as "ISSUED" | "PARTIAL" | "COMPLETED";
    if (from || to)
      assignmentWhere.sentDate = {
        ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
        ...(to
          ? {
              lt: new Date(
                new Date(`${to}T00:00:00.000Z`).getTime() + 86400000,
              ),
            }
          : {}),
      };
    const hasAssignmentFilters = Boolean(status || from || to);
    // Restrict the assignment lookup to this supplier. Only IDs are retrieved here.
    // This avoids loading full assignments, photos and templates into the browser.
    let matchingIds: string[] | undefined;
    if (hasAssignmentFilters) {
      const assignments = await db.assignment.findMany({
        where: {
          ...assignmentWhere,
          items: { some: { product: { supplierId } } },
        },
        select: {
          items: {
            where: { product: { supplierId } },
            select: { productId: true },
          },
        },
      });
      matchingIds = [
        ...new Set(assignments.flatMap((a) => a.items.map((i) => i.productId))),
      ];
    }
    const where: Prisma.ProductWhereInput = {
      supplierId,
      ...(search
        ? {
            OR: [
              { sn: { contains: search, mode: "insensitive" } },
              { supplierCode: { contains: search, mode: "insensitive" } },
              { itemName: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(matchingIds ? { id: { in: matchingIds } } : {}),
    };
    const [total, products] = await Promise.all([
      db.product.count({ where }),
      db.product.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          sn: true,
          supplierCode: true,
          itemName: true,
          images: { orderBy: { order: "asc" }, take: 1, select: { url: true } },
        },
      }),
    ]);
    const ids = products.map((p) => p.id);
    const assignments = ids.length
      ? await db.assignment.findMany({
          where: {
            ...assignmentWhere,
            items: { some: { productId: { in: ids } } },
          },
          select: {
            status: true,
            sentDate: true,
            items: {
              where: { productId: { in: ids } },
              select: {
                productId: true,
                sentQty: true,
                returnItems: { select: { quantity: true, dontWearQty: true } },
              },
            },
          },
        })
      : [];
    const counts = new Map<
      string,
      {
        sent: number;
        returned: number;
        dontWear: number;
        statuses: string[];
        dates: string[];
      }
    >();
    for (const assignment of assignments) {
      for (const item of assignment.items) {
        const row = counts.get(item.productId) ?? {
          sent: 0,
          returned: 0,
          dontWear: 0,
          statuses: [],
          dates: [],
        };
        row.sent += Number(item.sentQty ?? 0);
        row.returned += item.returnItems.reduce(
          (sum, r) => sum + Number(r.quantity ?? 0),
          0,
        );
        row.dontWear += item.returnItems.reduce(
          (sum, r) => sum + Number(r.dontWearQty ?? 0),
          0,
        );
        if (!row.statuses.includes(assignment.status))
          row.statuses.push(assignment.status);
        row.dates.push(assignment.sentDate.toISOString().slice(0, 10));
        counts.set(item.productId, row);
      }
    }
    const items = products.map((product) => ({
      product,
      ...(counts.get(product.id) ?? {
        sent: 0,
        returned: 0,
        dontWear: 0,
        statuses: [],
        dates: [],
      }),
    }));
    const pageTotals = items.reduce(
      (a, r) => ({
        sent: a.sent + r.sent,
        returned: a.returned + r.returned,
        dontWear: a.dontWear + r.dontWear,
      }),
      { sent: 0, returned: 0, dontWear: 0 },
    );
    return response({
      items,
      pageTotals,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    console.error("Supplier product history GET failed", error);
    return response({ error: "Unable to load supplier product history" }, 500);
  }
}
