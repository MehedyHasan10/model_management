
import { serverApi } from "@/lib/server-api";
import DashboardView from "@/components/dashboard/DashboardView";

export default async function Dashboard() {
  try {
    const response = await serverApi("/api/dashboard");

    if (!response.ok) {
      return (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <h2 className="font-semibold text-red-700">
            Dashboard unavailable
          </h2>
          <p className="mt-2 text-sm text-red-600">
            Check backend connection and permissions.
          </p>
        </div>
      );
    }

    const result = await response.json();

    const keys = [
      "products",
      "models",
      "assignments",
      "sent",
      "returned",
      "onHand",
      "suppliers",
      "activeSuppliers",
      "categories",
      "activeTemplates",
      "activeModels",
      "productsThisMonth",
      "contentDone",
      "contentPending",
      "openAssignments",
      "overdueAssignments",
      "dontWear",
      "damagedLost",
    ] as const;
    const data = Object.fromEntries(
      keys.map((key) => [key, Number(result?.[key] ?? 0)]),
    ) as Record<(typeof keys)[number], number>;

    return <DashboardView data={data} />;
  } catch (error) {
    console.error("Dashboard loading error:", error);

    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
        Unable to load dashboard. Check backend connection.
      </div>
    );
  }
}
