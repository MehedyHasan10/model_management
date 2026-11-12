import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { currentUser, can } from "@/lib/auth";
import { fail } from "@/lib/common";
import { POST as dispatchPOST } from "@/modules/legacy-entity-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().max(200).default(""),
  sort: z.enum(["newest", "oldest", "az", "za"]).default("newest"),
});

export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) return fail("Unauthorized", 401);
  if (!(await can(user, "categories.view"))) return fail("Forbidden", 403);

  const parsed = querySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams),
  );
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid query parameters" },
      { status: 400 },
    );

  const { page, limit, search, sort } = parsed.data;
  const where = search.trim()
    ? { name: { contains: search.trim(), mode: "insensitive" as const } }
    : {};
  const orderBy =
    sort === "az"
      ? { name: "asc" as const }
      : sort === "za"
        ? { name: "desc" as const }
        : sort === "oldest"
          ? { createdAt: "asc" as const }
          : { createdAt: "desc" as const };

  try {
    const [items, matching, total] = await db.$transaction([
      db.garmentCategory.findMany({
        where,
        orderBy: [orderBy, { id: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.garmentCategory.count({ where }),
      db.garmentCategory.count(),
    ]);
    return NextResponse.json({
      items,
      stats: { total },
      pagination: {
        page,
        limit,
        total: matching,
        totalPages: Math.max(1, Math.ceil(matching / limit)),
      },
    });
  } catch (error) {
    console.error("Categories list API error", error);
    return fail("Unable to load categories", 500);
  }
}

export function POST(req: NextRequest) {
  return dispatchPOST(req, {
    params: Promise.resolve({ entity: "categories" }),
  });
}
