import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser, can } from "@/lib/auth";
import { fail, audit } from "@/lib/common";
import { unitConflict, unitError, unitInputSchema } from "@/lib/measurement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const u = await currentUser();
  if (!u) return fail("Unauthorized", 401);
  if (!(await can(u, "fields.view"))) return fail("Forbidden", 403);
  try {
    const units = await db.measurementUnit.findMany({
      orderBy: [{ createdAt: "asc" }, { name: "asc" }],
      include: { _count: { select: { fields: true } } },
    });
    return NextResponse.json(
      units.map(({ id, name, symbol, _count }) => ({
        id,
        name,
        symbol,
        fieldCount: _count.fields,
      })),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return unitError(e);
  }
}

export async function POST(req: NextRequest) {
  const u = await currentUser();
  if (!u) return fail("Unauthorized", 401);
  if (!(await can(u, "fields.create"))) return fail("Forbidden", 403);
  try {
    const input = unitInputSchema.parse(await req.json());
    const conflict = await unitConflict(input);
    if (conflict) return NextResponse.json(conflict, { status: 409 });
    const unit = await db.measurementUnit.create({ data: input });
    await audit(u.id, "CREATE", "units", unit.id, input);
    return NextResponse.json(
      { id: unit.id, name: unit.name, symbol: unit.symbol, fieldCount: 0 },
      { status: 201 },
    );
  } catch (e) {
    return unitError(e);
  }
}
