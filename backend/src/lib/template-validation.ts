import { z } from "zod";

export const templateInputSchema = z
  .object({
    name: z.string().trim().min(2).max(150),
    categoryId: z.string().trim().min(1).max(128),
    status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).default("ACTIVE"),
    sizes: z.array(z.string().trim().min(1).max(30)).max(100),
    qualityChecks: z.unknown().optional(),
    fieldIds: z.array(z.string().trim().min(1).max(128)).max(200),
  })
  .strict()
  .superRefine((input, ctx) => {
    if (new Set(input.sizes).size !== input.sizes.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sizes"],
        message: "Duplicate sizes",
      });
    }
    if (new Set(input.fieldIds).size !== input.fieldIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fieldIds"],
        message: "Duplicate measurement fields",
      });
    }
    if (input.sizes.length === 0 && input.fieldIds.length !== 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fieldIds"],
        message: "No Measurement templates cannot have measurement fields",
      });
    }
    if (input.sizes.length > 0 && input.fieldIds.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fieldIds"],
        message: "Select at least one measurement field",
      });
    }
  });
