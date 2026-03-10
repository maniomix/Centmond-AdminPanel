import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { getAdminContext } from "@/lib/admin/permissions";
import { redirect } from "next/navigation";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminContext();
  if (!admin) {
    redirect("/login");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-50">
      <Sidebar
        roleKeys={admin.roleKeys}
        permissions={Array.from(admin.permissions)}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar username={admin.username} role={admin.role} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
