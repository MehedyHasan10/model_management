import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { fieldWithUnit } from "@/lib/measurement";

export function assignmentJson(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export function assignmentFail(message: string, status = 400) {
  return assignmentJson({ error: message }, status);
}
export function assignmentError(error: unknown) {
  if (error instanceof z.ZodError)
    return assignmentJson(
      {
        error:
          error.issues
            .map((issue) => {
              const field = issue.path.map(String).join(".");
              return `${field || "Input"}: ${issue.message}`;
            })
            .join("; ") || "Please check the submitted fields",
        details: error.flatten(),
      },
      400,
    );
  if (error instanceof SyntaxError)
    return assignmentFail("Invalid JSON request", 400);
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const errors: Record<string, [string, number]> = {
      P2002: ["Duplicate record", 409],
      P2003: ["Related record prevents operation", 409],
      P2025: ["Record not found", 404],
      P2034: ["Concurrent update conflict; retry request", 409],
    };
    if (errors[error.code]) return assignmentFail(...errors[error.code]);
  }
  console.error("Assignments API:", error);
  return assignmentFail("Internal server error", 500);
}
export const assignmentInclude = {
  model: true,
  createdBy: { select: { id: true, name: true } },
  contentDoneBy: { select: { id: true, name: true } },
  items: {
    include: {
      product: {
        include: {
          category: true,
          supplier: { select: { id: true, name: true, code: true } },
          template: {
            include: {
              fields: {
                include: { field: fieldWithUnit },
                orderBy: { order: "asc" as const },
              },
            },
          },
          images: true,
          measurements: { include: { field: fieldWithUnit } },
        },
      },
      returnItems: true,
    },
  },
  returns: {
    include: {
      receivedBy: { select: { id: true, name: true } },
      items: true,
    },
    orderBy: { receivedAt: "desc" as const },
  },
};
export function withQuantities<
  T extends {
    items: Array<{ sentQty: number; returnItems: Array<{ quantity: number }> }>;
  },
>(row: T) {
  const items = row.items.map((item) => {
    const returnedQty = item.returnItems.reduce(
      (sum, ret) => sum + ret.quantity,
      0,
    );
    return {
      ...item,
      returnedQty,
      outstandingQty: Math.max(0, item.sentQty - returnedQty),
    };
  });
  return {
    ...row,
    items,
    totalSentQty: items.reduce((sum, item) => sum + item.sentQty, 0),
    totalReturnedQty: items.reduce((sum, item) => sum + item.returnedQty, 0),
    totalOutstandingQty: items.reduce(
      (sum, item) => sum + item.outstandingQty,
      0,
    ),
  };
}
export function validateProductSizes(
  items: Array<{ productId: string; size: string }>,
  products: Array<{
    id: string;
    itemName: string;
    template: { sizes: unknown } | null;
  }>,
): string | null {
  const map = new Map(products.map((p) => [p.id, p]));
  for (const item of items) {
    const product = map.get(item.productId);
    if (!product) return "Product not found";
    const sizes = product.template?.sizes;
    if (Array.isArray(sizes)) {
      const configured = sizes
        .map((size) => String(size).trim())
        .filter(Boolean);
      // No-measurement templates may explicitly configure either size label.
      // A truly empty size array is accepted only for the two non-measured tags.
      if (
        configured.length === 0 &&
        !["No Size", "Free Size"].includes(item.size)
      )
        return `${product.itemName}: please select No Size or Free Size`;
      if (configured.length > 0 && !configured.includes(item.size))
        return `${product.itemName}: ${item.size} is not available in the selected template`;
    }
  }
  return null;
}
