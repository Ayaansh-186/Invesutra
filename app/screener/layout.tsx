import type { Metadata } from "next";
import AppShell from "@/components/dashboard/AppShell";
import { privatePageRobots } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Mutual Fund Screener",
  robots: privatePageRobots,
};

export default function ScreenerLayout({ children }: { children: React.ReactNode }) {
  return <AppShell padded>{children}</AppShell>;
}
