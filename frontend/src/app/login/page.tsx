"use client";

import { useState, type FormEvent } from "react";

import { useRouter } from "next/navigation";

import toast from "react-hot-toast";

import {
  ArrowRight,
  Eye,
  EyeOff,
  Fingerprint,
  Layers3,
  Loader2,
  LockKeyhole,
  Mail,
  PackageCheck,
  Scissors,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Workflow,
  CheckCircle2,
  Orbit,
} from "lucide-react";

const steps = [
  {
    Icon: Layers3,

    title: "Product catalog",

    detail: "Specifications & measurements",

    className: "mm-card-one",

    color: "text-violet-200",

    number: "01",
  },

  {
    Icon: UsersRound,

    title: "Model assign",

    detail: "Sample handoffs & tracking",

    className: "mm-card-two",

    color: "text-sky-200",

    number: "02",
  },

  {
    Icon: PackageCheck,

    title: "Inventory control",

    detail: "Returns & available stock",

    className: "mm-card-three",

    color: "text-emerald-200",

    number: "03",
  },
];

export default function Login() {
  const router = useRouter();

  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",

        headers: { "Content-Type": "application/json" },

        credentials: "same-origin",

        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok)
        throw new Error(data.error || "Unable to sign in. Please try again.");

      toast.success("Welcome back!");

      router.replace("/dashboard");

      router.refresh();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#f7f8fd] font-sans text-slate-900 lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(440px,.9fr)]">
      <style jsx global>{`
        @keyframes mm-float {
          0%,
          100% {
            transform: translate3d(0, 0, 0) rotate(-2deg);
          }

          50% {
            transform: translate3d(0, -22px, 0) rotate(2deg);
          }
        }

        @keyframes mm-float-alt {
          0%,
          100% {
            transform: translate3d(0, 0, 0) rotate(3deg);
          }

          50% {
            transform: translate3d(10px, 18px, 0) rotate(-2deg);
          }
        }

        @keyframes mm-orbit {
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes mm-orbit-reverse {
          to {
            transform: rotate(-360deg);
          }
        }

        @keyframes mm-glow {
          0%,
          100% {
            opacity: 0.4;

            transform: scale(1);
          }

          50% {
            opacity: 0.8;

            transform: scale(1.12);
          }
        }

        @keyframes mm-rise {
          from {
            opacity: 0;

            transform: translateY(28px);
          }

          to {
            opacity: 1;

            transform: translateY(0);
          }
        }

        @keyframes mm-shimmer {
          from {
            transform: translateX(-140%);
          }

          to {
            transform: translateX(180%);
          }
        }

        @keyframes mm-particle {
          0%,
          100% {
            transform: translateY(0);

            opacity: 0.2;
          }

          50% {
            transform: translateY(-30px);

            opacity: 0.9;
          }
        }

        .mm-enter {
          animation: mm-rise 0.85s cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }

        .mm-enter-late {
          animation: mm-rise 0.85s 0.18s cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }

        .mm-enter-form {
          animation: mm-rise 0.9s 0.14s cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }

        .mm-orbit {
          animation: mm-orbit 32s linear infinite;
        }

        .mm-orbit-reverse {
          animation: mm-orbit-reverse 26s linear infinite;
        }

        .mm-card-one {
          animation: mm-float 6.8s ease-in-out infinite;
        }

        .mm-card-two {
          animation: mm-float-alt 7.5s ease-in-out infinite;
        }

        .mm-card-three {
          animation: mm-float 8.3s 1.2s ease-in-out infinite;
        }

        .mm-glow {
          animation: mm-glow 9s ease-in-out infinite;
        }

        .mm-shimmer {
          animation: mm-shimmer 4.5s ease-in-out infinite;
        }

        .mm-particle {
          animation: mm-particle 5s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .mm-enter,
          .mm-enter-late,
          .mm-enter-form,
          .mm-orbit,
          .mm-orbit-reverse,
          .mm-card-one,
          .mm-card-two,
          .mm-card-three,
          .mm-glow,
          .mm-shimmer,
          .mm-particle {
            animation: none !important;
          }

          .mm-motion * {
            scroll-behavior: auto !important;

            transition: none !important;
          }
        }
      `}</style>

      {/* Motion is decorative; authentication is independent of it. */}

      <section className="mm-motion relative isolate hidden min-h-screen flex-col justify-between overflow-hidden bg-[#0c1030] px-10 py-10 text-white lg:flex xl:px-16 xl:py-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[.22]"
          style={{
            backgroundImage:
              "radial-gradient(rgba(199,190,255,.6) 1px,transparent 1px)",

            backgroundSize: "30px 30px",
          }}
        />

        <div
          aria-hidden="true"
          className="mm-glow pointer-events-none absolute -left-40 -top-44 h-[520px] w-[520px] rounded-full bg-violet-600/30 blur-[105px]"
        />

        <div
          aria-hidden="true"
          className="mm-glow pointer-events-none absolute -bottom-40 -right-28 h-[540px] w-[540px] rounded-full bg-indigo-500/25 blur-[110px]"
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-48 top-[13%] h-[510px] w-[510px]"
        >
          <div className="mm-orbit absolute inset-0 rounded-full border border-violet-300/20">
            <span className="absolute left-1/2 top-[-7px] h-3.5 w-3.5 rounded-full bg-violet-300 shadow-[0_0_25px_#a78bfa]" />
          </div>

          <div className="mm-orbit-reverse absolute inset-[65px] rounded-full border border-indigo-200/20">
            <span className="absolute bottom-7 left-2 h-2.5 w-2.5 rounded-full bg-sky-300 shadow-[0_0_22px_#7dd3fc]" />
          </div>

          <div className="mm-orbit absolute inset-[135px] rounded-full border border-white/10" />
        </div>

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          {Array.from({ length: 16 }, (_, i) => (
            <span
              key={i}
              className="mm-particle absolute h-1 w-1 rounded-full bg-violet-200"
              style={{
                left: `${(i * 37 + 13) % 95}%`,

                top: `${(i * 29 + 9) % 90}%`,

                animationDelay: `${i * -0.43}s`,

                animationDuration: `${4 + (i % 5)}s`,
              }}
            />
          ))}
        </div>

        <header className="relative z-10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/10 shadow-lg shadow-indigo-950/50 backdrop-blur-lg">
              <Scissors size={23} className="text-violet-200" />
            </div>

            <div>
              <p className="text-base font-bold tracking-tight">
                Model Management
              </p>

              <p className="text-[10px] font-semibold uppercase tracking-[.23em] text-violet-200/80">
                Operations Suite
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1.5 text-[11px] text-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Secure workspace
          </div>
        </header>

        <div className="relative z-10 my-auto w-full max-w-[690px] py-10">
          <div className="mm-enter mb-5 inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-300/10 px-4 py-2 text-xs font-medium text-violet-100">
            <Sparkles size={14} /> The smarter way to manage samples
          </div>

          <h1 className="mm-enter max-w-[650px] text-[clamp(40px,4.4vw,70px)] font-extrabold leading-[1.08] tracking-[-.045em]">
            Your workflow.
            <br />
            <span className="bg-gradient-to-r from-violet-300 via-fuchsia-200 to-sky-200 bg-clip-text text-transparent">
              Always in motion.
            </span>
          </h1>

          <p className="mm-enter-late mt-5 max-w-[500px] text-sm leading-7 text-indigo-100/70 xl:text-base">
            Bring product specifications, model assign, and sample returns
            together in one secure operations workspace.
          </p>

          <div className="mm-enter-late relative mt-10 max-w-[610px] rounded-[30px] border border-white/15 bg-white/[.065] p-5 shadow-[0_30px_90px_rgba(0,0,0,.32)] backdrop-blur-xl sm:p-7">
            <div className="mb-6 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-400/15 text-violet-200">
                  <Workflow size={22} />
                </div>

                <div>
                  <p className="text-sm font-bold">Connected operations</p>

                  <p className="mt-1 text-xs text-indigo-100/50">
                    From setup to return
                  </p>
                </div>
              </div>

              <Orbit size={21} className="text-violet-300/70" />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {steps.map(
                ({ Icon, title, detail, className, color, number }) => (
                  <div
                    key={title}
                    className={`${className} rounded-2xl border border-white/15 bg-[#202551]/85 p-4 shadow-[0_15px_35px_rgba(0,0,0,.18)]`}
                  >
                    <div className="mb-5 flex items-center justify-between">
                      <Icon size={21} className={color} />

                      <span className="text-[11px] font-semibold text-white/30">
                        {number}
                      </span>
                    </div>

                    <p className="text-xs font-bold leading-5">{title}</p>

                    <p className="mt-1 text-[11px] leading-5 text-indigo-100/55">
                      {detail}
                    </p>
                  </div>
                ),
              )}
            </div>

            <div className="mt-6 flex items-center gap-2 rounded-xl border border-emerald-300/10 bg-emerald-400/[.06] px-4 py-3 text-xs text-emerald-100/80">
              <CheckCircle2 size={16} className="text-emerald-300" /> A
              streamlined, role-based workflow
            </div>
          </div>
        </div>

        <footer className="relative z-10 flex items-center justify-between gap-4 border-t border-white/10 pt-5 text-[11px] text-indigo-100/50">
          <span>
            © {new Date().getFullYear()} Model Management
            <span className="mx-2">|</span>
            Developed by{" "}
            <a
              href="https://www.sanopsis.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-violet-200 transition-colors hover:text-white hover:underline"
            >
              SANOPSIS
            </a>
          </span>

          <span className="flex items-center gap-2">
            <ShieldCheck size={14} /> Role-based access
          </span>
        </footer>
      </section>

      <section className="relative flex min-h-screen flex-col overflow-hidden px-5 py-6 sm:px-10 sm:py-9 lg:px-12 xl:px-20">
        <div
          aria-hidden="true"
          className="mm-glow pointer-events-none absolute -right-28 -top-24 h-80 w-80 rounded-full bg-violet-200/55 blur-[85px]"
        />

        <header className="relative z-10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-700 text-white">
              <Scissors size={20} />
            </div>

            <div>
              <p className="text-sm font-bold">Model Management</p>

              <p className="text-[10px] uppercase tracking-widest text-slate-500">
                Operations Suite
              </p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2 rounded-full border border-indigo-100 bg-white/80 px-3 py-2 text-[11px] font-semibold text-indigo-700 shadow-sm">
            <ShieldCheck size={14} /> Secure sign in
          </div>
        </header>

        <div className="mm-enter-form relative z-10 mx-auto my-auto w-full max-w-[440px] py-14">
          <div className="mb-9">
            <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700 shadow-[0_12px_35px_rgba(79,70,229,.12)]">
              <Fingerprint size={27} />
            </div>

            <p className="mb-3 text-xs font-bold uppercase tracking-[.18em] text-indigo-600">
              Welcome to your workspace
            </p>

            <h2 className="text-4xl font-extrabold tracking-[-.04em] text-[#17183d] sm:text-[44px]">
              Sign in<span className="text-indigo-600">.</span>
            </h2>

            <p className="mt-3 text-sm leading-7 text-slate-500">
              Enter your account details to continue managing your operations.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label
                htmlFor="login-email"
                className="mb-2 block text-xs font-bold text-slate-700"
              >
                Email address
              </label>

              <div className="group relative">
                <Mail
                  size={18}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-indigo-600"
                />

                <input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@company.com"
                  disabled={loading}
                  className="h-[54px] w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4 text-sm text-slate-900 shadow-sm outline-none transition-all duration-300 placeholder:text-slate-400 hover:border-indigo-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 disabled:opacity-60"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="mb-2 block text-xs font-bold text-slate-700"
              >
                Password
              </label>

              <div className="group relative">
                <LockKeyhole
                  size={18}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-indigo-600"
                />

                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  disabled={loading}
                  className="h-[54px] w-full rounded-xl border border-slate-200 bg-white pl-12 pr-12 text-sm text-slate-900 shadow-sm outline-none transition-all duration-300 placeholder:text-slate-400 hover:border-indigo-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 disabled:opacity-60"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((previous) => !previous)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group relative flex h-[54px] w-full items-center justify-center gap-2.5 overflow-hidden rounded-xl bg-gradient-to-r from-[#4f46e5] to-[#6d28d9] px-5 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-indigo-500/30 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span
                aria-hidden="true"
                className="mm-shimmer pointer-events-none absolute inset-y-0 w-1/2 skew-x-[-25deg] bg-gradient-to-r from-transparent via-white/20 to-transparent"
              />

              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Signing in...
                </>
              ) : (
                <>
                  Sign in to workspace{" "}
                  <ArrowRight
                    size={18}
                    className="transition-transform group-hover:translate-x-1"
                  />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 flex items-start gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-600">
              <ShieldCheck size={19} />
            </div>

            <div>
              <p className="text-xs font-bold text-[#242450]">
                Protected access
              </p>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                Workspace access is controlled by your assigned roles and
                permissions.
              </p>
            </div>
          </div>
        </div>

        <footer className="relative z-10 text-center text-xs text-slate-400 lg:text-right">
          © {new Date().getFullYear()} Model Management
          <span className="mx-2">|</span>
          Developed by{" "}
          <a
            href="https://www.sanopsis.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-violet-600 transition-colors hover:text-violet-800 hover:underline"
          >
            SANOPSIS
          </a>
        </footer>
      </section>
    </main>
  );
}
