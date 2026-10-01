import type { Metadata } from "next";
import AppShell from "@/components/dashboard/AppShell";
import { privatePageRobots } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Portfolio",
  robots: privatePageRobots,
};

export default function PortfolioLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
