import DashboardSidebar from "@/components/dashboard/Sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#07111f]">
      <DashboardSidebar />
      <main className="ml-64 flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
