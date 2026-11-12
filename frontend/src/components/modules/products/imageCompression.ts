export const MAX_IMAGE_BYTES = 700 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

function encodedBytes(dataUrl: string): number {
  const b64 = dataUrl.split(",")[1] || "";
  return (
    Math.floor((b64.length * 3) / 4) -
    (b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0)
  );
}

export async function compressImage(file: File): Promise<string> {
  if (!ALLOWED.includes(file.type))
    throw new Error("Only JPG, PNG or WebP images are supported");
  if (file.size > 30 * 1024 * 1024)
    throw new Error("Source image must be under 30 MB");
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx)
      throw new Error("Image compression is not supported in this browser");
    // Encode to JPEG for consistent size reduction, including transparent PNG inputs.
    for (const maxSide of [2200, 1800, 1400, 1100, 850, 650, 450, 320]) {
      const scale = Math.min(
        1,
        maxSide / Math.max(bitmap.width, bitmap.height),
      );
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.85, 0.72, 0.58, 0.45, 0.32, 0.22]) {
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        if (encodedBytes(dataUrl) <= MAX_IMAGE_BYTES) return dataUrl;
      }
    }
    throw new Error("Image could not be compressed below 700 KB");
  } finally {
    bitmap.close();
  }
}
