import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser, can } from "@/lib/auth";
import { fail } from "@/lib/common";
import { previewSupplierCode } from "@/lib/product-supplier-code";

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
        select: { id: true, name: true, status: true },
      });
      if (!supplier || supplier.status !== "ACTIVE") return fail("Supplier unavailable", 400);
      supplierCode = await previewSupplierCode(db, supplier);
      if (!supplierCode) return fail("Supplier prefix invalid", 400);
    }

    return NextResponse.json({ productCode, supplierCode }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Preview codes API error", error);
    return fail("Unable to preview codes", 500);
  }
}
