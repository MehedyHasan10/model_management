import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser, can } from "@/lib/auth";
import { fail } from "@/lib/common";
import { nextSupplierNumber, supplierPrefix } from "@/lib/product-supplier-code";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) return fail("Unauthorized", 401);
  if (!(await can(user, "products.view"))) return fail("Forbidden", 403);

  try {
    const setting = await db.serialSetting.findUnique({ where: { id: "product" } });
    const productCode = setting
      ? `${setting.prefix}${String(setting.nextNumber).padStart(setting.digits, "0")}`
      : "MT0001";

    const supplierId = req.nextUrl.searchParams.get("supplierId");
    let supplierCode: string | null = null;
    if (supplierId) {
      const supplier = await db.supplier.findUnique({
        where: { id: supplierId },
        select: { name: true, status: true },
      });
      if (!supplier || supplier.status !== "ACTIVE") return fail("Supplier unavailable", 400);
      const prefix = supplierPrefix(supplier.name);
      if (!prefix) return fail("Supplier prefix invalid", 400);
      supplierCode = `${prefix}${await nextSupplierNumber(db, supplierId, prefix)}`;
    }

    return NextResponse.json({ productCode, supplierCode }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Preview codes API error", error);
    return fail("Unable to preview codes", 500);
  }
}
