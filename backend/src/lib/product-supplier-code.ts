import { Prisma, PrismaClient } from "@prisma/client";

const DEFAULT_SUPPLIER_START = 1001;

/** Supplier-code prefix derived from the supplier name, e.g. "K.K.S" → "KKS". */
export const supplierPrefix = (name: string) =>
  name.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Highest number already used with this prefix in Product (CSK2051 → 2051). */
export async function maxSupplierNumber(
  client: Prisma.TransactionClient | PrismaClient,
  prefix: string,
): Promise<number | null> {
  const [row] = await client.$queryRaw<{ max: string | null }[]>`
    SELECT MAX(substring("supplierCode" FROM ${prefix.length + 1}::int)::numeric)::text AS max
    FROM "Product"
    WHERE "supplierCode" ~ ${`^${prefix}[0-9]+$`}`;
  const max = Number(row?.max);
  return row?.max != null && Number.isSafeInteger(max) ? max : null;
}

/**
 * Next number for a supplier: one past the highest code currently in the
 * database (CSK2051 → CSK2052). The stored sequence, then 1001, is only a
 * fallback for a supplier that has no codes yet.
 */
export async function nextSupplierNumber(
  client: Prisma.TransactionClient | PrismaClient,
  supplierId: string,
  prefix: string,
): Promise<number> {
  const max = await maxSupplierNumber(client, prefix);
  if (max !== null) return max + 1;
  const sequence = await client.supplierProductSequence.findUnique({
    where: { supplierId },
    select: { nextNumber: true },
  });
  return sequence?.nextNumber ?? DEFAULT_SUPPLIER_START;
}

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
  if (similar.some((s) => supplierPrefix(s.name) === prefix)) {
    throw new Error("SUPPLIER_PREFIX_CONFLICT");
  }
  const number = await nextSupplierNumber(tx, supplierId, prefix);
  await tx.supplierProductSequence.upsert({
    where: { supplierId },
    create: { supplierId, nextNumber: number + 1 },
    update: { nextNumber: number + 1 },
  });
  return `${prefix}${number}`;
}
