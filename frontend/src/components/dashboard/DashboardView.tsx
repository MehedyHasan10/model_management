
"use client";

import Link from "next/link";

import {
  Shirt,
  UsersRound,
  ClipboardList,
  Send,
  PackageCheck,
  Package,
  ArrowUpRight,
  Plus,
  UserPlus,
  ClipboardPlus,
  ChartNoAxesCombined,
  Activity,
  CheckCircle2,
  ArrowRight,
  Layers3,
  Ruler,
  RotateCcw,
} from "lucide-react";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";

type DashboardData = {
  products: number;
  models: number;
  assignments: number;
  sent: number;
  returned: number;
  onHand: number;
};

type Props = {
  data: DashboardData;
};

const COLORS = {
  violet: "#7C3AED",
  blue: "#2563EB",
  amber: "#D97706",
  green: "#059669",
  orange: "#EA580C",
  indigo: "#4F46E5",
};

export default function DashboardView({ data }: Props) {
  const completion =
    data.sent > 0
      ? Math.min(
          100,
          Math.max(0, (data.returned / data.sent) * 100)
        )
      : 0;

  const percentage = completion.toFixed(1);

  const cards = [
    {
      title: "Total Products",
      value: data.products,
      icon: Shirt,
      color: "text-violet-600",
      bg: "bg-violet-50",
      border: "border-violet-100",
      href: "/products",
      caption: "Product styles",
    },
    {
      title: "Total Models",
      value: data.models,
      icon: UsersRound,
      color: "text-blue-600",
      bg: "bg-blue-50",
      border: "border-blue-100",
      href: "/models",
      caption: "Registered models",
    },
    {
      title: "Assign",
      value: data.assignments,
      icon: ClipboardList,
      color: "text-amber-600",
      bg: "bg-amber-50",
      border: "border-amber-100",
      href: "/assignments",
      caption: "Total assignments",
    },
    {
      title: "Sent Pieces",
      value: data.sent,
      icon: Send,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
      border: "border-indigo-100",
      href: "/assignments",
      caption: "Issued quantities",
    },
    {
      title: "Returned Pieces",
      value: data.returned,
      icon: PackageCheck,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      border: "border-emerald-100",
      href: "/returns",
      caption: "Received quantities",
    },
    {
      title: "On Hand",
      value: data.onHand,
      icon: Package,
      color: "text-orange-600",
      bg: "bg-orange-50",
      border: "border-orange-100",
      href: "/stock",
      caption: "Outstanding pieces",
    },
  ];

  const quantityData = [
    {
      name: "Sent",
      pieces: data.sent,
      fill: COLORS.blue,
    },
    {
      name: "Returned",
      pieces: data.returned,
      fill: COLORS.green,
    },
    {
      name: "On Hand",
      pieces: data.onHand,
      fill: COLORS.orange,
    },
  ];

  const returnData = [
    {
      name: "Returned",
      value: Math.min(data.returned, data.sent),
      color: COLORS.green,
    },
    {
      name: "Outstanding",
      value: Math.max(0, data.sent - data.returned),
      color: COLORS.orange,
    },
  ];

  const hasQuantity = data.sent > 0;

  const quickActions = [
    {
      title: "Add Product",
      description: "Register a new garment style",
      href: "/products",
      icon: Shirt,
      color: "bg-violet-50 text-violet-600",
    },
    {
      title: "Add Model",
      description: "Create a model profile",
      href: "/models",
      icon: UserPlus,
      color: "bg-blue-50 text-blue-600",
    },
    {
      title: "New Assign",
      description: "Issue products to models",
      href: "/assignments",
      icon: ClipboardPlus,
      color: "bg-amber-50 text-amber-600",
    },
    {
      title: "Receive Return",
      description: "Record returned products",
      href: "/returns",
      icon: RotateCcw,
      color: "bg-emerald-50 text-emerald-600",
    },
  ];

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-violet-600">
            <Activity size={15} />
            Operations Overview
          </div>

          <h1 className="text-2xl font-bold text-slate-900">
            Dashboard
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Measurement and model assign overview
          </p>
        </div>

        <Link
          href="/stock"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-violet-200 hover:text-violet-700"
        >
          <ChartNoAxesCombined size={17} />
          Quantity Tracking
          <ArrowUpRight size={15} />
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <Link
              key={card.title}
              href={card.href}
              className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-xl border ${card.bg} ${card.color} ${card.border}`}
                >
                  <Icon size={23} strokeWidth={2} />
                </div>

                <ArrowUpRight
                  size={18}
                  className="text-slate-300 transition group-hover:text-violet-600"
                />
              </div>

              <div className="mt-5">
                <p className="text-sm font-medium text-slate-500">
                  {card.title}
                </p>

                <div className="mt-2 flex items-end gap-3">
                  <h2 className="text-3xl font-extrabold tabular-nums tracking-tight text-slate-900">
                    {card.value.toLocaleString()}
                  </h2>
                </div>

                <p className="mt-2 text-xs text-slate-400">
                  {card.caption}
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
        {/* Bar Chart */}
        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-3">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
                <ChartNoAxesCombined
                  size={19}
                  className="text-violet-600"
                />
                Quantity Overview
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Sent, returned and outstanding pieces
              </p>
            </div>

            <span className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700">
              Live Totals
            </span>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={quantityData}
                margin={{
                  top: 12,
                  right: 10,
                  left: -15,
                  bottom: 5,
                }}
                barSize={48}
              >
                <CartesianGrid
                  strokeDasharray="4 4"
                  vertical={false}
                  stroke="#E2E8F0"
                />

                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: "#64748B",
                    fontSize: 12,
                  }}
                />

                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: "#94A3B8",
                    fontSize: 12,
                  }}
                />

                <Tooltip
                  cursor={{ fill: "#F8FAFC" }}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #E2E8F0",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.05)",
                  }}
                />

                <Bar
                  dataKey="pieces"
                  name="Pieces"
                  radius={[8, 8, 0, 0]}
                >
                  {quantityData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={entry.fill}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 flex flex-wrap justify-center gap-5 border-t border-slate-100 pt-4">
            {quantityData.map((item) => (
              <div
                key={item.name}
                className="flex items-center gap-2 text-xs font-medium text-slate-600"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: item.fill }}
                />
                {item.name}
              </div>
            ))}
          </div>
        </section>

        {/* Donut Chart */}
        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <CheckCircle2
                size={19}
                className="text-emerald-600"
              />
              Return Progress
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Overall product return completion
            </p>
          </div>

          <div className="relative mt-4 h-60 w-full">
            {hasQuantity ? (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={returnData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={75}
                      outerRadius={95}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {returnData.map((entry) => (
                        <Cell
                          key={entry.name}
                          fill={entry.color}
                        />
                      ))}
                    </Pie>

                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>

                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-extrabold text-slate-900">
                    {percentage}%
                  </span>
                  <span className="mt-1 text-xs text-slate-500">
                    Returned
                  </span>
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                No issued pieces yet
              </div>
            )}
          </div>

          <div className="mt-1 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-emerald-50 p-3">
              <p className="text-xs font-medium text-emerald-700">
                Returned
              </p>
              <p className="mt-1 text-xl font-bold text-emerald-700">
                {data.returned}
              </p>
            </div>

            <div className="rounded-xl bg-orange-50 p-3">
              <p className="text-xs font-medium text-orange-700">
                On Hand
              </p>
              <p className="mt-1 text-xl font-bold text-orange-700">
                {data.onHand}
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Quick Actions */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Quick Actions
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Access frequently used operations
            </p>
          </div>

          <Layers3 size={19} className="text-slate-400" />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {quickActions.map((action) => {
            const Icon = action.icon;

            return (
              <Link
                key={action.title}
                href={action.href}
                className="group flex items-center gap-3 rounded-xl border border-slate-200 p-4 transition hover:border-violet-200 hover:bg-violet-50/30"
              >
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${action.color}`}
                >
                  <Icon size={21} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800">
                    {action.title}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {action.description}
                  </p>
                </div>

                <ArrowRight
                  size={16}
                  className="shrink-0 text-slate-300 transition group-hover:translate-x-1 group-hover:text-violet-600"
                />
              </Link>
            );
          })}
        </div>
      </section>

      {/* Workflow */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Ruler size={19} className="text-violet-600" />
          <h2 className="text-base font-bold text-slate-900">
            Model Management Workflow
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {[
            "Categories & Fields",
            "Templates",
            "Products & Images",
            "Models",
            "Assign",
            "Returns",
            "Quantity Tracking",
          ].map((step, index, array) => (
            <div
              key={step}
              className="flex items-center gap-2"
            >
              <span className="rounded-lg border border-violet-100 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700">
                {step}
              </span>

              {index < array.length - 1 && (
                <ArrowRight
                  size={15}
                  className="text-slate-300"
                />
              )}
            </div>
          ))}
        </div>

        <p className="mt-4 text-xs text-slate-500">
          Create categories and measurement templates
          before registering products and assigning them to models.
        </p>
      </section>
    </div>
  );
}
