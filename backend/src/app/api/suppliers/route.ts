import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { currentUser, can } from "@/lib/auth";
import { audit } from "@/lib/common";
import { supplierCreateSchema } from "@/lib/supplier-validation";
import { json, fail, readJson, handleSupplierError } from "@/lib/supplier-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(150).default(""),
  status: z.enum(["ALL", "ACTIVE", "INACTIVE"]).default("ALL"),
  sort: z.enum(["newest", "oldest", "name_asc", "name_desc"]).default("newest"),
});

export async function GET(req: NextRequest) {
  const u = await currentUser();
  if (!u) return fail("Unauthorized", 401);
  if (!(await can(u, "suppliers.view"))) return fail("Forbidden", 403);
  try {
    const p = querySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
    const where = {
      ...(p.search
        ? {
            OR: [
              { name: { contains: p.search, mode: "insensitive" as const } },
              { code: { contains: p.search, mode: "insensitive" as const } },
              {
                contactPerson: {
                  contains: p.search,
                  mode: "insensitive" as const,
                },
              },
              { phone: { contains: p.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(p.status === "ALL" ? {} : { status: p.status }),
    };
    const orderBy =
      p.sort === "name_asc"
        ? { name: "asc" as const }
        : p.sort === "name_desc"
          ? { name: "desc" as const }
          : {
              createdAt: (p.sort === "oldest" ? "asc" : "desc") as
                | "asc"
                | "desc",
            };
    const [items, total, all, active] = await Promise.all([
      db.supplier.findMany({
        where,
        orderBy,
        skip: (p.page - 1) * p.limit,
        take: p.limit,
      }),
      db.supplier.count({ where }),
      db.supplier.count(),
      db.supplier.count({ where: { status: "ACTIVE" } }),
    ]);
    return json({
      items,
      pagination: {
        page: p.page,
        limit: p.limit,
        total,
        totalPages: Math.ceil(total / p.limit),
      },
      stats: { total: all, active },
    });
  } catch (error) {
    return handleSupplierError(error);
  }
}

export async function POST(req: NextRequest) {
  const u = await currentUser();
  if (!u) return fail("Unauthorized", 401);
  if (!(await can(u, "suppliers.create"))) return fail("Forbidden", 403);
  try {
    const data = supplierCreateSchema.parse(await readJson(req));
    const record = await db.supplier.create({
      data: { ...data, code: `SL-${randomUUID()}` },
    });
    try {
      await audit(u.id, "CREATE", "suppliers", record.id);
    } catch (error) {
      console.error("Supplier audit failed", error);
    }
    return json(record, 201);
  } catch (error) {
    return handleSupplierError(error);
  }
}
