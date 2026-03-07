import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SettingsProfileForm } from "./settings-profile-form";
import { AdminAccessForm } from "./admin-access-form";

export default async function SettingsPage() {
  const headersList = await headers();
  const adminId = headersList.get("x-admin-id")!;
  const adminRole = headersList.get("x-admin-role")!;

  const supabase = createAdminClient();

  const { data: currentAdmin } = await supabase
    .from("panel_admins")
    .select("id, username, full_name, role")
    .eq("id", adminId)
    .single();

  const { data: allAdmins } = adminRole === "admin"
    ? await supabase
        .from("panel_admins")
        .select("id, username, full_name, role")
        .order("role", { ascending: true })
        .order("username", { ascending: true })
    : { data: null };

  return (
    <div className="space-y-5 max-w-2xl">
      <PageHeader title="Settings" description="Manage your account settings." />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>Update your display name.</CardDescription>
        </CardHeader>
        <CardContent>
          <SettingsProfileForm
            adminId={adminId}
            fullName={currentAdmin?.full_name ?? null}
            username={currentAdmin?.username ?? ""}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
          <CardDescription>Account details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-sm font-medium text-neutral-900">Username</p>
              <p className="text-sm text-neutral-500 font-mono">@{currentAdmin?.username}</p>
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-sm font-medium text-neutral-900">Role</p>
              <p className="text-sm text-neutral-500 capitalize">{currentAdmin?.role ?? "—"}</p>
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-sm font-medium text-neutral-900">Account ID</p>
              <p className="text-xs text-neutral-400 font-mono">{adminId}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {adminRole === "admin" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Admin Access</CardTitle>
            <CardDescription>
              Who can sign in to this panel. Balance app users are completely
              separate and cannot access this panel.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 px-6">
            {allAdmins && allAdmins.length > 0 ? (
              <AdminAccessForm
                admins={allAdmins as { id: string; username: string; full_name: string | null; role: "admin" | "editor" }[]}
                currentAdminId={adminId}
              />
            ) : (
              <p className="py-6 text-sm text-neutral-400">No admin users found.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
