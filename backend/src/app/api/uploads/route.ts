import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { currentUser, can } from "@/lib/auth";
import { fail } from "@/lib/common";
import {
  MAX_UPLOAD_BYTES,
  MAX_WEBP_BYTES,
  toWebp,
  uploadDir,
  uploadUrl,
} from "@/lib/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPLOAD_PERMISSIONS = [
  "products.create",
  "products.edit",
  "models.create",
  "models.edit",
];

function detect(buf: Buffer): "image/webp" | "image/jpeg" | "image/png" | null {
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP")
    return "image/webp";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return "image/png";
  return null;
}

// The browser sends WebP already compressed to about 50-70 KB. Anything that
// is not WebP (older clients) is converted here, so every new file is WebP.
export async function POST(req: NextRequest) {
  const u = await currentUser();
  if (!u) return fail("Unauthorized", 401);
  let allowed = false;
  for (const key of UPLOAD_PERMISSIONS) if (await can(u, key)) allowed = true;
  if (!allowed) return fail("Forbidden", 403);
  try {
    const file = (await req.formData()).get("file");
    if (!(file instanceof File)) return fail("File required");
    if (file.size > MAX_UPLOAD_BYTES)
      return fail("Image must be JPG, PNG or WebP, max 5 MB", 413);
    let buf: Buffer = Buffer.from(await file.arrayBuffer());
    const type = detect(buf);
    if (!type) return fail("Image must be JPG, PNG or WebP, max 5 MB", 415);
    if (type === "image/webp") {
      if (buf.length > MAX_WEBP_BYTES)
        return fail("Compressed image must be 100 KB or smaller", 413);
    } else {
      buf = await toWebp(buf);
    }
    const dir = uploadDir();
    await mkdir(dir, { recursive: true });
    const filename = `${randomUUID()}.webp`;
    await writeFile(path.join(dir, filename), buf, { flag: "wx" });
    return NextResponse.json(
      { url: uploadUrl(filename), size: buf.length },
      { status: 201 },
    );
  } catch (error) {
    console.error("Upload failed", error);
    return fail("Upload failed", 500);
  }
}
