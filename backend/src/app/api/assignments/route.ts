import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { currentUser, can } from "@/lib/auth";
import { audit } from "@/lib/common";
import { assignmentSchema } from "@/lib/assignment-validation";
import {
  assignmentJson,
  assignmentFail,
  assignmentError,
  assignmentInclude,
  assignmentListInclude,
  withQuantities,
  validateProductSizes,
} from "@/lib/assignment-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) return assignmentFail("Unauthorized", 401);
    if (!(await can(user, "assignments.view")))
      return assignmentFail("Forbidden", 403);
    const search = req.nextUrl.searchParams;
    const modelId = search.get("modelId");
    const paginated = search.has("page") || search.has("limit");
    const page = Number(search.get("page") || 1);
    const limit = Number(search.get("limit") || 20);
    if (
      !Number.isSafeInteger(page) ||
      page < 1 ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 100 ||
      (page - 1) * limit > Number.MAX_SAFE_INTEGER
    )
      return assignmentFail("Invalid pagination", 400);
    const where: Prisma.AssignmentWhereInput = modelId ? { modelId } : {};
    const include =
      search.get("view") === "list" ? assignmentListInclude : assignmentInclude;
    if (!paginated) {
      const rows = await db.assignment.findMany({
        where,
        include,
        orderBy: { createdAt: "desc" },
      });
      return assignmentJson(rows.map(withQuantities));
    }
    const [rows, total] = await Promise.all([
      db.assignment.findMany({
        where,
        include,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.assignment.count({ where }),
    ]);
    return assignmentJson({
      items: rows.map(withQuantities),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return assignmentError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) return assignmentFail("Unauthorized", 401);
    if (!(await can(user, "assignments.create")))
      return assignmentFail("Forbidden", 403);
    const input = assignmentSchema.parse(await req.json());
    const result = await db.$transaction(
      async (tx) => {
        const model = await tx.modelProfile.findUnique({
          where: { id: input.modelId },
        });
        if (!model) throw new Error("MODEL_NOT_FOUND");
        if (!model.active) throw new Error("MODEL_INACTIVE");
        const ids = [...new Set(input.items.map((i) => i.productId))];
        const products = await tx.product.findMany({
          where: { id: { in: ids } },
          include: { template: true },
        });
        if (products.length !== ids.length)
          throw new Error("PRODUCT_NOT_FOUND");
        const sizeError = validateProductSizes(input.items, products);
        if (sizeError) throw new Error(`SIZE_ERROR:${sizeError}`);
        return tx.assignment.create({
          data: {
            number: `ASG-${Date.now()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
            modelId: input.modelId,
            createdById: user.id,
            sentDate: new Date(input.sentDate),
            expectedReturnDate: input.expectedReturnDate
              ? new Date(input.expectedReturnDate)
              : null,
            notes: input.notes ?? null,
            status: "ISSUED",
            items: { create: input.items },
          },
          include: assignmentInclude,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    await audit(user.id, "CREATE", "assignments", result.id);
    return assignmentJson(withQuantities(result), 201);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "MODEL_NOT_FOUND")
        return assignmentFail("Model not found", 404);
      if (error.message === "MODEL_INACTIVE")
        return assignmentFail("Model inactive", 400);
      if (error.message === "PRODUCT_NOT_FOUND")
        return assignmentFail("Product not found", 404);
      if (error.message.startsWith("SIZE_ERROR:"))
        return assignmentFail(error.message.slice(11), 400);
    }
    return assignmentError(error);
  }
}
