import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser, can } from "@/lib/auth";
import { fail } from "@/lib/common";

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
      const prefix = supplier.name.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (!prefix) return fail("Supplier prefix invalid", 400);
      const sequence = await db.supplierProductSequence.findUnique({
        where: { supplierId },
        select: { nextNumber: true },
      });
      supplierCode = `${prefix}${sequence?.nextNumber ?? 1001}`;
    }

    return NextResponse.json({ productCode, supplierCode }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Preview codes API error", error);
    return fail("Unable to preview codes", 500);
  }
}
