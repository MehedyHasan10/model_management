import { NextRequest } from "next/server";
import { GET as dispatchGET, POST as dispatchPOST } from "@/modules/legacy-entity-handlers";

// Stable API path. Shared dispatcher preserves original GET/POST behavior.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(req: NextRequest) {
  return dispatchGET(req, { params: Promise.resolve({ entity: "roles" }) });
}
export function POST(req: NextRequest) {
  return dispatchPOST(req, { params: Promise.resolve({ entity: "roles" }) });
}
