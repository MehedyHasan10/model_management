import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

export const json = (value: unknown, status = 200) =>
  NextResponse.json(value, { status });
export const fail = (error: string, status = 400, details?: unknown) =>
  json({ error, ...(details === undefined ? {} : { details }) }, status);
export function problem(error: unknown) {
  if (error instanceof z.ZodError)
    return fail("Validation failed", 400, error.flatten());
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002")
      return fail("Supplier code already exists", 409);
    if (error.code === "P2025") return fail("Supplier not found", 404);
    if (error.code === "P2003")
      return fail("Supplier is referenced by another record", 409);
  }
  console.error("Supplier API error", error);
  return fail("Internal server error", 500);
}
export async function readJson(request: Request): Promise<unknown> {
  const type = request.headers.get("content-type") || "";
  if (!type.toLowerCase().includes("application/json"))
    throw new SupplierInputError("Content-Type must be application/json", 415);
  const raw = await request.text();
  if (raw.length > 1024 * 1024)
    throw new SupplierInputError("Request body too large", 413);
  try {
    return JSON.parse(raw);
  } catch {
    throw new SupplierInputError("Invalid JSON body", 400);
  }
}
export class SupplierInputError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function handleSupplierError(error: unknown) {
  return error instanceof SupplierInputError
    ? fail(error.message, error.status)
    : problem(error);
}
