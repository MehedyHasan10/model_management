import { Prisma } from "@prisma/client";

/** Supplier-code prefix derived from the supplier name, e.g. "K.K.S" → "KKS". */
export const supplierPrefix = (name: string) =>
  name.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Generate a new supplier-scoped product reference, e.g. ENF1001.
 *  Call only INSIDE the same Serializable transaction as product creation.
 */
export async function allocateSupplierCode(
  tx: Prisma.TransactionClient,
  supplierId: string,
): Promise<string> {
  const supplier = await tx.supplier.findUnique({
    where: { id: supplierId },
    select: { id: true, name: true, status: true },
  });
  if (!supplier) throw new Error("SUPPLIER_NOT_FOUND");
  if (supplier.status !== "ACTIVE") throw new Error("SUPPLIER_INACTIVE");
  const prefix = supplierPrefix(supplier.name);
  if (!prefix) throw new Error("SUPPLIER_PREFIX_INVALID");
  // Distinct suppliers with the same normalized name cannot safely share a prefix.
  const similar = await tx.supplier.findMany({
    where: { id: { not: supplier.id } },
    select: { name: true },
  });
  if (
    similar.some((s) => supplierPrefix(s.name) === prefix)
  ) {
    throw new Error("SUPPLIER_PREFIX_CONFLICT");
  }
  await tx.supplierProductSequence.upsert({
    where: { supplierId },
    create: { supplierId, nextNumber: 1001 },
    update: {},
  });
  const seq = await tx.supplierProductSequence.update({
    where: { supplierId },
    data: { nextNumber: { increment: 1 } },
  });
  return `${prefix}${seq.nextNumber - 1}`;
}
