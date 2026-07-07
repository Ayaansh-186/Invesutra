import AppShell from "@/components/dashboard/AppShell";

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return <AppShell padded>{children}</AppShell>;
}
