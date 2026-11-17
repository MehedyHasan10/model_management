import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser, can } from "@/lib/auth";
import { fail, audit } from "@/lib/common";
import { unitConflict, unitError, unitInputSchema } from "@/lib/measurement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const u = await currentUser();
  if (!u) return fail("Unauthorized", 401);
  if (!(await can(u, "fields.edit"))) return fail("Forbidden", 403);
  const { id } = await params;
  try {
    const input = unitInputSchema.parse(await req.json());
    const conflict = await unitConflict(input, id);
    if (conflict) return NextResponse.json(conflict, { status: 409 });
    const unit = await db.measurementUnit.update({
      where: { id },
      data: input,
      include: { _count: { select: { fields: true } } },
    });
    await audit(u.id, "UPDATE", "units", id, input);
    return NextResponse.json({
      id: unit.id,
      name: unit.name,
      symbol: unit.symbol,
      fieldCount: unit._count.fields,
    });
  } catch (e) {
    return unitError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const u = await currentUser();
  if (!u) return fail("Unauthorized", 401);
  if (!(await can(u, "fields.delete"))) return fail("Forbidden", 403);
  const { id } = await params;
  try {
    const used = await db.measurementField.count({ where: { unitId: id } });
    if (used > 0)
      return fail(
        `This unit is used by ${used} ${used === 1 ? "field" : "fields"}. Move those fields to another unit first.`,
        409,
      );
    await db.measurementUnit.delete({ where: { id } });
    await audit(u.id, "DELETE", "units", id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return unitError(e);
  }
}
