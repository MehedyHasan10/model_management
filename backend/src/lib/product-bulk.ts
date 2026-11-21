import ExcelJS from "exceljs";
import { Prisma, PrismaClient } from "@prisma/client";
import {
  DEFAULT_SUPPLIER_START,
  formatSupplierCode,
  nextSupplierNumber,
  previewSupplierCode,
  supplierCodeFormats,
} from "@/lib/product-supplier-code";

export const BULK_MAX_ROWS = 1000;
export const BULK_MAX_BYTES = 5 * 1024 * 1024;
const MAX_SUPPLIER_NUMBER = 99_999_999;

/** Sample/upload columns. A typed CODE (product SN) is kept; a blank one comes from Code Settings. */
export const BULK_COLUMNS = [
  { key: "code", header: "CODE", width: 12 },
  { key: "supplierCode", header: "SUPPLIER CODE", width: 18 },
  { key: "supplierName", header: "SUPPLIER NAME", width: 20 },
  { key: "itemName", header: "PRODUCT NAME", width: 32 },
  { key: "category", header: "CATEGORY", width: 18 },
  { key: "template", header: "TEMPLATE", width: 18 },
  { key: "pp", header: "PP", width: 10 },
  { key: "sp", header: "SP", width: 10 },
] as const;

type ColumnKey = (typeof BULK_COLUMNS)[number]["key"];
export type BulkInputRow = { row: number } & Record<ColumnKey, string>;

const HEADER_ALIASES: Record<string, ColumnKey> = {
  CODE: "code",
  PRODUCTCODE: "code",
  SUPPLIERCODE: "supplierCode",
  SUPPLIERNAME: "supplierName",
  SUPPLIER: "supplierName",
  PRODUCTNAME: "itemName",
  ITEMNAME: "itemName",
  STYLENAME: "itemName",
  CATEGORY: "category",
  TEMPLATE: "template",
  TEMPLATED: "template",
  PP: "pp",
  SP: "sp",
};

const normalizeHeader = (s: string) => s.toUpperCase().replace(/[^A-Z]/g, "");
const sameName = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("richText" in value)
      return value.richText.map((r) => r.text).join("").trim();
    if ("result" in value) return cellText(value.result as ExcelJS.CellValue);
    if ("text" in value) return String(value.text).trim();
  }
  return "";
}

export class BulkFileError extends Error {}

/** Read the first worksheet. The header row is the first row (within 10) that has PRODUCT NAME. */
export async function parseBulkWorkbook(
  data: ArrayBuffer,
): Promise<BulkInputRow[]> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(data);
  } catch {
    throw new BulkFileError(
      "Could not read the file. Upload an Excel .xlsx file (use the sample).",
    );
  }
  const sheet = wb.worksheets[0];
  if (!sheet) throw new BulkFileError("The Excel file has no sheets.");

  let headerRow = 0;
  const columns = new Map<number, ColumnKey>();
  for (let r = 1; r <= Math.min(10, sheet.rowCount) && !headerRow; r++) {
    const found = new Map<number, ColumnKey>();
    sheet.getRow(r).eachCell((cell, col) => {
      const key = HEADER_ALIASES[normalizeHeader(cellText(cell.value))];
      if (key && ![...found.values()].includes(key)) found.set(col, key);
    });
    if ([...found.values()].includes("itemName")) {
      headerRow = r;
      found.forEach((v, k) => columns.set(k, v));
    }
  }
  if (!headerRow)
    throw new BulkFileError(
      "Header row not found. The first row must contain column names like PRODUCT NAME, SUPPLIER NAME, CATEGORY.",
    );

  const rows: BulkInputRow[] = [];
  for (let r = headerRow + 1; r <= sheet.rowCount; r++) {
    const excelRow = sheet.getRow(r);
    const item = {
      row: r,
      code: "",
      supplierCode: "",
      supplierName: "",
      itemName: "",
      category: "",
      template: "",
      pp: "",
      sp: "",
    } as BulkInputRow;
    columns.forEach((key, col) => {
      item[key] = cellText(excelRow.getCell(col).value);
    });
    if (BULK_COLUMNS.every(({ key }) => key === "code" || !item[key]))
      continue; // blank line (a leftover CODE alone does not count)
    rows.push(item);
    if (rows.length > BULK_MAX_ROWS)
      throw new BulkFileError(
        `Too many rows. Upload at most ${BULK_MAX_ROWS} products per file.`,
      );
  }
  if (!rows.length) throw new BulkFileError("The file has no product rows.");
  return rows;
}

export type PlannedRow = {
  row: number;
  /** Product code (SN) this row will get: the typed CODE, or the next from Code Settings. */
  code: string;
  autoCode: boolean;
  supplierCode: string;
  autoSupplierCode: boolean;
  supplierName: string;
  itemName: string;
  category: string;
  template: string;
  pp: string;
  sp: string;
  errors: string[];
  // Resolved ids, present only on valid rows.
  supplierId?: string;
  categoryId?: string;
  templateId?: string | null;
};

type Client = Prisma.TransactionClient | PrismaClient;

function price(label: string, raw: string, errors: string[]) {
  const value = raw.replace(/,/g, "").trim();
  if (!value) return null;
  if (!/^\d+(\.\d+)?$/.test(value) || value.length > 20) {
    errors.push(`${label} must be a number`);
    return null;
  }
  return value;
}

/**
 * Validate rows against the database and assign supplier codes.
 * A typed SUPPLIER CODE is kept as-is; blank ones continue from the supplier's
 * sequence, which first jumps past the highest code typed in the file.
 * Returns the rows plus each supplier's new "next number".
 */
export async function planBulkImport(client: Client, input: BulkInputRow[]) {
  const [suppliers, categories, templates] = await Promise.all([
    client.supplier.findMany({
      select: { id: true, name: true, status: true },
    }),
    client.garmentCategory.findMany({ select: { id: true, name: true } }),
    client.measurementTemplate.findMany({
      where: { status: { not: "ARCHIVED" } },
      select: { id: true, name: true, categoryId: true },
    }),
  ]);
  // Prefix follows the supplier name; padding follows its latest code.
  const formats = await supplierCodeFormats(client, suppliers);
  const prefixCount = new Map<string, number>();
  for (const { prefix: p } of formats.values())
    prefixCount.set(p, (prefixCount.get(p) ?? 0) + 1);

  const rows: PlannedRow[] = input.map((r) => {
    const errors: string[] = [];
    const typedCode = r.code.toUpperCase().replace(/\s+/g, "");
    const out: PlannedRow = {
      row: r.row,
      code: typedCode,
      autoCode: !typedCode,
      supplierCode: r.supplierCode.toUpperCase().replace(/\s+/g, ""),
      autoSupplierCode: !r.supplierCode,
      supplierName: r.supplierName,
      itemName: r.itemName,
      category: r.category,
      template: r.template,
      pp: r.pp,
      sp: r.sp,
      errors,
    };

    if (typedCode && !/^[A-Z0-9_-]{1,50}$/.test(typedCode))
      errors.push("CODE may only use letters, numbers, - or _ (max 50)");

    if (r.itemName.length < 2 || r.itemName.length > 150)
      errors.push("Product name must be 2–150 characters");

    let supplier: (typeof suppliers)[number] | undefined;
    if (!r.supplierName) errors.push("Supplier name is required");
    else {
      const matches = suppliers.filter((s) => sameName(s.name, r.supplierName));
      supplier =
        matches.find((s) => s.status === "ACTIVE") ?? matches[0] ?? undefined;
      if (!supplier) errors.push(`Supplier "${r.supplierName}" not found`);
      else if (supplier.status !== "ACTIVE") {
        errors.push(`Supplier "${supplier.name}" is inactive`);
        supplier = undefined;
      } else {
        const prefix = formats.get(supplier.id)!.prefix;
        if (!prefix) errors.push("Supplier name has no letters or digits");
        else if ((prefixCount.get(prefix) ?? 0) > 1)
          errors.push(
            `Several suppliers share the code prefix "${prefix}"; rename one first`,
          );
        else if (out.supplierCode) {
          const m = out.supplierCode.match(/^([A-Z0-9]*?)(\d+)$/);
          const n = m ? Number(m[2]) : NaN;
          if (!m || m[1] !== prefix)
            errors.push(
              `Supplier code must look like ${prefix}${DEFAULT_SUPPLIER_START} for supplier ${supplier.name}`,
            );
          else if (!Number.isSafeInteger(n) || n < 1 || n > MAX_SUPPLIER_NUMBER)
            errors.push("Supplier code number is out of range");
        }
      }
    }

    const category = r.category
      ? categories.find((c) => sameName(c.name, r.category))
      : undefined;
    if (!r.category) errors.push("Category is required");
    else if (!category) errors.push(`Category "${r.category}" not found`);

    let templateId: string | null = null;
    if (r.template && category) {
      const t = templates.find(
        (t) => t.categoryId === category.id && sameName(t.name, r.template),
      );
      if (!t)
        errors.push(
          `Template "${r.template}" not found in category ${category.name}`,
        );
      else templateId = t.id;
    }

    const pp = price("PP", r.pp, errors);
    const sp = price("SP", r.sp, errors);
    out.pp = pp ?? "";
    out.sp = sp ?? "";

    if (!errors.length && supplier && category) {
      out.supplierId = supplier.id;
      out.categoryId = category.id;
      out.templateId = templateId;
    }
    return out;
  });

  // Typed supplier codes: unique within the file and not used yet.
  const typed = rows.filter((r) => !r.errors.length && !r.autoSupplierCode);
  const seen = new Map<string, number>();
  for (const r of typed) {
    const first = seen.get(r.supplierCode);
    if (first) r.errors.push(`Supplier code repeated (also on row ${first})`);
    else seen.set(r.supplierCode, r.row);
  }
  const typedCodes = [...seen.keys()];
  const taken = new Set(
    typedCodes.length
      ? (
          await client.product.findMany({
            where: { supplierCode: { in: typedCodes } },
            select: { supplierCode: true },
          })
        ).map((p) => p.supplierCode!)
      : [],
  );
  for (const r of typed)
    if (!r.errors.length && taken.has(r.supplierCode))
      r.errors.push(`Supplier code ${r.supplierCode} already exists`);

  const nextSerial = await planProductCodes(client, rows);

  // Per supplier: next number = max(highest code in database + 1, highest typed + 1), then fill blanks.
  const valid = rows.filter((r) => !r.errors.length);
  const supplierIds = [...new Set(valid.map((r) => r.supplierId!))];
  const nextNumbers = new Map<string, number>();
  for (const supplierId of supplierIds) {
    const own = valid.filter((r) => r.supplierId === supplierId);
    const format = formats.get(supplierId)!;
    const prefix = format.prefix;
    let next = await nextSupplierNumber(client, supplierId, prefix);
    for (const r of own)
      if (!r.autoSupplierCode)
        next = Math.max(next, Number(r.supplierCode.slice(prefix.length)) + 1);

    const autos = own.filter((r) => r.autoSupplierCode);
    if (autos.length) {
      // Skip numbers already used (e.g. typed earlier with a different zero padding).
      const used = new Set(
        (
          await client.product.findMany({
            where: { supplierCode: { startsWith: prefix } },
            select: { supplierCode: true },
          })
        ).map((p) => p.supplierCode),
      );
      typedCodes.forEach((c) => used.add(c));
      for (const r of autos) {
        while (used.has(formatSupplierCode(format, next))) next++;
        r.supplierCode = formatSupplierCode(format, next++);
      }
    }
    nextNumbers.set(supplierId, next);
  }
  return { rows, nextNumbers, nextSerial };
}

/**
 * A typed CODE is kept as-is (must be unique). Blank ones get the next Code
 * Settings number, skipping codes already used. When a typed code has the
 * settings prefix (TT13546), the counter moves past it so later manual entries
 * continue from there. Returns the new Code Settings "next number".
 */
async function planProductCodes(client: Client, rows: PlannedRow[]) {
  const typed = rows.filter((r) => !r.errors.length && !r.autoCode);
  const seen = new Map<string, number>();
  for (const r of typed) {
    const first = seen.get(r.code);
    if (first) r.errors.push(`CODE repeated (also on row ${first})`);
    else seen.set(r.code, r.row);
  }
  const typedCodes = [...seen.keys()];
  const taken = new Set(
    typedCodes.length
      ? (
          await client.product.findMany({
            where: { sn: { in: typedCodes } },
            select: { sn: true },
          })
        ).map((p) => p.sn)
      : [],
  );
  for (const r of typed)
    if (!r.errors.length && taken.has(r.code))
      r.errors.push(`CODE ${r.code} already exists`);

  const serial = await client.serialSetting.findUnique({
    where: { id: "product" },
  });
  const prefix = serial?.prefix ?? "MT";
  const digits = serial?.digits ?? 4;
  let next = serial?.nextNumber ?? 1;
  const pattern = new RegExp(`^${prefix.replace(/[^A-Za-z0-9]/g, "\\$&")}(\\d+)$`);
  for (const r of typed) {
    const n = Number(r.code.match(pattern)?.[1]);
    if (!r.errors.length && Number.isSafeInteger(n)) next = Math.max(next, n + 1);
  }

  const autos = rows.filter((r) => !r.errors.length && r.autoCode);
  if (autos.length) {
    const used = new Set(
      (
        await client.product.findMany({
          where: { sn: { startsWith: prefix } },
          select: { sn: true },
        })
      ).map((p) => p.sn),
    );
    typedCodes.forEach((c) => used.add(c));
    const format = (n: number) => prefix + String(n).padStart(digits, "0");
    for (const r of autos) {
      while (used.has(format(next))) next++;
      r.code = format(next++);
    }
  }
  return next;
}

/** Insert the valid rows in one Serializable transaction (retried on conflicts). */
export async function commitBulkImport(db: PrismaClient, input: BulkInputRow[]) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(
        async (tx) => {
          const { rows, nextNumbers, nextSerial } = await planBulkImport(
            tx,
            input,
          );
          const valid = rows.filter((r) => !r.errors.length);
          if (!valid.length) return { rows, created: [] as string[] };

          // Typed CODEs were kept; the counter moves past them and the blanks.
          await tx.serialSetting.upsert({
            where: { id: "product" },
            update: { nextNumber: nextSerial },
            create: { id: "product", nextNumber: nextSerial },
          });
          const sns = valid.map((r) => r.code);

          await tx.product.createMany({
            data: valid.map((r, i) => ({
              sn: sns[i],
              code: null,
              supplierId: r.supplierId!,
              supplierCode: r.supplierCode,
              itemName: r.itemName,
              categoryId: r.categoryId!,
              templateId: r.templateId ?? null,
              pp: r.pp || null,
              sp: r.sp || null,
            })),
          });

          for (const [supplierId, nextNumber] of nextNumbers)
            await tx.supplierProductSequence.upsert({
              where: { supplierId },
              create: { supplierId, nextNumber },
              update: { nextNumber },
            });

          return { rows, created: sns };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 60_000,
        },
      );
    } catch (error) {
      const retryable =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034";
      if (!retryable || attempt === 2) throw error;
    }
  }
}

/** Sample workbook with live example rows plus a Lists sheet of valid names. */
export async function buildBulkTemplate(db: PrismaClient) {
  const [suppliers, categories, templates, serial] = await Promise.all([
    db.supplier.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        productSequence: { select: { nextNumber: true } },
      },
      orderBy: { name: "asc" },
    }),
    db.garmentCategory.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.measurementTemplate.findMany({
      where: { status: { not: "ARCHIVED" } },
      select: { name: true, categoryId: true },
      orderBy: { name: "asc" },
    }),
    db.serialSetting.findUnique({ where: { id: "product" } }),
  ]);
  const productCode = (offset: number) =>
    (serial?.prefix ?? "MT") +
    String((serial?.nextNumber ?? 1) + offset).padStart(serial?.digits ?? 4, "0");

  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Products");
  sheet.columns = BULK_COLUMNS.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width,
  }));
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF7C3AED" },
  };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  const supplier = suppliers[0];
  const sampleSupplierCode =
    (supplier && (await previewSupplierCode(db, supplier))) ||
    `KKS${DEFAULT_SUPPLIER_START}`;
  const category =
    categories.find((c) => templates.some((t) => t.categoryId === c.id)) ??
    categories[0];
  const template = templates.find((t) => t.categoryId === category?.id);
  const example = {
    supplierName: supplier?.name ?? "KKS",
    category: category?.name ?? "Top Wear",
    template: template?.name ?? "",
  };
  sheet.addRows([
    {
      ...example,
      code: productCode(0),
      supplierCode: sampleSupplierCode,
      itemName: "Sample Denim Shirt",
      pp: 400,
      sp: 750,
    },
    {
      ...example,
      code: productCode(1),
      supplierCode: "",
      itemName: "Sample Overcoat",
      pp: 1400,
      sp: 1999,
    },
  ]);
  // Explain CODE on its header: typed values are kept, blanks are generated.
  header.getCell(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.getCell(1).note =
    "Type a code to keep it as-is, or leave blank to get the next code from Code Settings.";

  const lists = wb.addWorksheet("Lists");
  lists.columns = [
    { header: "SUPPLIER NAME", width: 22 },
    { header: "CATEGORY", width: 20 },
    { header: "TEMPLATE", width: 22 },
    { header: "TEMPLATE CATEGORY", width: 22 },
  ];
  lists.getRow(1).font = { bold: true };
  const height = Math.max(suppliers.length, categories.length, templates.length);
  for (let i = 0; i < height; i++)
    lists.addRow([
      suppliers[i]?.name ?? null,
      categories[i]?.name ?? null,
      templates[i]?.name ?? null,
      templates[i]
        ? categories.find((c) => c.id === templates[i].categoryId)?.name ?? null
        : null,
    ]);
  const dropdown = (col: string, listCol: string, count: number) => {
    if (!count) return;
    for (let r = 2; r <= BULK_MAX_ROWS + 1; r++)
      sheet.getCell(`${col}${r}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`Lists!$${listCol}$2:$${listCol}$${count + 1}`],
      };
  };
  dropdown("C", "A", suppliers.length);
  dropdown("E", "B", categories.length);

  const help = wb.addWorksheet("Instructions");
  help.getColumn(1).width = 110;
  [
    "HOW TO BULK UPLOAD PRODUCTS",
    "",
    "1. Fill one product per row in the Products sheet. Keep the header row unchanged.",
    `2. CODE: type it (e.g. TT13546) to keep it as-is, or leave it blank to get the next code from Code Settings (e.g. ${productCode(0)}).`,
    "   A typed CODE must be unique. Manual entries continue after the highest typed code with the Code Settings prefix.",
    `3. SUPPLIER CODE: type it (e.g. ${sampleSupplierCode}) or leave it blank to auto-generate.`,
    "   When you type a code, the next new product of that supplier continues from the next number.",
    "   The code must start with the supplier name letters (KKS → KKS1050).",
    "4. SUPPLIER NAME, CATEGORY: required, must match existing names (see the Lists sheet).",
    "5. TEMPLATE: optional, must belong to the selected CATEGORY.",
    "6. PP, SP: numbers only.",
    `7. Maximum ${BULK_MAX_ROWS} rows per file. Delete the sample rows before uploading.`,
  ].forEach((line, i) => {
    const row = help.addRow([line]);
    if (i === 0) row.font = { bold: true, size: 14 };
  });

  return Buffer.from(await wb.xlsx.writeBuffer());
}
