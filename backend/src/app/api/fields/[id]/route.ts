import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { currentUser, can } from "@/lib/auth";
import { fail, audit } from "@/lib/common";
import { Prisma } from "@prisma/client";
import {
  FIELD_NAME_TAKEN,
  fieldNameTaken,
  fieldWithUnit,
} from "@/lib/measurement";

const entity = "fields";
// Only these keys are accepted. "order" is optional so an edit never resets it.
const schema = z
  .object({
    name: z.string().trim().min(2).max(150),
    unitId: z.string().trim().min(1, "Select a measurement unit").max(128),
    order: z.number().int().min(0).optional(),
  })
  .strict();
type Ctx = { params: Promise<{ id: string }> };
function error(e: unknown) {
  if (e instanceof z.ZodError)
    return NextResponse.json(
      {
        error: e.issues[0]?.message ?? "Validation failed",
        field: e.issues[0]?.path[0],
        details: e.flatten(),
      },
      { status: 400 },
    );
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2025") return fail("Record not found", 404);
    if (e.code === "P2002") return fail(FIELD_NAME_TAKEN, 409);
    if (e.code === "P2003")
      return fail(
        "This field is used by templates or products and cannot be deleted",
        409,
      );
  }
  console.error(`${entity} API error`, e);
  return fail("Request failed", 500);
}
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const u = await currentUser();
  if (!u) return fail("Unauthorized", 401);
  if (!(await can(u, `${entity}.edit`))) return fail("Forbidden", 403);
  const { id } = await params;
  try {
    const input = schema.parse(await req.json());
    if (await fieldNameTaken(input.name, id))
      return NextResponse.json(
        { error: FIELD_NAME_TAKEN, field: "name" },
        { status: 409 },
      );
    const unit = await db.measurementUnit.findUnique({
      where: { id: input.unitId },
      select: { id: true },
    });
    if (!unit)
      return NextResponse.json(
        { error: "Select a valid measurement unit", field: "unitId" },
        { status: 400 },
      );
    const result = await db.measurementField.update({
      where: { id },
      data: { ...input, categoryId: null },
      ...fieldWithUnit,
    });
    await audit(u.id, "UPDATE", entity, id);
    return NextResponse.json(result);
  } catch (e) {
    return error(e);
  }
}
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const u = await currentUser();
  if (!u) return fail("Unauthorized", 401);
  if (!(await can(u, `${entity}.delete`))) return fail("Forbidden", 403);
  const { id } = await params;
  try {
    await db.measurementField.delete({ where: { id } });
    await audit(u.id, "DELETE", entity, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return error(e);
  }
}
