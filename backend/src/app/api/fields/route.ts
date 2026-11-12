import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { currentUser, can } from "@/lib/auth";
import { fail } from "@/lib/common";
import {
  GET as dispatchGET,
  POST as dispatchPOST,
} from "@/modules/legacy-entity-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;

  // Preserve existing array response for other modules.
  if (!params.has("page") && !params.has("limit")) {
    return dispatchGET(req, {
      params: Promise.resolve({ entity: "fields" }),
    });
  }

  const user = await currentUser();

  if (!user) {
    return fail("Unauthorized", 401);
  }

  if (!(await can(user, "fields.view"))) {
    return fail("Forbidden", 403);
  }

  const page = Number(params.get("page") ?? 1);
  const limit = Number(params.get("limit") ?? 10);

  if (
    !Number.isInteger(page) ||
    page < 1 ||
    page > 1000000 ||
    !Number.isInteger(limit) ||
    ![10, 20, 50].includes(limit)
  ) {
    return fail("Invalid pagination", 400);
  }

  const search = (params.get("search") ?? "").trim().slice(0, 150);

  const sort = params.get("sort") ?? "newest";

  if (!["newest", "oldest", "az", "za"].includes(sort)) {
    return fail("Invalid sort", 400);
  }

  const where: Prisma.MeasurementFieldWhereInput = search
    ? {
        OR: [
          {
            name: {
              contains: search,
              mode: "insensitive",
            },
          },
          {
            unit: {
              contains: search,
              mode: "insensitive",
            },
          },
        ],
      }
    : {};

  // MeasurementField has no createdAt field.
  // Use the existing order field for default sorting.
  const orderBy: Prisma.MeasurementFieldOrderByWithRelationInput[] =
    sort === "az"
      ? [{ name: "asc" }, { id: "asc" }]
      : sort === "za"
        ? [{ name: "desc" }, { id: "asc" }]
        : sort === "oldest"
          ? [{ order: "asc" }, { id: "asc" }]
          : [{ order: "desc" }, { id: "asc" }];

  try {
    const [items, total, allTotal] = await db.$transaction([
      db.measurementField.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),

      db.measurementField.count({
        where,
      }),

      db.measurementField.count(),
    ]);

    return NextResponse.json({
      items,

      stats: {
        total: allTotal,
        matching: total,
      },

      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    console.error("Fields pagination error:", error);

    return fail("Unable to load fields", 500);
  }
}

export function POST(req: NextRequest) {
  return dispatchPOST(req, {
    params: Promise.resolve({ entity: "fields" }),
  });
}
