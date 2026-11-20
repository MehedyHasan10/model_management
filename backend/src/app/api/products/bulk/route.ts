import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser, can } from "@/lib/auth";
import { fail, audit } from "@/lib/common";
import {
  BULK_MAX_BYTES,
  BulkFileError,
  commitBulkImport,
  parseBulkWorkbook,
  planBulkImport,
  type PlannedRow,
} from "@/lib/product-bulk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const publicRow = ({ supplierId, categoryId, templateId, ...row }: PlannedRow) =>
  row;

/** multipart/form-data: file=<.xlsx>, mode=preview|import */
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return fail("Unauthorized", 401);
  if (!(await can(user, "products.create"))) return fail("Forbidden", 403);

  const length = Number(req.headers.get("content-length") || 0);
  if (length > BULK_MAX_BYTES + 64 * 1024)
    return fail("File is too large (max 5 MB)", 413);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("Upload an Excel file", 400);
  }
  const file = form.get("file");
  const mode = form.get("mode") === "import" ? "import" : "preview";
  if (!(file instanceof Blob) || !file.size) return fail("Upload an Excel file", 400);
  if (file.size > BULK_MAX_BYTES) return fail("File is too large (max 5 MB)", 413);

  try {
    const input = await parseBulkWorkbook(await file.arrayBuffer());

    if (mode === "preview") {
      const { rows } = await planBulkImport(db, input);
      return NextResponse.json({ rows: rows.map(publicRow) });
    }

    const { rows, created } = await commitBulkImport(db, input);
    if (created.length)
      await audit(user.id, "BULK_CREATE", "products", undefined, {
        count: created.length,
        sns: created,
      });
    return NextResponse.json({ rows: rows.map(publicRow), created });
  } catch (error) {
    if (error instanceof BulkFileError) return fail(error.message, 400);
    console.error("Product bulk upload error", error);
    return fail("Bulk upload failed. Please try again.", 500);
  }
}
