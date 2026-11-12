import { NextResponse } from "next/server";
import { db } from "./db";
export const fail = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });
export async function audit(
  userId: string,
  action: string,
  entity: string,
  entityId?: string,
  details?: object,
) {
  await db.auditLog.create({
    data: { userId, action, entity, entityId, details },
  });
}
export function err(e: unknown) {
  console.error(e);
  return fail(
    e instanceof Error && e.message.startsWith("Invalid")
      ? e.message
      : "Request failed; verify inputs and permissions",
    400,
  );
}
