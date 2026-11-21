import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { currentUser, can, isAdmin } from "@/lib/auth";
import { audit } from "@/lib/common";
import {
  assignmentJson,
  assignmentFail,
  assignmentError,
} from "@/lib/assignment-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

const schema = z.object({ done: z.boolean() }).strict();
const select = {
  id: true,
  contentDone: true,
  contentDoneAt: true,
  contentDoneBy: { select: { id: true, name: true } },
} as const;

// Marks a Model Assign row's content as done. Anyone who can edit
// assignments can mark it; only admins can undo it.
export async function PATCH(req: NextRequest, { params }: Context) {
  try {
    const user = await currentUser();
    if (!user) return assignmentFail("Unauthorized", 401);
    if (!(await can(user, "assignments.edit")))
      return assignmentFail("Forbidden", 403);
    const { id } = await params;
    const { done } = schema.parse(await req.json());
    if (!done && !isAdmin(user))
      return assignmentFail("Only admins can undo content done", 403);

    const existing = await db.assignment.findUnique({ where: { id }, select });
    if (!existing) return assignmentFail("Assign not found", 404);
    // Already in the requested state: keep who marked it and when.
    if (existing.contentDone === done) return assignmentJson(existing);

    const result = await db.assignment.update({
      where: { id },
      data: done
        ? { contentDone: true, contentDoneAt: new Date(), contentDoneById: user.id }
        : { contentDone: false, contentDoneAt: null, contentDoneById: null },
      select,
    });
    await audit(
      user.id,
      done ? "CONTENT_DONE" : "CONTENT_UNDONE",
      "assignments",
      id,
      {
        done,
        previous: existing.contentDone
          ? {
              by: existing.contentDoneBy?.name ?? null,
              at: existing.contentDoneAt,
            }
          : null,
      },
    );
    return assignmentJson(result);
  } catch (error) {
    return assignmentError(error);
  }
}
