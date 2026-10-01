import type { Metadata } from "next";
import { privatePageRobots } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Account",
  robots: privatePageRobots,
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
