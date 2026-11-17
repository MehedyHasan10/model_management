import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { currentUser } from "@/lib/auth";
import { fail } from "@/lib/common";
import { UPLOAD_FILE_PATTERN, uploadDir } from "@/lib/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ file: string }> };

const TYPES: Record<string, string> = {
  webp: "image/webp",
  jpg: "image/jpeg",
  png: "image/png",
};

// Serves uploaded images. Files are written at runtime, which next start
// does not serve from public/, so they are read from UPLOAD_DIR here.
export async function GET(_req: NextRequest, { params }: Ctx) {
  if (!(await currentUser())) return fail("Unauthorized", 401);
  const { file } = await params;
  if (!UPLOAD_FILE_PATTERN.test(file)) return fail("Not found", 404);
  try {
    const body = await readFile(path.join(uploadDir(), file));
    return new NextResponse(new Uint8Array(body), {
      headers: {
        "Content-Type": TYPES[file.split(".").pop()!],
        "Cache-Control": "private, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return fail("Not found", 404);
  }
}
