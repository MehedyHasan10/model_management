import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { currentUser, can } from "@/lib/auth";
import { fail, audit } from "@/lib/common";
import { Prisma } from "@prisma/client";
import { modelPhotoSchema } from "@/lib/productImageValidation";

const entity = "models";
const schema = z
  .object({
    name: z.string().trim().min(2).max(150),
    phone: z.string().max(30).nullish(),
    photoUrl: modelPhotoSchema,
    notes: z.string().max(5000).nullish(),
    active: z.boolean(),
  })
  .strict();
type Ctx = { params: Promise<{ id: string }> };
function error(e: unknown) {
  if (e instanceof z.ZodError)
    return NextResponse.json(
      { error: "Validation failed", details: e.flatten() },
      { status: 400 },
    );
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2025") return fail("Record not found", 404);
    if (e.code === "P2002") return fail("Duplicate record", 409);
    if (e.code === "P2003")
      return fail("Related record prevents this operation", 409);
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
    const result = await db.modelProfile.update({ where: { id }, data: input });
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
    await db.modelProfile.delete({ where: { id } });
    await audit(u.id, "DELETE", entity, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return error(e);
  }
}
