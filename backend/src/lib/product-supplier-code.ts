import { Prisma, PrismaClient } from "@prisma/client";

type Client = Prisma.TransactionClient | PrismaClient;

export const DEFAULT_SUPPLIER_START = 101;

/** Supplier-code prefix derived from the supplier name, e.g. "K.K.S" → "KKS". */
export const supplierPrefix = (name: string) =>
  name.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

/** How a supplier's codes are written: SG0101 → { prefix: "SG", width: 4 }. */
export type SupplierCodeFormat = { prefix: string; width: number };

export const formatSupplierCode = (format: SupplierCodeFormat, n: number) =>
  `${format.prefix}${String(n).padStart(format.width, "0")}`;

/**
 * Code format per supplier: the prefix always follows the supplier name, the
 * digit width follows its latest code (SG0101 → SG0102). Suppliers without
 * codes get no padding (SPP101).
 */
export async function supplierCodeFormats(
  client: Client,
  suppliers: { id: string; name: string }[],
): Promise<Map<string, SupplierCodeFormat>> {
  const latest = suppliers.length
    ? await client.$queryRaw<{ supplierId: string; supplierCode: string }[]>`
        SELECT DISTINCT ON ("supplierId") "supplierId", "supplierCode"
        FROM "Product"
        WHERE "supplierId" IN (${Prisma.join(suppliers.map((s) => s.id))})
          AND "supplierCode" ~ '^[A-Z0-9]*[0-9]$'
        ORDER BY "supplierId", "createdAt" DESC, "id" DESC`
    : [];
  const byId = new Map(latest.map((r) => [r.supplierId, r.supplierCode]));
  const formats = new Map<string, SupplierCodeFormat>();
  for (const s of suppliers) {
    const m = byId.get(s.id)?.match(/^([A-Z0-9]*?)(\d+)$/);
    formats.set(s.id, {
      prefix: supplierPrefix(s.name),
      width: m ? m[2].length : 0,
    });
  }
  return formats;
}

/**
 * After a supplier rename, move its codes to the new prefix keeping the
 * number (SSP101 → SSPT101). Product codes (SN) are never touched.
 * Call inside the same transaction as the supplier update.
 */
export async function renameSupplierCodes(
  tx: Prisma.TransactionClient,
  supplierId: string,
  oldName: string,
  newName: string,
): Promise<number> {
  const from = supplierPrefix(oldName);
  const to = supplierPrefix(newName);
  if (from === to) return 0;
  if (!to) throw new Error("SUPPLIER_PREFIX_INVALID");
  const others = await tx.supplier.findMany({
    where: { id: { not: supplierId } },
    select: { name: true },
  });
  if (others.some((s) => supplierPrefix(s.name) === to))
    throw new Error("SUPPLIER_PREFIX_CONFLICT");

  const pattern = `^${from}[0-9]+$`;
  const start = from.length + 1;
  const [clash] = await tx.$queryRaw<{ supplierCode: string }[]>`
    SELECT p."supplierCode" FROM "Product" p
    WHERE p."supplierCode" IN (
      SELECT ${to} || substring(r."supplierCode" FROM ${start}::int)
      FROM "Product" r
      WHERE r."supplierId" = ${supplierId} AND r."supplierCode" ~ ${pattern}
    )
    AND NOT (p."supplierId" = ${supplierId} AND p."supplierCode" ~ ${pattern})
    LIMIT 1`;
  if (clash) throw new Error(`SUPPLIER_CODE_TAKEN:${clash.supplierCode}`);

  return tx.$executeRaw`
    UPDATE "Product"
    SET "supplierCode" = ${to} || substring("supplierCode" FROM ${start}::int)
    WHERE "supplierId" = ${supplierId} AND "supplierCode" ~ ${pattern}`;
}

export async function supplierCodeFormat(
  client: Client,
  supplier: { id: string; name: string },
) {
  return (await supplierCodeFormats(client, [supplier])).get(supplier.id)!;
}

/** Highest number already used with this prefix in Product (CSK2051 → 2051). */
export async function maxSupplierNumber(
  client: Client,
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
 * database (SPP101 → SPP102). The stored sequence, then 101, is only a
 * fallback for a supplier that has no codes yet.
 */
export async function nextSupplierNumber(
  client: Client,
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

/** Next code a new product of this supplier would get (no reservation). */
export async function previewSupplierCode(
  client: Client,
  supplier: { id: string; name: string },
) {
  const format = await supplierCodeFormat(client, supplier);
  if (!format.prefix) return null;
  return formatSupplierCode(
    format,
    await nextSupplierNumber(client, supplier.id, format.prefix),
  );
}

/** Generate a new supplier-scoped product reference, e.g. SPP102.
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
  const format = await supplierCodeFormat(tx, supplier);
  if (!format.prefix) throw new Error("SUPPLIER_PREFIX_INVALID");
  // Distinct suppliers with the same normalized name cannot safely share a prefix.
  const others = await tx.supplier.findMany({
    where: { id: { not: supplier.id } },
    select: { name: true },
  });
  if (others.some((s) => supplierPrefix(s.name) === format.prefix))
    throw new Error("SUPPLIER_PREFIX_CONFLICT");

  let number = await nextSupplierNumber(tx, supplierId, format.prefix);
  // Skip codes already taken (e.g. the same number with different padding).
  while (
    await tx.product.findUnique({
      where: { supplierCode: formatSupplierCode(format, number) },
      select: { id: true },
    })
  )
    number++;
  await tx.supplierProductSequence.upsert({
    where: { supplierId },
    create: { supplierId, nextNumber: number + 1 },
    update: { nextNumber: number + 1 },
  });
  return formatSupplierCode(format, number);
}
