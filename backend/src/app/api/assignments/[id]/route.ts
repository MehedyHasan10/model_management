import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { currentUser, can } from "@/lib/auth";
import { audit } from "@/lib/common";
import { assignmentSchema, returnSchema } from "@/lib/assignment-validation";
import {
  assignmentJson,
  assignmentFail,
  assignmentError,
  assignmentInclude,
  withQuantities,
  validateProductSizes,
} from "@/lib/assignment-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

function domainError(error: unknown) {
  if (!(error instanceof Error)) return null;
  const messages: Record<string, [string, number]> = {
    ASSIGNMENT_NOT_FOUND: ["Assignment not found", 404],
    ASSIGNMENT_LOCKED: [
      "Assignment with returns or completed/cancelled status cannot be edited",
      409,
    ],
    ASSIGNMENT_HAS_RETURNS: [
      "Assignment with return history cannot be deleted",
      409,
    ],
    ASSIGNMENT_NOT_RECEIVABLE: ["Assignment cannot receive returns", 409],
    MODEL_NOT_FOUND: ["Model not found", 404],
    MODEL_INACTIVE: ["Model inactive", 400],
    PRODUCT_NOT_FOUND: ["Product not found", 404],
    DUPLICATE_RETURN_ITEM: ["Duplicate return item", 400],
    INVALID_ASSIGNMENT_ITEM: ["Item does not belong to this assignment", 400],
    RETURN_EXCEEDS_OUTSTANDING: [
      "Return quantity exceeds outstanding quantity",
      400,
    ],
  };
  if (messages[error.message])
    return assignmentFail(...messages[error.message]);
  if (error.message.startsWith("SIZE_ERROR:"))
    return assignmentFail(error.message.slice(11), 400);
  return null;
}

export async function GET(_req: NextRequest, { params }: Context) {
  try {
    const user = await currentUser();
    if (!user) return assignmentFail("Unauthorized", 401);
    if (!(await can(user, "assignments.view")))
      return assignmentFail("Forbidden", 403);
    const { id } = await params;
    const row = await db.assignment.findUnique({
      where: { id },
      include: assignmentInclude,
    });
    return row
      ? assignmentJson(withQuantities(row))
      : assignmentFail("Assignment not found", 404);
  } catch (error) {
    return assignmentError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: Context) {
  try {
    const user = await currentUser();
    if (!user) return assignmentFail("Unauthorized", 401);
    if (!(await can(user, "assignments.edit")))
      return assignmentFail("Forbidden", 403);
    const { id } = await params;
    const input = assignmentSchema.parse(await req.json());
    const result = await db.$transaction(
      async (tx) => {
        const existing = await tx.assignment.findUnique({
          where: { id },
          include: { returns: { select: { id: true } } },
        });
        if (!existing) throw new Error("ASSIGNMENT_NOT_FOUND");
        if (
          ["COMPLETED", "CANCELLED"].includes(existing.status) ||
          existing.returns.length > 0
        )
          throw new Error("ASSIGNMENT_LOCKED");
        const model = await tx.modelProfile.findUnique({
          where: { id: input.modelId },
        });
        if (!model) throw new Error("MODEL_NOT_FOUND");
        if (!model.active && model.id !== existing.modelId)
          throw new Error("MODEL_INACTIVE");
        const ids = [...new Set(input.items.map((i) => i.productId))];
        const products = await tx.product.findMany({
          where: { id: { in: ids } },
          include: { template: true },
        });
        if (products.length !== ids.length)
          throw new Error("PRODUCT_NOT_FOUND");
        const sizeError = validateProductSizes(input.items, products);
        if (sizeError) throw new Error(`SIZE_ERROR:${sizeError}`);
        await tx.assignmentItem.deleteMany({ where: { assignmentId: id } });
        return tx.assignment.update({
          where: { id },
          data: {
            modelId: input.modelId,
            sentDate: new Date(input.sentDate),
            expectedReturnDate: input.expectedReturnDate
              ? new Date(input.expectedReturnDate)
              : null,
            notes: input.notes ?? null,
            items: {
              create: input.items.map((item) => ({
                ...item,
                dontWearQty: dontWearByItem.get(item.assignmentItemId) ?? 0,
              })),
            },
          },
          include: assignmentInclude,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    await audit(user.id, "UPDATE", "assignments", id);
    return assignmentJson(withQuantities(result));
  } catch (error) {
    return domainError(error) ?? assignmentError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: Context) {
  try {
    const user = await currentUser();
    if (!user) return assignmentFail("Unauthorized", 401);
    if (!(await can(user, "assignments.delete")))
      return assignmentFail("Forbidden", 403);
    const { id } = await params;
    await db.$transaction(
      async (tx) => {
        const existing = await tx.assignment.findUnique({
          where: { id },
          include: { returns: { select: { id: true } } },
        });
        if (!existing) throw new Error("ASSIGNMENT_NOT_FOUND");
        if (existing.returns.length) throw new Error("ASSIGNMENT_HAS_RETURNS");
        await tx.assignmentItem.deleteMany({ where: { assignmentId: id } });
        await tx.assignment.delete({ where: { id } });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    await audit(user.id, "DELETE", "assignments", id);
    return assignmentJson({ ok: true });
  } catch (error) {
    return domainError(error) ?? assignmentError(error);
  }
}

// Return Receive is intentionally POST /api/assignments/:id (NO returns folder).
export async function POST(req: NextRequest, { params }: Context) {
  try {
    const user = await currentUser();
    if (!user) return assignmentFail("Unauthorized", 401);
    if (!(await can(user, "returns.receive")))
      return assignmentFail("Forbidden", 403);
    const { id } = await params;
    const raw = await req.json();
    // Keep existing return validation, and validate independent Don't Wear values.
    const input = returnSchema.parse(raw);
    const dontWearInput = z
      .object({
        items: z.array(
          z
            .object({
              assignmentItemId: z.string().min(1),
              dontWearQty: z.number().int().min(0).default(0),
            })
            .passthrough(),
        ),
      })
      .passthrough()
      .parse(raw);
    const dontWearByItem = new Map(
      dontWearInput.items.map((item) => [
        item.assignmentItemId,
        item.dontWearQty,
      ]),
    );
    const result = await db.$transaction(
      async (tx) => {
        const assignment = await tx.assignment.findUnique({
          where: { id },
          include: { items: { include: { returnItems: true } } },
        });
        if (!assignment) throw new Error("ASSIGNMENT_NOT_FOUND");
        if (["DRAFT", "CANCELLED", "COMPLETED"].includes(assignment.status))
          throw new Error("ASSIGNMENT_NOT_RECEIVABLE");
        const seen = new Set<string>();
        for (const item of input.items) {
          if (seen.has(item.assignmentItemId))
            throw new Error("DUPLICATE_RETURN_ITEM");
          seen.add(item.assignmentItemId);
          const source = assignment.items.find(
            (i) => i.id === item.assignmentItemId,
          );
          if (!source) throw new Error("INVALID_ASSIGNMENT_ITEM");
          const alreadyReturned = source.returnItems.reduce(
            (sum, r) => sum + r.quantity,
            0,
          );
          if (item.quantity > source.sentQty - alreadyReturned)
            throw new Error("RETURN_EXCEEDS_OUTSTANDING");
        }
        const received = await tx.returnTransaction.create({
          data: {
            assignmentId: id,
            receivedById: user.id,
            notes: input.notes ?? null,
            items: {
              create: input.items.map((item) => ({
                ...item,
                dontWearQty: dontWearByItem.get(item.assignmentItemId) ?? 0,
              })),
            },
          },
          include: {
            items: true,
            receivedBy: { select: { id: true, name: true } },
          },
        });
        const updatedItems = await tx.assignmentItem.findMany({
          where: { assignmentId: id },
          include: { returnItems: true },
        });
        const completed = updatedItems.every(
          (i) =>
            i.returnItems.reduce((sum, r) => sum + r.quantity, 0) === i.sentQty,
        );
        const status = completed ? "COMPLETED" : "PARTIAL";
        await tx.assignment.update({ where: { id }, data: { status } });
        return { ...received, assignmentStatus: status };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 15000,
      },
    );
    await audit(user.id, "RECEIVE", "returns", result.id);
    return assignmentJson(result, 201);
  } catch (error) {
    return domainError(error) ?? assignmentError(error);
  }
}
