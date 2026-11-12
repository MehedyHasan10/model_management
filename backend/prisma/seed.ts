import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
const db = new PrismaClient();
const modules = [
  "dashboard",
  "categories",
  "fields",
  "templates",
  "products",
  "models",
  "assignments",
  "returns",
  "stock",
  "users",
  "roles",
  "settings",
  "audit",
];
const actions = [
  "view",
  "create",
  "edit",
  "delete",
  "assign",
  "receive",
  "export",
];
async function main() {
  for (const module of modules)
    for (const action of actions)
      await db.permission.upsert({
        where: { key: `${module}.${action}` },
        update: {},
        create: { key: `${module}.${action}`, module, action },
      });
  const role = await db.role.upsert({
    where: { name: "Super Admin" },
    update: { system: true },
    create: {
      name: "Super Admin",
      description: "Full system access",
      system: true,
    },
  });
  const all = await db.permission.findMany();
  for (const p of all)
    await db.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId: p.id } },
      update: {},
      create: { roleId: role.id, permissionId: p.id },
    });
  const email = (process.env.ADMIN_EMAIL || "admin@example.com").toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!password || password.length < 8)
    throw Error("Set ADMIN_PASSWORD (8+ chars) in .env");
  const existing = await db.user.findUnique({ where: { email } });
  if (!existing) {
    const user = await db.user.create({
      data: {
        name: "Super Admin",
        email,
        passwordHash: await bcrypt.hash(password, 12),
      },
    });
    await db.userRole.create({ data: { userId: user.id, roleId: role.id } });
  }
  await db.serialSetting.upsert({
    where: { id: "product" },
    update: {},
    create: { id: "product" },
  });
  for (const [name, fields] of Object.entries({
    Pant: ["Pant Waist", "Pant Length", "Thigh", "Hip", "Leg Opening"],
    "Shirt / Tops": ["Bust", "Sleeve", "Length", "Flare"],
    Jacket: ["Bust", "Sleeve", "Length", "Shoulder"],
    Dress: ["Bust", "Length", "Flare", "Hip"],
  })) {
    const cat = await db.garmentCategory.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    for (const [order, field] of fields.entries()) {
      const found = await db.measurementField.findFirst({
        where: { name: field, categoryId: cat.id },
      });
      if (!found)
        await db.measurementField.create({
          data: { name: field, categoryId: cat.id, order },
        });
    }
  }
  console.log("Seed complete; admin:", email);
}
main().finally(() => db.$disconnect());
