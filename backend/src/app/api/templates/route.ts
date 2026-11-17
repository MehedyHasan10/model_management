import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { currentUser, can } from "@/lib/auth";
import { fail, audit } from "@/lib/common";
import {
  cleanQualityChecks,
  templateInputSchema,
} from "@/lib/template-validation";
import { fieldWithUnit } from "@/lib/measurement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (error instanceof z.ZodError)
    return NextResponse.json(
      {
        error:
          error.issues
            .map(
              (issue) => `${issue.path.join(".") || "Input"}: ${issue.message}`,
            )
            .join("; ") || "Invalid template data",
        details: error.flatten(),
      },
      { status: 400 },
    );
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return fail("Duplicate record", 409);
    if (error.code === "P2003")
      return fail("Invalid category or measurement field", 400);
  }
  console.error("Template API error", error);
  return fail("Request failed", 500);
}

export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) return fail("Unauthorized", 401);
  if (!(await can(user, "templates.view"))) return fail("Forbidden", 403);
  try {
    const params = req.nextUrl.searchParams;
    const paginated = params.has("page") || params.has("limit");
    const page = Number(params.get("page") || 1);
    const limit = Number(params.get("limit") || 10);
    if (
      paginated &&
      (!Number.isInteger(page) ||
        page < 1 ||
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 100)
    )
      return fail("Invalid pagination", 400);
    const search = (params.get("search") || "").trim().slice(0, 150);
    const sort = params.get("sort") || "newest";
    if (!["newest", "oldest", "az", "za"].includes(sort))
      return fail("Invalid sort", 400);
    const where: Prisma.MeasurementTemplateWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { category: { name: { contains: search, mode: "insensitive" } } },
            {
              status: {
                in: ["ACTIVE", "DRAFT", "ARCHIVED"].filter((v) =>
                  v.toLowerCase().includes(search.toLowerCase()),
                ) as Array<"ACTIVE" | "DRAFT" | "ARCHIVED">,
              },
            },
          ],
        }
      : {};
    const orderBy: Prisma.MeasurementTemplateOrderByWithRelationInput[] =
      sort === "az"
        ? [{ name: "asc" }, { id: "asc" }]
        : sort === "za"
          ? [{ name: "desc" }, { id: "asc" }]
          : sort === "oldest"
            ? [{ createdAt: "asc" }, { id: "asc" }]
            : [{ createdAt: "desc" }, { id: "asc" }];
    const rows = await db.measurementTemplate.findMany({
      ...(paginated ? { where, skip: (page - 1) * limit, take: limit } : {}),
      include: {
        category: true,
        fields: { include: { field: fieldWithUnit }, orderBy: { order: "asc" } },
      },
      orderBy: paginated ? orderBy : { createdAt: "desc" },
    });
    if (paginated) {
      const [total, allTotal] = await Promise.all([
        db.measurementTemplate.count({ where }),
        db.measurementTemplate.count(),
      ]);
      return NextResponse.json(
        {
          items: rows,
          stats: { total: allTotal, matching: total },
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / limit)),
          },
        },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }
    return NextResponse.json(rows, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return fail("Unauthorized", 401);
  if (!(await can(user, "templates.create"))) return fail("Forbidden", 403);
  if (
    !(req.headers.get("content-type") || "")
      .toLowerCase()
      .includes("application/json")
  )
    return fail("Content-Type must be application/json", 415);
  try {
    const raw = await req.json();
    const input = templateInputSchema.parse(raw);
    const noMeasurement =
      input.sizes.length === 0 && input.fieldIds.length === 0;
    // Older clients sent these inside qualityChecks; accept that as a fallback.
    const legacy = (raw?.qualityChecks ?? {}) as Record<string, unknown>;
    const noMeasurementFieldId = noMeasurement
      ? input.noMeasurementFieldId ||
        (typeof legacy.noMeasurementFieldId === "string"
          ? legacy.noMeasurementFieldId
          : "") ||
        null
      : null;
    const noMeasurementText = noMeasurement
      ? (input.noMeasurementText ??
          (typeof legacy.noMeasurementText === "string"
            ? legacy.noMeasurementText.slice(0, 2000)
            : "")) ||
        null
      : null;
    if (noMeasurementFieldId) {
      const field = await db.measurementField.findUnique({
        where: { id: noMeasurementFieldId },
      });
      if (
        !field ||
        !["no size", "free size"].includes(field.name.trim().toLowerCase())
      ) {
        return fail("Select a valid No Size or Free Size field", 400);
      }
    }
    const record = await db.measurementTemplate.create({
      data: {
        name: input.name,
        categoryId: input.categoryId,
        status: input.status,
        sizes: input.sizes,
        qualityChecks: cleanQualityChecks(input.qualityChecks),
        noMeasurementFieldId,
        noMeasurementText,
        fields: {
          create: input.fieldIds.map((fieldId, order) => ({ fieldId, order })),
        },
      },
    });
    try {
      await audit(user.id, "CREATE", "templates", record.id);
    } catch (auditError) {
      console.error("Template audit failed", auditError);
    }
    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
