import DashboardSidebar from "@/components/dashboard/Sidebar";

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[var(--shell-bg)]">
      <DashboardSidebar />
      <main className="flex-1 ml-64 p-8">{children}</main>
    </div>
  );
}
