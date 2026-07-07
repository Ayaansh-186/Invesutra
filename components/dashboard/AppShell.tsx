"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Menu } from "lucide-react";
import DashboardSidebar from "./Sidebar";

export default function AppShell({
  children,
  padded = false,
}: {
  children: React.ReactNode;
  /** Some pages (screener, simulator, reports) want the shell to apply page padding; others (AI chat, portfolio) manage their own internal scroll/padding. */
  padded?: boolean;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Close the mobile menu automatically on navigation (covers back/forward
  // nav too, not just clicking a Link, which already calls onClose itself).
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div className="flex min-h-screen bg-[var(--shell-bg)]">
      {/* Mobile top bar — hidden at md+ where the sidebar is always visible */}
      <header className="fixed inset-x-0 top-0 z-20 flex items-center gap-3 border-b border-[var(--shell-border)] bg-[var(--shell-sidebar-bg)] px-4 py-3 md:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="rounded-lg p-1.5 text-[var(--shell-text)] hover:bg-[var(--shell-surface-2)]"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="text-sm font-bold text-[var(--shell-text)]">Invesutra</span>
      </header>

      <DashboardSidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      <main
        className={`h-screen w-full flex-1 pt-14 md:ml-64 md:pt-0 ${
          padded ? "overflow-y-auto p-4 md:p-8" : "overflow-hidden"
        }`}
      >
        {children}
      </main>
    </div>
  );
}
