import type { Metadata } from "next";
import AppShell from "@/components/dashboard/AppShell";
import { privatePageRobots } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: privatePageRobots,
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
