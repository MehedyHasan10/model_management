import { Prisma } from "@prisma/client";

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
  const prefix = supplier.name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (!prefix) throw new Error("SUPPLIER_PREFIX_INVALID");
  // Distinct suppliers with the same normalized name cannot safely share a prefix.
  const similar = await tx.supplier.findMany({
    where: { id: { not: supplier.id } },
    select: { name: true },
  });
  if (
    similar.some(
      (s) =>
        s.name
          .trim()
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "") === prefix,
    )
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
