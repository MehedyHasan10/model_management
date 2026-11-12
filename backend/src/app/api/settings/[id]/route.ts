
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { currentUser, can } from "@/lib/auth";
import { fail, audit } from "@/lib/common";
import { Prisma } from "@prisma/client";

const entity = "settings";

const schema = z
  .object({
    prefix: z.string().regex(/^[A-Z0-9-]{1,10}$/),
    digits: z.number().int().min(2).max(10),
    nextNumber: z.number().int().min(1),
  })
  .strict();

type Ctx = {
  params: Promise<{ id: string }>;
};

function error(e: unknown) {
  if (e instanceof z.ZodError) {
    return NextResponse.json(
      {
        error: "Validation failed",
        details: e.flatten(),
      },
      { status: 400 },
    );
  }

  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2025") {
      return fail("Record not found", 404);
    }

    if (e.code === "P2002") {
      return fail("Duplicate record", 409);
    }

    if (e.code === "P2003") {
      return fail(
        "Related record prevents this operation",
        409,
      );
    }
  }

  console.error(`${entity} API error`, e);

  return fail("Request failed", 500);
}

// UPDATE CODE SETTINGS
export async function PATCH(
  req: NextRequest,
  { params }: Ctx,
) {
  const u = await currentUser();

  if (!u) {
    return fail("Unauthorized", 401);
  }

  if (!(await can(u, `${entity}.edit`))) {
    return fail("Forbidden", 403);
  }

  const { id } = await params;

  if (id !== "product") {
    return fail("Unknown setting", 404);
  }

  try {
    const input = schema.parse(await req.json());

    const result = await db.serialSetting.update({
      where: {
        id: "product",
      },
      data: input,
    });

    await audit(u.id, "UPDATE", entity, id);

    return NextResponse.json(result);
  } catch (e) {
    return error(e);
  }
}

// DELETE CODE SETTINGS - NOT ALLOWED
export async function DELETE(
  _req: NextRequest,
  { params }: Ctx,
) {
  const u = await currentUser();

  if (!u) {
    return fail("Unauthorized", 401);
  }

  if (!(await can(u, `${entity}.delete`))) {
    return fail("Forbidden", 403);
  }

  const { id } = await params;

  if (id !== "product") {
    return fail("Unknown setting", 404);
  }

  return fail("Settings cannot be deleted", 405);
}
