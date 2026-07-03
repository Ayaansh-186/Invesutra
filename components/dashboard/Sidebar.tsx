"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  TrendingUp, Search, BarChart2,
  FileText, Sparkles, Bell, LogOut, ChevronRight, User, MessageSquare,
} from "lucide-react";
import { useAuth } from "@/lib/hooks/useAuth";
import ThemeToggle from "@/components/shared/ThemeToggle";

const navItems = [
  { icon: MessageSquare, label: "Sutra AI", href: "/dashboard", badge: "AI" },
  { icon: Search, label: "Screener", href: "/screener" },
  { icon: BarChart2, label: "Simulator", href: "/simulator" },
  { icon: FileText, label: "Reports", href: "/reports" },
];

export default function DashboardSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const [plan, setPlan] = useState<"free" | "pro" | "premium">("free");

  useEffect(() => {
    fetch("/api/user/me")
      .then((r) => r.json())
      .then((data) => { if (data.plan) setPlan(data.plan); })
      .catch(() => {});
  }, [user]);

  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Demo User";
  const email = user?.email || "Not signed in";
  const initial = displayName.charAt(0).toUpperCase();

  async function handleSignOut() {
    await signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-full w-64 flex-col border-r border-[var(--shell-border)] bg-[var(--shell-sidebar-bg)]">
      {/* Logo */}
      <div className="border-b border-[var(--shell-border)] p-5">
        <Link href="/" className="group flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-emerald-400 shadow-lg shadow-cyan-500/20 transition-shadow group-hover:shadow-cyan-500/30">
            <TrendingUp className="h-4 w-4 text-slate-950" strokeWidth={2.5} />
          </div>
          <div>
            <span className="text-sm font-bold text-[var(--shell-text)]">Invesutra</span>
            {plan !== "free" && (
              <span className="ml-1.5 rounded border border-cyan-400/30 bg-cyan-400/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-300">
                {plan}
              </span>
            )}
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 p-3">
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                active
                  ? "bg-gradient-to-r from-cyan-400/20 to-emerald-400/10 text-[var(--shell-text)] border border-cyan-400/20"
                  : "text-[var(--shell-text-muted)] hover:bg-[var(--shell-surface-2)] hover:text-[var(--shell-text)]"
              }`}
            >
              <item.icon className="h-4 w-4" strokeWidth={active ? 2 : 1.5} />
              {item.label}
              {"badge" in item && item.badge && (
                <span className="rounded-full bg-cyan-400/20 px-1.5 py-0.5 text-[9px] font-bold text-cyan-300">
                  {item.badge}
                </span>
              )}
              {active && <ChevronRight className="ml-auto h-3 w-3 opacity-60" />}
            </Link>
          );
        })}
      </nav>

      {/* Upgrade card */}
      {plan === "free" && (
        <div className="p-3">
          <div className="rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-400/10 to-emerald-400/5 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
              <span className="text-xs font-semibold text-cyan-300">Free Plan</span>
            </div>
            <p className="mb-3 text-xs leading-relaxed text-[var(--shell-text-muted)]">
              Upgrade for unlimited AI conversations, reports, and advanced analysis.
            </p>
            <Link
              href="/pricing"
              className="block rounded-lg bg-cyan-400 py-2 text-center text-xs font-semibold text-slate-950 transition hover:bg-cyan-300"
            >
              Upgrade to Pro →
            </Link>
          </div>
        </div>
      )}

      {/* User section */}
      <div className="border-t border-[var(--shell-border)] p-3">
        <div className="mb-2 flex items-center justify-between px-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--shell-text-faint)]">
            Appearance
          </span>
          <ThemeToggle />
        </div>
        <div className="flex items-center gap-2.5 rounded-xl px-2 py-2 transition-colors hover:bg-[var(--shell-surface-2)]">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-emerald-400 text-xs font-bold text-slate-950">
            {loading ? <User className="h-3.5 w-3.5" /> : initial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-[var(--shell-text)]">{loading ? "Loading..." : displayName}</p>
            <p className="truncate text-xs text-[var(--shell-text-faint)]">{loading ? "" : email}</p>
          </div>
          <div className="flex shrink-0 gap-0.5">
            <button className="rounded-lg p-1.5 text-[var(--shell-text-faint)] transition-colors hover:bg-[var(--shell-surface-2)] hover:text-[var(--shell-text-muted)]" title="Notifications">
              <Bell className="h-3.5 w-3.5" />
            </button>
            {user ? (
              <button onClick={handleSignOut} className="rounded-lg p-1.5 text-[var(--shell-text-faint)] transition-colors hover:bg-[var(--shell-surface-2)] hover:text-[var(--shell-text-muted)]" title="Sign out">
                <LogOut className="h-3.5 w-3.5" />
              </button>
            ) : (
              <Link href="/auth/login" className="rounded-lg p-1.5 text-[var(--shell-text-faint)] transition-colors hover:bg-[var(--shell-surface-2)] hover:text-[var(--shell-text-muted)]" title="Sign in">
                <LogOut className="h-3.5 w-3.5 rotate-180" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
