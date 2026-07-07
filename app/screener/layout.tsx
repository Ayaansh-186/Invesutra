import AppShell from "@/components/dashboard/AppShell";

export default function ScreenerLayout({ children }: { children: React.ReactNode }) {
  return <AppShell padded>{children}</AppShell>;
}
