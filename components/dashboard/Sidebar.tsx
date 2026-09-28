"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  Search, BarChart2,
  FileText, LogOut, ChevronRight, User, MessageSquare, Wallet, X,
} from "lucide-react";
import { useAuth } from "@/lib/hooks/useAuth";
import ThemeToggle from "@/components/shared/ThemeToggle";

const navItems = [
  { icon: Wallet, label: "Portfolio", href: "/portfolio" },
  { icon: MessageSquare, label: "Ask AI", href: "/dashboard" },
  { icon: Search, label: "Screener", href: "/screener" },
  { icon: BarChart2, label: "Simulator", href: "/simulator" },
  { icon: FileText, label: "Reports", href: "/reports" },
];

export default function DashboardSidebar({
  mobileOpen = false,
  onClose,
}: {
  /** Controlled from AppShell — whether the mobile off-canvas sidebar is open. Ignored at md+ where the sidebar is always visible. */
  mobileOpen?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, signOut } = useAuth();

  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Demo User";
  const email = user?.email || "Not signed in";
  const initial = displayName.charAt(0).toUpperCase();

  async function handleSignOut() {
    await signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <>
      {/* Backdrop — mobile only, closes the sidebar on tap outside it */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/50 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-40 flex h-full w-64 flex-col border-r border-[var(--shell-border)] bg-[var(--shell-sidebar-bg)] transition-transform duration-200 md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between border-b border-[var(--shell-border)] p-5">
          <Link href="/" className="group flex items-center gap-2.5" onClick={onClose}>
            <Image src="/invesutra-mark.png" alt="" width={36} height={36} className="h-9 w-9 object-contain" />
            <span className="text-sm font-bold text-[var(--shell-text)]">Invesutra</span>
          </Link>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--shell-text-faint)] hover:bg-[var(--shell-surface-2)] md:hidden"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {navItems.map((item) => {
            const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-[var(--shell-surface-2)] text-[var(--shell-text)]"
                    : "text-[var(--shell-text-muted)] hover:bg-[var(--shell-surface-2)] hover:text-[var(--shell-text)]"
                }`}
              >
                <item.icon className="h-4 w-4" strokeWidth={active ? 2 : 1.5} />
                {item.label}
                {active && <ChevronRight className="ml-auto h-3 w-3 opacity-60" />}
              </Link>
            );
          })}
        </nav>

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
    </>
  );
}
