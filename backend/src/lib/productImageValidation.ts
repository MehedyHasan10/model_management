import { z } from "zod";
import { uploadedImageUrl } from "./uploads";

// Images saved before WebP uploads were stored inline as Base64 data URLs.
// They stay valid so older products and models can still be saved unchanged.
function legacyDataUrl(maxBytes: number, label: string) {
  return z.string().superRefine((dataUrl, ctx) => {
    const match =
      /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(
        dataUrl,
      );
    if (!match) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Image must be uploaded first",
      });
      return;
    }
    const base64 = match[2];
    const size =
      Math.floor((base64.length * 3) / 4) -
      (base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0);
    if (size > maxBytes)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${label} must be ${Math.round(maxBytes / 1024)} KB or smaller`,
      });
  });
}

/** An uploaded image URL, or an older inline image. */
export const productImageSchema = z.union([
  uploadedImageUrl,
  legacyDataUrl(700 * 1024, "Each image"),
]);
export const productImagesSchema = z
  .array(productImageSchema)
  .max(15, "Maximum 15 images are allowed");

export const modelPhotoSchema = z
  .union([
    z.literal(""),
    uploadedImageUrl,
    z.string().url().max(2048),
    legacyDataUrl(500 * 1024, "Model photo"),
  ])
  .nullish();
