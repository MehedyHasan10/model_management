import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { currentUser, can } from "@/lib/auth";
import { audit } from "@/lib/common";
import { supplierUpdateSchema } from "@/lib/supplier-validation";
import { json, fail, readJson, handleSupplierError } from "@/lib/supplier-http";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Context) {
  const u = await currentUser();
  if (!u) return fail("Unauthorized", 401);
  if (!(await can(u, "suppliers.view"))) return fail("Forbidden", 403);
  try {
    const { id } = await ctx.params;
    const item = await db.supplier.findUnique({ where: { id } });
    return item ? json(item) : fail("Supplier not found", 404);
  } catch (error) {
    return handleSupplierError(error);
  }
}

export async function PATCH(req: NextRequest, ctx: Context) {
  const u = await currentUser();
  if (!u) return fail("Unauthorized", 401);
  if (!(await can(u, "suppliers.edit"))) return fail("Forbidden", 403);
  try {
    const { id } = await ctx.params;
    const data = supplierUpdateSchema.parse(await readJson(req));
    if (!Object.keys(data).length) return fail("No fields provided", 400);
    const item = await db.supplier.update({ where: { id }, data });
    try {
      await audit(u.id, "UPDATE", "suppliers", id);
    } catch (error) {
      console.error("Supplier audit failed", error);
    }
    return json(item);
  } catch (error) {
    return handleSupplierError(error);
  }
}

export async function DELETE(_req: NextRequest, ctx: Context) {
  const u = await currentUser();
  if (!u) return fail("Unauthorized", 401);
  if (!(await can(u, "suppliers.delete"))) return fail("Forbidden", 403);
  try {
    const { id } = await ctx.params;
    await db.supplier.delete({ where: { id } });
    try {
      await audit(u.id, "DELETE", "suppliers", id);
    } catch (error) {
      console.error("Supplier audit failed", error);
    }
    return json({ ok: true });
  } catch (error) {
    return handleSupplierError(error);
  }
}
