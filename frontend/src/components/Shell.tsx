"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  LayoutDashboard,
  Layers3,
  Ruler,
  Shirt,
  Users,
  ClipboardList,
  Undo2,
  Package,
  ShieldCheck,
  UserCog,
  Settings2,
  ScrollText,
  LogOut,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  Scissors,
  Loader2,
  Truck,
} from "lucide-react";

// ============================================
// ACCOUNT TYPES & CONTEXT
// ============================================

type Account = {
  id: string;
  name: string;
  email: string;
  roles: string[];
  permissions: string[];
};

const AccountContext = createContext<Account | null>(null);

export function useAccount() {
  const account = useContext(AccountContext);

  if (!account) {
    throw new Error("useAccount must be used inside Shell");
  }

  return account;
}

// ============================================
// NAVIGATION
// ============================================

const navigation = [
  {
    title: "Workspace",
    items: [
      {
        slug: "dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    title: "Management",
    items: [
      {
        slug: "suppliers",
        label: "Suppliers",
        icon: Truck,
      },
      {
        slug: "categories",
        label: "Categories",
        icon: Layers3,
      },
      {
        slug: "fields",
        label: "Measurement Fields",
        icon: Ruler,
      },
      {
        slug: "templates",
        label: "Templates",
        icon: ClipboardList,
      },
      {
        slug: "products",
        label: "Products / Styles",
        icon: Shirt,
      },
      {
        slug: "models",
        label: "Models",
        icon: Users,
      },
    ],
  },
  {
    title: "Operations",
    items: [
      {
        slug: "assignments",
        label: "Assign",
        icon: ClipboardList,
      },
      {
        slug: "returns",
        label: "Returns",
        icon: Undo2,
      },
      {
        slug: "stock",
        label: "Quantity Tracking",
        icon: Package,
      },
    ],
  },
  {
    title: "Administration",
    items: [
      {
        slug: "users",
        label: "Users",
        icon: UserCog,
      },
      {
        slug: "roles",
        label: "Roles & Permissions",
        icon: ShieldCheck,
      },
      {
        slug: "settings",
        label: "Code Settings",
        icon: Settings2,
      },
      {
        slug: "audit",
        label: "Audit Logs",
        icon: ScrollText,
      },
    ],
  },
];

// ============================================
// MAIN SHELL
// ============================================

export default function Shell({
  user,
  children,
}: {
  user: Account;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // ==========================================
  // PERMISSIONS
  // ==========================================

  const allowed = (slug: string) =>
    user.permissions.includes("*") || user.permissions.includes(`${slug}.view`);

  const active = (slug: string) =>
    pathname === `/${slug}` || pathname.startsWith(`/${slug}/`);

  const groups = navigation
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => allowed(item.slug)),
    }))
    .filter((group) => group.items.length > 0);

  const currentPage =
    navigation.flatMap((group) => group.items).find((item) => active(item.slug))
      ?.label ?? "Workspace";

  const initials =
    user.name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word.charAt(0))
      .join("")
      .toUpperCase() || "U";

  // ==========================================
  // EFFECTS
  // ==========================================

  useEffect(() => {
    setMobileOpen(false);
    setProfileOpen(false);
  }, [pathname]);

  // Lock body scrolling when mobile sidebar opens
  useEffect(() => {
    if (!mobileOpen) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  // Escape key closes mobile sidebar / dropdown
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileOpen(false);
        setProfileOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  // ==========================================
  // LOGOUT
  // ==========================================

  async function logout() {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });

      if (!response.ok) {
        throw new Error("Logout failed");
      }

      setMobileOpen(false);
      setProfileOpen(false);

      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error(error);
      alert("Logout failed. Please try again.");
    } finally {
      setLoggingOut(false);
    }
  }

  // ==========================================
  // UI
  // ==========================================

  return (
    <AccountContext.Provider value={user}>
      <div className="min-h-screen bg-[#F7F5FC] text-[#29213D]">
        {/* =====================================
            MOBILE OVERLAY
        ===================================== */}

        {mobileOpen && (
          <button
            type="button"
            aria-label="Close sidebar"
            onClick={() => setMobileOpen(false)}
            className="
              fixed inset-0 z-40
              bg-[#100A20]/65
              backdrop-blur-[2px]
              lg:hidden
            "
          />
        )}

        {/* =====================================
            SIDEBAR
        ===================================== */}

        <aside
          className={`
            fixed inset-y-0 left-0 z-50
            flex w-[268px] flex-col
            border-r border-[#35294F]
            bg-[#21183D]
            shadow-[4px_0_24px_rgba(33,24,61,0.12)]
            transition-[width,transform]
            duration-300 ease-in-out

            ${mobileOpen ? "translate-x-0" : "-translate-x-full"}

            lg:translate-x-0

            ${collapsed ? "lg:w-[76px]" : "lg:w-[268px]"}
          `}
        >
          {/* =================================
              BRAND
          ================================= */}

          <div
            className={`
              flex h-[76px] shrink-0 items-center
              border-b border-white/10 px-5

              ${collapsed ? "lg:justify-center lg:px-2" : ""}
            `}
          >
            <div
              className="
                flex h-10 w-10 shrink-0
                items-center justify-center
                rounded-[13px]
                bg-[#7C3AED]
                text-white
                shadow-[0_5px_15px_rgba(124,58,237,0.35)]
              "
            >
              <Scissors size={21} strokeWidth={2.2} />
            </div>

            <div
              className={`
                ml-3 min-w-0
                ${collapsed ? "lg:hidden" : ""}
              `}
            >
              <div
                className="
                  truncate text-[14px]
                  font-extrabold tracking-tight
                  text-white
                "
              >
                Model Management
              </div>

              <div
                className="
                  mt-0.5 text-[10px]
                  font-semibold tracking-[0.09em]
                  text-[#B9A8D8]
                "
              >
                ADMIN WORKSPACE
              </div>
            </div>

            {/* MOBILE CLOSE */}

            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
              className="
                ml-auto rounded-lg p-2
                text-[#C4B5D9]
                transition-colors
                hover:bg-white/10
                hover:text-white
                lg:hidden
              "
            >
              <X size={19} />
            </button>
          </div>

          {/* =================================
              SIDEBAR NAVIGATION
          ================================= */}

          <nav
            className="
              min-h-0 flex-1
              overflow-y-auto overflow-x-hidden
              px-3 py-5
              [scrollbar-width:none]
              [&::-webkit-scrollbar]:hidden
            "
          >
            <div className="space-y-6">
              {groups.map((group) => (
                <section key={group.title}>
                  {/* GROUP TITLE */}

                  <div
                    className={`
                      mb-2 px-3
                      text-[10px] font-bold
                      uppercase tracking-[0.13em]
                      text-[#9485B2]

                      ${collapsed ? "lg:hidden" : ""}
                    `}
                  >
                    {group.title}
                  </div>

                  {/* COLLAPSED DIVIDER */}

                  {collapsed && (
                    <div
                      className="
                        mx-auto mb-3 hidden
                        h-px w-7
                        bg-white/15
                        lg:block
                      "
                    />
                  )}

                  {/* MENU ITEMS */}

                  <div className="space-y-1">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const selected = active(item.slug);

                      return (
                        <Link
                          key={item.slug}
                          href={`/${item.slug}`}
                          title={item.label}
                          aria-current={selected ? "page" : undefined}
                          onClick={() => setMobileOpen(false)}
                          className={`
                            relative flex min-h-[43px]
                            items-center gap-3
                            rounded-[10px] px-3
                            text-[12.5px] font-semibold
                            transition-all duration-200

                            ${
                              selected
                                ? "bg-[#7C3AED] text-white shadow-[0_4px_12px_rgba(124,58,237,0.25)]"
                                : "text-[#B9AED0] hover:bg-white/10 hover:text-white"
                            }

                            ${collapsed ? "lg:justify-center lg:px-0" : ""}
                          `}
                        >
                          {/* ACTIVE INDICATOR */}

                          {selected && (
                            <span
                              className="
                                absolute bottom-[9px]
                                left-0 top-[9px]
                                w-[3px]
                                rounded-r-full
                                bg-[#DDD6FE]
                              "
                            />
                          )}

                          <Icon
                            size={18}
                            strokeWidth={selected ? 2.3 : 1.8}
                            className="shrink-0"
                          />

                          <span
                            className={`
                              min-w-0 flex-1 truncate

                              ${collapsed ? "lg:hidden" : ""}
                            `}
                          >
                            {item.label}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </nav>

          {/* =================================
              SIDEBAR FOOTER
          ================================= */}

          <div
            className="
              shrink-0
              border-t border-white/10
              p-3
            "
          >
            {/* USER CARD */}

            <div
              className={`
                flex items-center gap-3
                rounded-xl
                bg-[#302449]
                p-2.5

                ${collapsed ? "lg:justify-center lg:p-1.5" : ""}
              `}
            >
              <div
                className="
                  flex h-9 w-9 shrink-0
                  items-center justify-center
                  rounded-[10px]
                  bg-[#7C3AED]
                  text-xs font-bold text-white
                "
              >
                {initials}
              </div>

              <div
                className={`
                  min-w-0 flex-1

                  ${collapsed ? "lg:hidden" : ""}
                `}
              >
                <div
                  className="
                    truncate text-[12px]
                    font-bold text-white
                  "
                >
                  {user.name}
                </div>

                <div
                  className="
                    truncate text-[10px]
                    text-[#B9A8D8]
                  "
                >
                  {user.roles.join(", ") || "User"}
                </div>
              </div>
            </div>

            {/* LOGOUT */}

            <button
              type="button"
              onClick={logout}
              disabled={loggingOut}
              title="Sign out"
              className={`
                mt-2 flex h-10 w-full
                items-center gap-3
                rounded-[10px] px-3
                text-[12px] font-semibold
                text-[#FDA4AF]
                transition-colors
                hover:bg-[#4C284A]
                hover:text-[#FFE4E6]
                disabled:cursor-not-allowed
                disabled:opacity-50

                ${collapsed ? "lg:justify-center lg:px-0" : ""}
              `}
            >
              {loggingOut ? (
                <Loader2 size={18} className="shrink-0 animate-spin" />
              ) : (
                <LogOut size={18} className="shrink-0" />
              )}

              <span className={collapsed ? "lg:hidden" : ""}>
                {loggingOut ? "Signing out..." : "Sign Out"}
              </span>
            </button>
          </div>
        </aside>

        {/* =====================================
            MAIN CONTENT WRAPPER
        ===================================== */}

        <div
          className={`
            min-h-screen min-w-0
            transition-[margin]
            duration-300

            ${collapsed ? "lg:ml-[76px]" : "lg:ml-[268px]"}
          `}
        >
          {/* =================================
              HEADER
          ================================= */}

          <header
            className="
              sticky top-0 z-30
              flex h-[76px]
              items-center justify-between
              gap-3
              border-b border-[#E9E3F3]
              bg-white
              px-4 sm:px-6 lg:px-7
            "
          >
            {/* HEADER LEFT */}

            <div
              className="
                flex min-w-0
                items-center gap-3
              "
            >
              {/* MOBILE HAMBURGER */}

              <button
                type="button"
                aria-label="Open sidebar"
                aria-expanded={mobileOpen}
                onClick={() => setMobileOpen(true)}
                className="
                  flex h-10 w-10
                  shrink-0 items-center
                  justify-center
                  rounded-[10px]
                  border border-[#E9E3F3]
                  text-[#6D5C8F]
                  transition-colors
                  hover:bg-[#F3EEFF]
                  hover:text-[#7C3AED]
                  lg:hidden
                "
              >
                <Menu size={21} />
              </button>

              {/* DESKTOP COLLAPSE */}

              <button
                type="button"
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                onClick={() => setCollapsed((value) => !value)}
                className="
                  hidden h-9 w-9
                  shrink-0 items-center
                  justify-center
                  rounded-[9px]
                  text-[#9A8BAF]
                  transition-colors
                  hover:bg-[#F3EEFF]
                  hover:text-[#7C3AED]
                  lg:flex
                "
              >
                {collapsed ? (
                  <PanelLeftOpen size={19} />
                ) : (
                  <PanelLeftClose size={19} />
                )}
              </button>

              {/* SINGLE PAGE TITLE */}

              <h1
                className="
                  truncate
                  text-[18px] font-bold
                  tracking-tight
                  text-[#21183D]
                  sm:text-[20px]
                "
              >
                {currentPage}
              </h1>
            </div>

            {/* =================================
                HEADER RIGHT - PROFILE
            ================================= */}

            <div className="relative">
              <button
                type="button"
                aria-label="Account menu"
                aria-expanded={profileOpen}
                onClick={() => setProfileOpen((value) => !value)}
                className="
                  flex items-center gap-2.5
                  rounded-xl px-1.5 py-1.5
                  transition-colors
                  hover:bg-[#F7F5FC]
                  sm:px-2
                "
              >
                {/* AVATAR */}

                <div
                  className="
                    flex h-9 w-9
                    shrink-0 items-center
                    justify-center
                    rounded-[10px]
                    bg-[#7C3AED]
                    text-xs font-bold
                    text-white
                  "
                >
                  {initials}
                </div>

                {/* PROFILE DETAILS */}

                <div
                  className="
                    hidden max-w-[170px]
                    text-left sm:block
                  "
                >
                  <div
                    className="
                      truncate text-[12px]
                      font-bold
                      text-[#21183D]
                    "
                  >
                    {user.name}
                  </div>

                  <div
                    className="
                      truncate text-[10px]
                      text-[#9A8BAF]
                    "
                  >
                    {user.roles.join(", ") || "User"}
                  </div>
                </div>

                <ChevronDown
                  size={14}
                  className={`
                    hidden text-[#9A8BAF]
                    transition-transform
                    sm:block

                    ${profileOpen ? "rotate-180" : ""}
                  `}
                />
              </button>

              {/* =================================
                  PROFILE DROPDOWN
              ================================= */}

              {profileOpen && (
                <>
                  {/* CLICK OUTSIDE */}

                  <button
                    type="button"
                    aria-label="Close account menu"
                    onClick={() => setProfileOpen(false)}
                    className="
                      fixed inset-0 z-40
                      cursor-default
                    "
                  />

                  {/* DROPDOWN */}

                  <div
                    className="
                      absolute right-0 top-full
                      z-50 mt-3 w-[250px]
                      rounded-2xl
                      border border-[#E9E3F3]
                      bg-white p-2
                      shadow-[0_15px_45px_rgba(33,24,61,0.15)]
                    "
                  >
                    <div
                      className="
                        border-b border-[#F0EBF7]
                        px-3 py-3
                      "
                    >
                      <div
                        className="
                          truncate text-sm
                          font-bold
                          text-[#21183D]
                        "
                      >
                        {user.name}
                      </div>

                      <div
                        className="
                          mt-1 truncate
                          text-xs
                          text-[#87799E]
                        "
                      >
                        {user.email}
                      </div>

                      <div
                        className="
                          mt-2 text-[11px]
                          font-semibold
                          text-[#7C3AED]
                        "
                      >
                        {user.roles.join(", ")}
                      </div>
                    </div>

                    {/* DROPDOWN LOGOUT */}

                    <button
                      type="button"
                      onClick={logout}
                      disabled={loggingOut}
                      className="
                        mt-1 flex w-full
                        items-center gap-2.5
                        rounded-xl
                        px-3 py-2.5
                        text-left text-sm
                        font-medium
                        text-rose-600
                        transition-colors
                        hover:bg-rose-50
                        disabled:opacity-50
                      "
                    >
                      <LogOut size={16} />

                      {loggingOut ? "Signing out..." : "Sign Out"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </header>

          {/* =================================
              PAGE CONTENT
          ================================= */}

          <main
            className="
              mx-auto w-full
              max-w-[1800px]
              p-4 sm:p-5 lg:p-6
            "
          >
            {children}
          </main>

          {/* =================================
              FOOTER
          ================================= */}
        </div>
      </div>
    </AccountContext.Provider>
  );
}
