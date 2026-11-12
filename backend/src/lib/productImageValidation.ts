import { z } from "zod";

const MAX_IMAGE_BYTES = 700 * 1024;
export const productImageSchema = z.string().superRefine((dataUrl, ctx) => {
  const match =
    /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Image must be a Base64 JPG, PNG or WebP data URL",
    });
    return;
  }
  const base64 = match[2];
  const size =
    Math.floor((base64.length * 3) / 4) -
    (base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0);
  if (size > MAX_IMAGE_BYTES)
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Image must be 700 KB or smaller",
    });
});
export const productImagesSchema = z.array(productImageSchema).max(15);
