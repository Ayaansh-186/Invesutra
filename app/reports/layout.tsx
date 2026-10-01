import type { Metadata } from "next";
import AppShell from "@/components/dashboard/AppShell";
import { privatePageRobots } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Portfolio Reports",
  robots: privatePageRobots,
};

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return <AppShell padded>{children}</AppShell>;
}
