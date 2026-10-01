import type { Metadata } from "next";
import AppShell from "@/components/dashboard/AppShell";
import { privatePageRobots } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Portfolio Simulator",
  robots: privatePageRobots,
};

export default function SimulatorLayout({ children }: { children: React.ReactNode }) {
  return <AppShell padded>{children}</AppShell>;
}
