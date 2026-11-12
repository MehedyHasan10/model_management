
import { z } from "zod";

const id = z.string().trim().min(1, "Please select a value").max(128);

const date = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date");

export const assignmentSchema = z
  .object({
    modelId: id.min(1, "Please select a model"),

    sentDate: date,

    // Optional Expected Return Date
    expectedReturnDate: z.preprocess(
      (value) =>
        value === "" || value === null || value === undefined
          ? null
          : value,
      date.nullable()
    ),

    notes: z.string().max(5000).nullish(),

    items: z
      .array(
        z
          .object({
            productId: id,
            size: z.string()
              .trim()
              .min(1, "Please select a size")
              .max(60),
            sentQty: z
              .number({
                invalid_type_error: "Please enter a valid quantity",
              })
              .int("Quantity must be a whole number")
              .positive("Quantity must be greater than 0")
              .max(1000000),
          })
          .strict()
      )
      .min(1, "Please select at least one product and size")
      .max(500),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (
      v.expectedReturnDate &&
      new Date(v.expectedReturnDate) < new Date(v.sentDate)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["expectedReturnDate"],
        message: "Return date cannot precede sent date",
      });
    }

    const seen = new Set<string>();

    v.items.forEach((item, index) => {
      const key = JSON.stringify([item.productId, item.size]);

      if (seen.has(key)) {
        ctx.addIssue({
          code: "custom",
          path: ["items", index],
          message: "Duplicate product and size",
        });
      }

      seen.add(key);
    });
  });

export const returnSchema = z
  .object({
    notes: z.string().max(5000).nullish(),

    items: z
      .array(
        z
          .object({
            assignmentItemId: id,
            quantity: z.number().int().positive().max(1000000),
            dontWearQty: z.number().int().min(0).max(1000000).default(0),
            condition: z.enum(["GOOD", "DAMAGED", "LOST"]).default("GOOD"),
          })
          .strict()
      )
      .min(1)
      .max(500),
  })
  .strict();
