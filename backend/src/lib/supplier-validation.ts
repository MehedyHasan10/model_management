import { z } from "zod";

export const supplierCreateSchema = z.object({
  name: z.string().trim().min(1, "Supplier name is required").max(150),
  contactPerson: z.string().trim().max(150).nullish(),
  phone: z.string().trim().max(50).nullish(),
  email: z
    .union([z.string().trim().email(), z.literal(""), z.null()])
    .optional(),
  address: z.string().trim().max(1000).nullish(),
  notes: z.string().trim().max(2000).nullish(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export const supplierUpdateSchema = supplierCreateSchema.partial();

export type SupplierCreateInput = z.infer<typeof supplierCreateSchema>;

export type SupplierUpdateInput = z.infer<typeof supplierUpdateSchema>;
