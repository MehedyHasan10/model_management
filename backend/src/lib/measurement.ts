import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "./db";
import { fail } from "./common";

// Every response that carries a measurement field exposes its unit as
// { id, name, symbol }, so a renamed unit shows up everywhere at once.
export const unitSelect = { id: true, name: true, symbol: true } as const;
export const fieldWithUnit = {
  include: { unit: { select: unitSelect } },
} as const;

export const unitInputSchema = z
  .object({
    name: z
      .string({ required_error: "Unit name is required" })
      .trim()
      .min(1, "Unit name is required")
      .max(50, "Unit name must be 50 characters or less"),
    symbol: z
      .string({ required_error: "Symbol is required" })
      .trim()
      .min(1, "Symbol is required")
      .max(10, "Symbol must be 10 characters or less"),
  })
  .strict();

/** Returns a 409 message when another unit already uses the name or symbol. */
export async function unitConflict(
  input: { name: string; symbol: string },
  exceptId?: string,
): Promise<{ field: "name" | "symbol"; error: string } | null> {
  const others = { id: exceptId ? { not: exceptId } : undefined };
  const sameName = await db.measurementUnit.findFirst({
    where: { ...others, name: { equals: input.name, mode: "insensitive" } },
    select: { id: true },
  });
  if (sameName)
    return { field: "name", error: "A unit with this name already exists" };
  const sameSymbol = await db.measurementUnit.findFirst({
    where: { ...others, symbol: { equals: input.symbol, mode: "insensitive" } },
    select: { id: true },
  });
  if (sameSymbol)
    return { field: "symbol", error: "A unit with this symbol already exists" };
  return null;
}

export function unitError(e: unknown) {
  if (e instanceof z.ZodError) {
    const issue = e.issues[0];
    return NextResponse.json(
      {
        error: issue?.message ?? "Validation failed",
        field: issue?.path[0],
        details: e.flatten(),
      },
      { status: 400 },
    );
  }
  if (e instanceof SyntaxError) return fail("Invalid JSON body", 400);
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2025") return fail("Unit not found", 404);
    if (e.code === "P2002")
      return fail("A unit with this name or symbol already exists", 409);
    if (e.code === "P2003")
      return fail("This unit is used by measurement fields", 409);
  }
  console.error("units API error", e);
  return fail("Request failed", 500);
}

export const FIELD_NAME_TAKEN = "A field with this name already exists";

/** True when a field other than `exceptId` has the same trimmed name, ignoring case. */
export async function fieldNameTaken(name: string, exceptId?: string) {
  const other = await db.measurementField.findFirst({
    where: {
      id: exceptId ? { not: exceptId } : undefined,
      name: { equals: name.trim(), mode: "insensitive" },
    },
    select: { id: true },
  });
  return Boolean(other);
}

// Measurement values are stored as text: a single number (38, 38.5) or a
// range where the first number is smaller (34-38, 34.5-36).
export const MEASUREMENT_VALUE_PATTERN =
  /^\d{1,3}(\.\d{1,2})?(-\d{1,3}(\.\d{1,2})?)?$/;
export const MEASUREMENT_VALUE_MESSAGE = "Use a number or a range like 34-38";

/** Trims spaces and turns long dashes into "-": "34 - 38" becomes "34-38". */
export function normalizeMeasurementValue(raw: string) {
  return raw
    .replace(/[\u2012-\u2015\u2212]/g, "-")
    .trim()
    .replace(/\s*-\s*/g, "-");
}

export function isValidMeasurementValue(value: string) {
  if (!MEASUREMENT_VALUE_PATTERN.test(value)) return false;
  const [from, to] = value.split("-");
  return to === undefined || Number(from) < Number(to);
}

export const measurementValueSchema = z
  .union([z.string(), z.number().finite()])
  .transform((v) => normalizeMeasurementValue(String(v)))
  .refine(isValidMeasurementValue, MEASUREMENT_VALUE_MESSAGE);
