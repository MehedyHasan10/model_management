import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { currentUser, can } from "@/lib/auth";
import { fail, audit } from "@/lib/common";
import { templateInputSchema } from "@/lib/template-validation";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };
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
    if (error.code === "P2025") return fail("Record not found", 404);
    if (error.code === "P2002") return fail("Duplicate record", 409);
    if (error.code === "P2003")
      return fail("Invalid category or measurement field", 400);
  }
  console.error("Template API error", error);
  return fail("Request failed", 500);
}
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const user = await currentUser();
  if (!user) return fail("Unauthorized", 401);
  if (!(await can(user, "templates.edit"))) return fail("Forbidden", 403);
  if (
    !(req.headers.get("content-type") || "")
      .toLowerCase()
      .includes("application/json")
  )
    return fail("Content-Type must be application/json", 415);
  try {
    const { id } = await params;
    const raw = await req.json();
    const input = templateInputSchema.parse(raw);
    const noMeasurement =
      input.sizes.length === 0 && input.fieldIds.length === 0;
    const extra = noMeasurement
      ? {
          noMeasurementFieldId:
            typeof raw.noMeasurementFieldId === "string"
              ? raw.noMeasurementFieldId
              : "",
          noMeasurementText:
            typeof raw.noMeasurementText === "string"
              ? raw.noMeasurementText.slice(0, 2000)
              : "",
        }
      : {};
    if (noMeasurement && extra.noMeasurementFieldId) {
      const field = await db.measurementField.findUnique({
        where: { id: extra.noMeasurementFieldId },
      });
      if (
        !field ||
        !["no size", "free size"].includes(field.name.trim().toLowerCase())
      ) {
        return fail("Select a valid No Size or Free Size field", 400);
      }
    }
    const record = await db.measurementTemplate.update({
      where: { id },
      data: {
        name: input.name,
        categoryId: input.categoryId,
        status: input.status,
        sizes: input.sizes,
        qualityChecks: {
          ...(input.qualityChecks ?? {}),
          ...extra,
        } as Prisma.InputJsonValue,
        fields: {
          deleteMany: {},
          create: input.fieldIds.map((fieldId, order) => ({ fieldId, order })),
        },
      },
    });
    try {
      await audit(user.id, "UPDATE", "templates", id);
    } catch (auditError) {
      console.error("Template audit failed", auditError);
    }
    return NextResponse.json(record);
  } catch (error) {
    return errorResponse(error);
  }
}
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const user = await currentUser();
  if (!user) return fail("Unauthorized", 401);
  if (!(await can(user, "templates.delete"))) return fail("Forbidden", 403);
  try {
    const { id } = await params;
    await db.measurementTemplate.delete({ where: { id } });
    try {
      await audit(user.id, "DELETE", "templates", id);
    } catch (auditError) {
      console.error("Template audit failed", auditError);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
