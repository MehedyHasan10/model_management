import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { currentUser, can } from "@/lib/auth";
import { audit } from "@/lib/common";
import { supplierUpdateSchema } from "@/lib/supplier-validation";
import { Prisma } from "@prisma/client";
import {
  json,
  fail,
  readJson,
  handleSupplierError,
  SupplierInputError,
} from "@/lib/supplier-http";
import { renameSupplierCodes } from "@/lib/product-supplier-code";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

function renameError(error: unknown) {
  if (!(error instanceof Error)) return error;
  if (error.message === "SUPPLIER_PREFIX_INVALID")
    return new SupplierInputError("Supplier name must contain letters or digits");
  if (error.message === "SUPPLIER_PREFIX_CONFLICT")
    return new SupplierInputError(
      "Another supplier already uses this code prefix. Choose a different name.",
      409,
    );
  if (error.message.startsWith("SUPPLIER_CODE_TAKEN:"))
    return new SupplierInputError(
      `Cannot rename: supplier code ${error.message.split(":")[1]} already exists.`,
      409,
    );
  return error;
}

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
    // A rename moves this supplier's codes to the new prefix (SSP101 → SSPT101).
    const item = await db.$transaction(
      async (tx) => {
        const before = await tx.supplier.findUnique({
          where: { id },
          select: { name: true },
        });
        if (!before) throw new SupplierInputError("Supplier not found", 404);
        if (data.name && data.name !== before.name) {
          try {
            await renameSupplierCodes(tx, id, before.name, data.name);
          } catch (error) {
            throw renameError(error);
          }
        }
        return tx.supplier.update({ where: { id }, data });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
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
