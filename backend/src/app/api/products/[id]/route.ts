import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { currentUser, can } from "@/lib/auth";
import { fail, audit } from "@/lib/common";
import { Prisma } from "@prisma/client";
import { allocateSupplierCode } from "@/lib/product-supplier-code";
import { measurementValueSchema } from "@/lib/measurement";
import { productImagesSchema } from "@/lib/productImageValidation";

const entity = "products";
const schema = z
  .object({
    supplierId: z.string().min(1).max(128),
    itemName: z.string().trim().min(2).max(150),
    categoryId: z.string().min(1).max(128),
    templateId: z.string().min(1).max(128).nullish(),
    pp: z.string().max(100).nullish(),
    sp: z.string().max(100).nullish(),
    wp: z.string().max(100).nullish(),
    fabric: z.string().max(300).nullish(),
    notes: z.string().max(5000).nullish(),
    noSizeText: z.string().max(2000).nullish(),
    images: productImagesSchema.default([]),
    measurements: z
      .array(
        z.object({
          size: z.string().min(1).max(30),
          fieldId: z.string().min(1).max(128),
          value: measurementValueSchema,
        }),
      )
      .max(1000)
      .default([]),
  })
  .strict();

type Ctx = { params: Promise<{ id: string }> };

function error(e: unknown) {
  if (e instanceof z.ZodError) {
    return NextResponse.json(
      {
        error: e.issues
          .map(
            (issue) => `${issue.path.join(".") || "Input"}: ${issue.message}`,
          )
          .join("; "),
        details: e.flatten(),
      },
      { status: 400 },
    );
  }
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2025") return fail("Record not found", 404);
    if (e.code === "P2002") return fail("Duplicate record", 409);
    if (e.code === "P2003")
      return fail("Related record prevents this operation", 409);
    if (e.code === "P2034") return fail("Update conflict. Please retry.", 409);
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
    const result = await db.$transaction(
      async (tx) => {
        const existing = await tx.product.findUnique({ where: { id } });
        if (!existing) throw new Error("PRODUCT_NOT_FOUND");
        const supplierCode =
          existing.supplierId === input.supplierId
            ? existing.supplierCode
            : await allocateSupplierCode(tx, input.supplierId);
        return tx.product.update({
          where: { id },
          data: {
            itemName: input.itemName,
            supplierId: input.supplierId,
            supplierCode,
            categoryId: input.categoryId,
            templateId: input.templateId || null,
            pp: input.pp,
            sp: input.sp,
            wp: input.wp,
            fabric: input.fabric,
            notes: input.notes,
            noSizeText: input.noSizeText ?? null,
            images: {
              deleteMany: {},
              create: input.images.map((url, order) => ({ url, order })),
            },
            measurements: { deleteMany: {}, create: input.measurements },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    await audit(u.id, "UPDATE", entity, id);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof Error && e.message === "PRODUCT_NOT_FOUND")
      return fail("Product not found", 404);
    if (e instanceof Error && e.message.startsWith("SUPPLIER_"))
      return fail(e.message.replaceAll("_", " "), 400);
    return error(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const u = await currentUser();
  if (!u) return fail("Unauthorized", 401);
  if (!(await can(u, `${entity}.delete`))) return fail("Forbidden", 403);
  const { id } = await params;
  try {
    await db.product.delete({ where: { id } });
    await audit(u.id, "DELETE", entity, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return error(e);
  }
}
