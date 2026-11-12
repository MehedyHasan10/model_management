
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

    const data = {
      products: Number(result?.products ?? 0),
      models: Number(result?.models ?? 0),
      assignments: Number(result?.assignments ?? 0),
      sent: Number(result?.sent ?? 0),
      returned: Number(result?.returned ?? 0),
      onHand: Number(result?.onHand ?? 0),
    };

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
