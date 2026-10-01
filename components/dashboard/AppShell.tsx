"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Menu } from "lucide-react";
import DashboardSidebar from "./Sidebar";
import { ToastProvider } from "@/components/shared/ToastProvider";

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
    <ToastProvider>
      <div className="flex min-h-screen bg-[var(--shell-bg)]">
        {/* Mobile top bar — hidden at md+ where the sidebar is always visible */}
        <header className="fixed inset-x-0 top-0 z-20 flex h-14 items-center gap-3 border-b border-[var(--shell-border)] bg-[var(--shell-sidebar-bg)] px-4 md:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="app-icon-button"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-bold text-[var(--shell-text)]">Invesutra</span>
        </header>

        <DashboardSidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

        <main
          className={`h-dvh min-w-0 w-full flex-1 md:ml-64 ${
            padded ? "overflow-y-auto px-4 pb-4 pt-[4.5rem] md:p-8" : "overflow-hidden pt-14 md:pt-0"
          }`}
        >
          {children}
        </main>
      </div>
    </ToastProvider>
  );
}
