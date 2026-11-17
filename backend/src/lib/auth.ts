import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { db } from "./db";
const secret = () => new TextEncoder().encode(process.env.JWT_SECRET || "");
export async function signSession(id: string) {
  if (secret().length < 32)
    throw new Error("JWT_SECRET must contain at least 32 characters");
  return new SignJWT({ sub: id })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secret());
}
export async function currentUser() {
  try {
    const token = (await cookies()).get("session")?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub) return null;
    const user = await db.user.findUnique({
      where: { id: payload.sub },
      include: {
        roles: {
          include: {
            role: {
              include: { permissions: { include: { permission: true } } },
            },
          },
        },
        overrides: { include: { permission: true } },
      },
    });
    return user?.status === "ACTIVE" ? user : null;
  } catch {
    return null;
  }
}
export async function can(
  user: NonNullable<Awaited<ReturnType<typeof currentUser>>>,
  key: string,
) {
  if (user.roles.some((x) => x.role.name === "Super Admin")) return true;
  const override = user.overrides.find((x) => x.permission.key === key);
  if (override) return override.allowed;
  return user.roles.some((x) =>
    x.role.permissions.some((p) => p.permission.key === key),
  );
}
/** Admins are users with the "Super Admin" or "Admin" role. */
export function isAdmin(
  user: NonNullable<Awaited<ReturnType<typeof currentUser>>>,
) {
  return user.roles.some((x) =>
    ["super admin", "admin"].includes(x.role.name.trim().toLowerCase()),
  );
}
export function publicUser(
  user: NonNullable<Awaited<ReturnType<typeof currentUser>>>,
) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    roles: user.roles.map((x) => x.role.name),
    permissions: user.roles.some((x) => x.role.name === "Super Admin")
      ? ["*"]
      : Array.from(
          new Set([
            ...user.roles.flatMap((x) =>
              x.role.permissions.map((p) => p.permission.key),
            ),
            ...user.overrides
              .filter((x) => x.allowed)
              .map((x) => x.permission.key),
          ]),
        ).filter(
          (k) =>
            !user.overrides.some((x) => x.permission.key === k && !x.allowed),
        ),
  };
}
