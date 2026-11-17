import path from "path";
import sharp from "sharp";
import { z } from "zod";

export const uploadDir = () =>
  path.resolve(process.env.UPLOAD_DIR || "./public/uploads");

/** Images are saved as <uuid>.webp and served from /api/uploads/<file>. */
export const UPLOAD_FILE_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg|png)$/;
export const uploadUrl = (file: string) => `/api/uploads/${file}`;

// Accepts files from this server, both the new /api/uploads/ URLs and
// older /uploads/ ones.
export const uploadedImageUrl = z
  .string()
  .regex(
    /^\/(api\/)?uploads\/[0-9a-f-]{36}\.(webp|jpg|png)$/,
    "Image must be uploaded first",
  );

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_WEBP_BYTES = 100 * 1024;
const TARGET_BYTES = 70 * 1024;
const MAX_SIDE = 1600;

/**
 * Converts a JPG/PNG to WebP the same way the browser does: fix rotation from
 * EXIF, fit within 1600 px (never upscale), lower quality 0.8 -> 0.4, then
 * shrink 15% at a time until it is 70 KB or less. Metadata is not copied.
 */
export async function toWebp(input: Buffer): Promise<Buffer> {
  const rotated = await sharp(input).rotate().toBuffer();
  const { width = MAX_SIDE, height = MAX_SIDE } = await sharp(rotated).metadata();
  let side = Math.min(MAX_SIDE, Math.max(width, height));
  let last: Buffer | null = null;
  for (let attempt = 0; attempt < 20; attempt++) {
    for (const quality of [80, 70, 60, 50, 40]) {
      last = await sharp(rotated)
        .resize(side, side, { fit: "inside", withoutEnlargement: true })
        .webp({ quality })
        .toBuffer();
      if (last.length <= TARGET_BYTES) return last;
    }
    side = Math.max(64, Math.floor(side * 0.85));
  }
  return last!;
}
