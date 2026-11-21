import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { currentUser, can } from "@/lib/auth";
import { fail, audit } from "@/lib/common";
import { allocateSupplierCode } from "@/lib/product-supplier-code";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Copy a product with a fresh product code and the supplier's next code. */
export async function POST(_req: NextRequest, { params }: Ctx) {
  const u = await currentUser();
  if (!u) return fail("Unauthorized", 401);
  if (!(await can(u, "products.create"))) return fail("Forbidden", 403);
  const { id } = await params;

  for (let attempt = 0; ; attempt++) {
    try {
      const created = await db.$transaction(
        async (tx) => {
          const source = await tx.product.findUnique({
            where: { id },
            include: {
              images: { orderBy: { order: "asc" } },
              measurements: true,
            },
          });
          if (!source) throw new Error("PRODUCT_NOT_FOUND");
          if (!source.supplierId) throw new Error("SUPPLIER_NOT_ASSIGNED");

          await tx.serialSetting.upsert({
            where: { id: "product" },
            update: {},
            create: { id: "product" },
          });
          const sequence = await tx.serialSetting.update({
            where: { id: "product" },
            data: { nextNumber: { increment: 1 } },
          });
          const sn =
            sequence.prefix +
            String(sequence.nextNumber - 1).padStart(sequence.digits, "0");
          const supplierCode = await allocateSupplierCode(tx, source.supplierId);

          return tx.product.create({
            data: {
              sn,
              code: null,
              supplierId: source.supplierId,
              supplierCode,
              itemName: source.itemName,
              categoryId: source.categoryId,
              templateId: source.templateId,
              pp: source.pp,
              sp: source.sp,
              spn: source.spn,
              wp: source.wp,
              fabric: source.fabric,
              notes: source.notes,
              noSizeText: source.noSizeText,
              images: {
                create: source.images.map((img) => ({
                  url: img.url,
                  order: img.order,
                })),
              },
              measurements: {
                create: source.measurements.map((m) => ({
                  size: m.size,
                  fieldId: m.fieldId,
                  value: m.value,
                })),
              },
            },
          });
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 15000,
        },
      );
      await audit(u.id, "CREATE", "products", created.id);
      return NextResponse.json(created, { status: 201 });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2034" &&
        attempt < 2
      )
        continue;
      if (e instanceof Error && e.message === "PRODUCT_NOT_FOUND")
        return fail("Product not found", 404);
      if (e instanceof Error && e.message.startsWith("SUPPLIER_"))
        return fail(e.message.replaceAll("_", " "), 400);
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
        return fail("Generated code already exists. Please retry.", 409);
      console.error("Product duplicate error", e);
      return fail("Unable to duplicate product", 500);
    }
  }
}
