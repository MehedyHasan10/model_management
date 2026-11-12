import { redirect } from "next/navigation";
import { serverApi } from "@/lib/server-api";
import Shell from "@/components/Shell";
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user;
  try {
    const res = await serverApi("/api/auth/me");
    if (!res.ok) redirect("/login");
    user = await res.json();
  } catch (e) {
    if (e instanceof Error && e.message === "NEXT_REDIRECT") throw e;
    redirect("/login");
  }
  return <Shell user={user}>{children}</Shell>;
}
