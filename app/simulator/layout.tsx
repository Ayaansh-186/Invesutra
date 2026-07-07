import AppShell from "@/components/dashboard/AppShell";

export default function SimulatorLayout({ children }: { children: React.ReactNode }) {
  return <AppShell padded>{children}</AppShell>;
}
