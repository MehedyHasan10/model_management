import imageCompression from "browser-image-compression";
import { ApiError } from "./client-api";

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const IMAGE_ACCEPT = IMAGE_TYPES.join(",");
export const MAX_SOURCE_BYTES = 5 * 1024 * 1024;
export const IMAGE_RULE_MESSAGE = "Image must be JPG, PNG or WebP, max 5 MB";

const TARGET_BYTES = 70 * 1024;
const MAX_SIDE = 1600;
const QUALITIES = [0.8, 0.7, 0.6, 0.5, 0.4];

export function checkImageFile(file: File) {
  if (!IMAGE_TYPES.includes(file.type) || file.size > MAX_SOURCE_BYTES)
    throw new Error(IMAGE_RULE_MESSAGE);
}

/**
 * Compresses a photo in a Web Worker and returns a WebP file of about
 * 50-70 KB. Rotation from EXIF is applied, the longest side is at most
 * 1600 px (never upscaled), and quality steps down from 0.8 to 0.4; if it is
 * still too big, the size shrinks by 15% and it tries again. Re-encoding
 * drops GPS and other photo metadata.
 */
export async function compressToWebp(file: File): Promise<File> {
  checkImageFile(file);
  const encode = (source: File, maxWidthOrHeight: number, initialQuality: number) =>
    imageCompression(source, {
      fileType: "image/webp",
      maxWidthOrHeight,
      initialQuality,
      useWebWorker: true,
      // Size is controlled by the loop here, not by the library.
      maxSizeMB: Number.POSITIVE_INFINITY,
      alwaysKeepResolution: true,
      preserveExif: false,
      // Self-hosted copy of the library for the worker (default is a CDN).
      libURL: `${window.location.origin}/vendor/browser-image-compression-2.0.2.js`,
    });
  // The library hands back the original when re-encoding would make it
  // bigger; only real WebP output counts.
  const isWebp = (out: File) => out.type === "image/webp";

  // Decode the (possibly 12 MP) photo once: rotate it and fit it within
  // 1600 px at full quality. The quality steps below then work on this
  // much smaller image instead of decoding the original every time.
  const first = await encode(file, MAX_SIDE, 1);
  const base = isWebp(first) ? first : file;

  let side = MAX_SIDE;
  let smallest: File | null = null;
  for (let attempt = 0; attempt < 20; attempt++) {
    for (const quality of QUALITIES) {
      const out = await encode(base, side, quality);
      if (!isWebp(out)) continue;
      if (!smallest || out.size < smallest.size) smallest = out;
      if (out.size <= TARGET_BYTES) return asWebpFile(out, file.name);
    }
    side = Math.max(64, Math.floor(side * 0.85));
  }
  if (smallest) return asWebpFile(smallest, file.name);
  throw new Error("Image could not be compressed");
}

function asWebpFile(blob: Blob, originalName: string) {
  const base = originalName.replace(/\.[^.]+$/, "") || "image";
  return new File([blob], `${base}.webp`, { type: "image/webp" });
}

/** Uploads an already compressed WebP; the server saves it as <uuid>.webp. */
export async function uploadImage(file: File) {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch("/api/uploads", { method: "POST", body: form });
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new ApiError(
      body?.error || `Upload failed (${response.status})`,
      response.status,
    );
  return body as { url: string; size: number };
}

/** "62 KB" */
export const formatKb = (bytes: number) => `${Math.max(1, Math.round(bytes / 1024))} KB`;
