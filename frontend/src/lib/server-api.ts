import { cookies } from "next/headers";
export async function serverApi(path: string) {
  const cookie = cookies().toString();
  const base = process.env.BACKEND_URL || "http://localhost:4000";
  return fetch(`${base}${path}`, { headers: { cookie }, cache: "no-store" });
}
