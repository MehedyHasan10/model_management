import { NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import bcrypt from "bcryptjs";

import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";

import { currentUser, can } from "@/lib/auth";

import { fail, audit } from "@/lib/common";

import { entityPermissions } from "@/lib/config";

import { allocateSupplierCode } from "@/lib/product-supplier-code";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

// ──────────────────────────────────────────

// VALIDATION

// ──────────────────────────────────────────

const id = z.string().trim().min(1).max(128);

const name = z.string().trim().min(2).max(150);

const optionalText = z.string().max(5000).nullish();

const categorySchema = z

  .object({
    name,
  })

  .strict();

const fieldSchema = z

  .object({
    name,

    unit: z.string().trim().min(1).max(20).default("in"),

    order: z.number().int().min(0).default(0),
  })

  .strict();

const templateSchema = z

  .object({
    name,

    categoryId: id,

    status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).default("ACTIVE"),

    sizes: z.array(z.string().trim().min(1).max(30)).min(1).max(100),

    qualityChecks: z.unknown().optional(),

    fieldIds: z.array(id).min(1).max(200),
  })

  .strict();

const productSchema = z

  .object({
    supplierId: id,

    itemName: name,

    categoryId: id,

    templateId: id.nullish(),

    pp: z.string().max(100).nullish(),

    wp: z.string().max(100).nullish(),

    fabric: z.string().max(300).nullish(),

    notes: optionalText,

    noSizeText: z.string().max(2000).nullish(),

    images: z
      .array(
        z
          .string()
          .regex(
            /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/,
            "Only JPEG images are supported",
          )
          .superRefine((image, ctx) => {
            const base64 = image.slice("data:image/jpeg;base64,".length);
            const padding = base64.endsWith("==")
              ? 2
              : base64.endsWith("=")
                ? 1
                : 0;
            const decodedBytes = (base64.length * 3) / 4 - padding;
            if (decodedBytes > 700 * 1024) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Each image must be 700 KB or smaller",
              });
            }
          }),
      )
      .max(15, "Maximum 15 images are allowed")
      .default([]),

    measurements: z

      .array(
        z

          .object({
            size: z.string().trim().min(1).max(30),

            fieldId: id,

            value: z.number().finite(),
          })

          .strict(),
      )

      .max(1000)

      .default([]),
  })

  .strict();

const modelSchema = z

  .object({
    name,

    phone: z.string().max(30).nullish(),

    photoUrl: z
      .union([
        z.literal(""),
        z.string().url().max(2048),
        z
          .string()
          .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/)
          .superRefine((value, ctx) => {
            const b = value.slice("data:image/jpeg;base64,".length);
            const p = b.endsWith("==") ? 2 : b.endsWith("=") ? 1 : 0;
            if ((b.length * 3) / 4 - p > 500 * 1024)
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Model photo must be 500 KB or smaller",
              });
          }),
      ])
      .nullish(),

    notes: optionalText,

    active: z.boolean().default(true),
  })

  .strict();

const assignmentSchema = z

  .object({
    modelId: id,

    sentDate: z.string().datetime({ offset: true }).or(z.string().date()),

    expectedReturnDate: z

      .string()

      .datetime({ offset: true })

      .or(z.string().date())

      .nullish(),

    notes: optionalText,

    items: z

      .array(
        z

          .object({
            productId: id,

            size: z.string().trim().min(1).max(30),

            sentQty: z.number().int().positive().max(1000000),
          })

          .strict(),
      )

      .min(1)

      .max(500),
  })

  .strict()

  .refine(
    (v) =>
      !v.expectedReturnDate ||
      new Date(v.expectedReturnDate) >= new Date(v.sentDate),

    {
      message: "Return date cannot be before sent date",

      path: ["expectedReturnDate"],
    },
  );

const roleSchema = z

  .object({
    name,

    description: optionalText,

    permissionIds: z.array(id).max(500).default([]),
  })

  .strict();

const userSchema = z

  .object({
    name,

    email: z.string().trim().email().max(254),

    password: z.string().min(8).max(128),

    roleIds: z.array(id).min(1).max(50),

    status: z.enum(["ACTIVE", "DISABLED"]).default("ACTIVE"),
  })

  .strict();

// ──────────────────────────────────────────

// HELPERS

// ──────────────────────────────────────────

type Context = {
  params: { entity: string } | Promise<{ entity: string }>;
};

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,

    headers: {
      "Cache-Control": "private, no-store",

      "X-Content-Type-Options": "nosniff",
    },
  });
}

function errorResponse(error: unknown) {
  if (error instanceof z.ZodError) {
    return json(
      {
        error:
          error.issues
            .map(
              (issue) => `${issue.path.join(".") || "Input"}: ${issue.message}`,
            )
            .join("; ") || "Invalid input",
        details: error.flatten(),
      },

      400,
    );
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return json({ error: "Record already exists" }, 409);
    }

    if (error.code === "P2003") {
      return json({ error: "Invalid related record" }, 400);
    }

    if (error.code === "P2025") {
      return json({ error: "Record not found" }, 404);
    }

    if (error.code === "P2034") {
      return json(
        {
          error: "Concurrent update conflict. Please retry.",
        },

        409,
      );
    }
  }

  console.error("Entity API error:", error);

  return json(
    {
      error: "Internal server error",
    },

    500,
  );
}

function pagination(req: NextRequest) {
  const params = req.nextUrl.searchParams;

  const enabled = params.has("page") || params.has("limit");

  const schema = z.object({
    page: z.coerce.number().int().min(1).max(1000000),

    limit: z.coerce.number().int().min(1).max(100),
  });

  const { page, limit } = schema.parse({
    page: params.get("page") || "1",

    limit: params.get("limit") || "20",
  });

  return {
    enabled,

    page,

    limit,

    skip: (page - 1) * limit,
  };
}

function paged(items: unknown[], total: number, page: number, limit: number) {
  return {
    items,

    pagination: {
      page,

      limit,

      total,

      totalPages: Math.ceil(total / limit),
    },
  };
}

async function transactionWithRetry<T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.$transaction(callback, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,

        timeout: 15000,
      });
    } catch (error) {
      const retryable =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034";

      if (!retryable || attempt === 2) throw error;
    }
  }

  throw new Error("Transaction retries exhausted");
}

// ──────────────────────────────────────────

// GET

// ──────────────────────────────────────────

export async function GET(req: NextRequest, context: Context) {
  const started = performance.now();

  try {
    const { entity } = await context.params;

    const key = entityPermissions[entity];

    if (!key) return fail("Unsupported entity", 404);

    const u = await currentUser();

    if (!u) return fail("Unauthorized", 401);

    if (!(await can(u, `${key}.view`))) {
      return fail("Forbidden", 403);
    }

    const p = pagination(req);

    let data: unknown;

    switch (entity) {
      case "categories":
        data = await db.garmentCategory.findMany({
          orderBy: { name: "asc" },
        });

        break;

      case "fields":
        data = await db.measurementField.findMany({
          include: { category: true },

          orderBy: { order: "asc" },
        });

        break;

      case "templates":
        data = await db.measurementTemplate.findMany({
          include: {
            category: true,

            fields: {
              include: { field: true },

              orderBy: { order: "asc" },
            },
          },

          orderBy: { createdAt: "desc" },
        });

        break;

      case "products": {
        const query = {
          include: {
            supplier: {
              select: { id: true, name: true, code: true, status: true },
            },

            category: true,

            template: {
              include: {
                fields: {
                  include: { field: true },

                  orderBy: { order: "asc" as const },
                },
              },
            },

            images: {
              orderBy: { order: "asc" as const },
            },

            measurements: {
              include: { field: true },
            },
          },

          orderBy: [{ createdAt: "desc" as const }, { id: "desc" as const }],
        };

        if (!p.enabled) {
          data = await db.product.findMany(query);
        } else {
          const [items, total] = await Promise.all([
            db.product.findMany({
              ...query,

              skip: p.skip,

              take: p.limit,
            }),

            db.product.count(),
          ]);

          data = paged(items, total, p.page, p.limit);
        }

        break;
      }

      case "models":
        data = await db.modelProfile.findMany({
          orderBy: { createdAt: "desc" },
        });

        break;

      case "assignments": {
        const query = {
          include: {
            model: true,

            createdBy: {
              select: {
                name: true,
              },
            },

            items: {
              include: {
                product: {
                  select: {
                    id: true,

                    sn: true,

                    code: true,

                    itemName: true,

                    fabric: true,

                    pp: true,

                    spn: true,

                    wp: true,

                    notes: true,

                    category: {
                      select: {
                        id: true,

                        name: true,
                      },
                    },

                    template: {
                      select: {
                        id: true,

                        name: true,

                        sizes: true,

                        fields: {
                          include: {
                            field: true,
                          },

                          orderBy: {
                            order: "asc" as const,
                          },
                        },
                      },
                    },

                    measurements: {
                      include: {
                        field: true,
                      },
                    },

                    images: {
                      orderBy: {
                        order: "asc" as const,
                      },

                      select: {
                        url: true,

                        order: true,
                      },
                    },
                  },
                },

                returnItems: true,
              },
            },

            returns: {
              include: {
                items: true,

                receivedBy: {
                  select: {
                    name: true,
                  },
                },
              },

              orderBy: {
                receivedAt: "desc" as const,
              },
            },
          },

          orderBy: [{ createdAt: "desc" as const }, { id: "desc" as const }],
        };

        if (!p.enabled) {
          data = await db.assignment.findMany(query);
        } else {
          const [items, total] = await Promise.all([
            db.assignment.findMany({
              ...query,

              skip: p.skip,

              take: p.limit,
            }),

            db.assignment.count(),
          ]);

          data = paged(items, total, p.page, p.limit);
        }

        break;
      }

      case "users":
        data = await db.user.findMany({
          select: {
            id: true,

            name: true,

            email: true,

            status: true,

            createdAt: true,

            roles: {
              include: { role: true },
            },
          },

          orderBy: { createdAt: "desc" },
        });

        break;

      case "roles":
        data = await db.role.findMany({
          include: {
            permissions: {
              include: { permission: true },
            },

            users: {
              include: {
                user: {
                  select: {
                    id: true,

                    name: true,
                  },
                },
              },
            },
          },

          orderBy: { name: "asc" },
        });

        break;

      case "settings":
        data = await db.serialSetting.upsert({
          where: { id: "product" },

          update: {},

          create: { id: "product" },
        });

        break;

      case "audit":
        data = await db.auditLog.findMany({
          take: 150,

          include: {
            user: {
              select: { name: true },
            },
          },

          orderBy: { createdAt: "desc" },
        });

        break;

      default:
        return fail("Unsupported entity", 404);
    }

    if (process.env.NODE_ENV === "development") {
      console.log(
        `[GET /api/${entity}] ${Math.round(performance.now() - started)}ms`,
      );
    }

    return json(data);
  } catch (error) {
    return errorResponse(error);
  }
}

// ──────────────────────────────────────────

// POST

// ──────────────────────────────────────────

export async function POST(req: NextRequest, context: Context) {
  const started = performance.now();

  try {
    const { entity } = await context.params;

    const key = entityPermissions[entity];

    if (!key) return fail("Unsupported entity", 404);

    const u = await currentUser();

    if (!u) return fail("Unauthorized", 401);

    if (!(await can(u, `${key}.create`))) {
      return fail("Forbidden", 403);
    }

    const contentType = req.headers.get("content-type") || "";

    if (!contentType.toLowerCase().includes("application/json")) {
      return json(
        {
          error: "Content-Type must be application/json",
        },

        415,
      );
    } // Basic early rejection. Enforce request body limits

    // at the reverse proxy/platform as well.

    const maxRequestBytes =
      entity === "products" ? 16 * 1024 * 1024 : 1024 * 1024;
    const contentLengthHeader = req.headers.get("content-length");
    if (contentLengthHeader !== null) {
      const contentLength = Number(contentLengthHeader);
      if (!Number.isSafeInteger(contentLength) || contentLength < 0) {
        return json({ error: "Invalid Content-Length header" }, 400);
      }
      if (contentLength > maxRequestBytes) {
        return json(
          {
            error: `Request exceeds ${entity === "products" ? "16 MB" : "1 MB"} limit. Reduce image sizes and retry.`,
          },
          413,
        );
      }
    }

    let body: unknown;
    try {
      if (!req.body) return json({ error: "Request body is required" }, 400);
      const reader = req.body.getReader();
      const chunks: Buffer[] = [];
      let receivedBytes = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        receivedBytes += value.byteLength;
        if (receivedBytes > maxRequestBytes) {
          await reader.cancel().catch(() => {});
          return json(
            {
              error: `Request exceeds ${entity === "products" ? "16 MB" : "1 MB"} limit. Reduce image sizes and retry.`,
            },
            413,
          );
        }
        chunks.push(Buffer.from(value));
      }
      body = JSON.parse(Buffer.concat(chunks, receivedBytes).toString("utf8"));
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    let data: { id: string } & Record<string, unknown>;

    switch (entity) {
      case "categories": {
        const v = categorySchema.parse(body);

        data = await db.garmentCategory.create({
          data: v,
        });

        break;
      }

      case "fields": {
        const v = fieldSchema.parse(body);

        const existing = await db.measurementField.findMany({
          select: { name: true },
        });

        if (
          existing.some(
            (f) => f.name.trim().toLowerCase() === v.name.toLowerCase(),
          )
        ) {
          return fail("Measurement field name already exists", 409);
        }

        data = await db.measurementField.create({
          data: {
            ...v,

            categoryId: null,
          },
        });

        break;
      }

      case "templates": {
        const v = templateSchema.parse(body);

        if (new Set(v.fieldIds).size !== v.fieldIds.length) {
          return json(
            {
              error: "Duplicate measurement fields",
            },

            400,
          );
        }

        data = await db.measurementTemplate.create({
          data: {
            name: v.name,

            categoryId: v.categoryId,

            status: v.status,

            sizes: v.sizes,

            qualityChecks: (v.qualityChecks ?? {}) as Prisma.InputJsonValue,

            fields: {
              create: v.fieldIds.map((fieldId, order) => ({
                fieldId,

                order,
              })),
            },
          },
        });

        break;
      }

      case "products": {
        const v = productSchema.parse(body);

        data = await transactionWithRetry(async (tx) => {
          // Ensure sequence exists.

          await tx.serialSetting.upsert({
            where: { id: "product" },

            update: {},

            create: { id: "product" },
          }); // Atomically reserve a sequence number.

          const sequence = await tx.serialSetting.update({
            where: { id: "product" },

            data: {
              nextNumber: { increment: 1 },
            },
          });

          const allocatedNumber = sequence.nextNumber - 1;

          const sn =
            sequence.prefix +
            String(allocatedNumber).padStart(sequence.digits, "0");

          const supplierCode = await allocateSupplierCode(tx, v.supplierId);

          return tx.product.create({
            data: {
              sn,

              code: null,

              supplierId: v.supplierId,

              supplierCode,

              itemName: v.itemName,

              categoryId: v.categoryId,

              templateId: v.templateId || null,

              pp: v.pp,

              wp: v.wp,

              fabric: v.fabric,

              notes: v.notes,
              noSizeText: v.noSizeText,

              images: {
                create: v.images.map((url, order) => ({
                  url,

                  order,
                })),
              },

              measurements: {
                create: v.measurements.map((m) => ({
                  size: m.size,

                  fieldId: m.fieldId,

                  value: m.value,
                })),
              },
            },
          });
        });

        break;
      }

      case "models": {
        const v = modelSchema.parse(body);

        data = await db.modelProfile.create({
          data: {
            ...v,

            code:
              "MDL-" +
              Date.now().toString(36).toUpperCase() +
              "-" +
              crypto.randomUUID().slice(0, 6).toUpperCase(),
          },
        });

        break;
      }

      case "assignments": {
        const v = assignmentSchema.parse(body);

        data = await transactionWithRetry(async (tx) => {
          const number =
            "ASG-" +
            Date.now() +
            "-" +
            crypto.randomUUID().slice(0, 8).toUpperCase();

          return tx.assignment.create({
            data: {
              number,

              modelId: v.modelId,

              createdById: u.id,

              sentDate: new Date(v.sentDate),

              expectedReturnDate: v.expectedReturnDate
                ? new Date(v.expectedReturnDate)
                : null,

              notes: v.notes,

              status: "ISSUED",

              items: {
                create: v.items,
              },
            },
          });
        });

        break;
      }

      case "roles": {
        const v = roleSchema.parse(body);

        if (new Set(v.permissionIds).size !== v.permissionIds.length) {
          return json(
            {
              error: "Duplicate permissions",
            },

            400,
          );
        }

        data = await db.role.create({
          data: {
            name: v.name,

            description: v.description,

            permissions: {
              create: v.permissionIds.map((permissionId) => ({
                permissionId,
              })),
            },
          },
        });

        break;
      }

      case "users": {
        const v = userSchema.parse(body);

        if (new Set(v.roleIds).size !== v.roleIds.length) {
          return json(
            {
              error: "Duplicate roles",
            },

            400,
          );
        }

        const requestedRoles = await db.role.findMany({
          where: { id: { in: v.roleIds } },

          select: { id: true, name: true },
        });

        if (requestedRoles.length !== v.roleIds.length)
          return fail("Invalid role selection", 400);

        if (requestedRoles.some((role) => role.name === "Super Admin"))
          return fail("Super Admin role cannot be assigned here", 403);

        const passwordHash = await bcrypt.hash(v.password, 12);

        data = await db.user.create({
          data: {
            name: v.name,

            email: v.email.toLowerCase(),

            passwordHash,

            status: v.status,

            roles: {
              create: v.roleIds.map((roleId) => ({
                roleId,
              })),
            },
          },

          select: {
            id: true,

            name: true,

            email: true,
          },
        });

        break;
      }

      case "settings":
        return fail("Use PATCH for settings", 405);

      default:
        return fail("Unsupported entity", 404);
    } // Audit the successful creation.

    // For strict audit consistency, move this into the

    // same DB transaction as the corresponding write.

    try {
      await audit(u.id, "CREATE", entity, data.id);
    } catch (auditError) {
      console.error("Audit logging failed:", auditError);
    }

    if (process.env.NODE_ENV === "development") {
      console.log(
        `[POST /api/${entity}] ${Math.round(performance.now() - started)}ms`,
      );
    }

    return json(data, 201);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("SUPPLIER_")) {
      return fail(error.message.replaceAll("_", " "), 400);
    }

    return errorResponse(error);
  }
}
