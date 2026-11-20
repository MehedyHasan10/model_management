import { db } from "@/lib/db";
import { currentUser, can } from "@/lib/auth";
import { fail } from "@/lib/common";
import { buildBulkTemplate } from "@/lib/product-bulk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return fail("Unauthorized", 401);
  if (!(await can(user, "products.create"))) return fail("Forbidden", 403);

  try {
    const file = await buildBulkTemplate(db);
    return new Response(file, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="product-bulk-upload-sample.xlsx"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Product bulk template error", error);
    return fail("Unable to create sample file", 500);
  }
}
