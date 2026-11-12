import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser, can } from "@/lib/auth";
import { fail } from "@/lib/common";

const supplierPermissions = [
  { key: "suppliers.view", module: "suppliers", action: "view" },
  { key: "suppliers.create", module: "suppliers", action: "create" },
  { key: "suppliers.edit", module: "suppliers", action: "edit" },
  { key: "suppliers.delete", module: "suppliers", action: "delete" },
];

export async function GET() {
  try {
    const user = await currentUser();

    if (!user) {
      return fail("Unauthorized", 401);
    }

    if (!(await can(user, "roles.view"))) {
      return fail("Forbidden", 403);
    }

    // Ensure supplier permissions exist.
    // Requires Permission.key to be unique in Prisma schema.
    await db.$transaction(
      supplierPermissions.map((permission) =>
        db.permission.upsert({
          where: { key: permission.key },
          update: {
            module: permission.module,
            action: permission.action,
          },
          create: permission,
        }),
      ),
    );

    const permissions = await db.permission.findMany({
      orderBy: [{ module: "asc" }, { action: "asc" }],
    });

    return NextResponse.json(permissions, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Permissions API error:", error);
    return fail("Internal server error", 500);
  }
}
