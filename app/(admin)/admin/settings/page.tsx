import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SettingsProfileForm } from "./settings-profile-form";
import { AdminAccessForm } from "./admin-access-form";
import { ChangePasswordForm } from "./change-password-form";
import { requireAdminSession } from "@/lib/admin-session";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
  const session = await requireAdminSession();
  const adminId = session.sub;
  const adminRole = session.role;

  const supabase = createAdminClient();

  const { data: currentAdmin } = await supabase
    .from("admin_users")
    .select("id, username, display_name, role")
    .eq("id", adminId)
    .single();

  if (!currentAdmin) {
    redirect("/login");
  }

  const { data: allAdmins } = adminRole === "super_admin"
    ? await supabase
        .from("admin_users")
        .select("id, username, display_name, role")
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
            displayName={currentAdmin?.display_name ?? null}
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
              <p className="text-sm text-neutral-500 capitalize">{currentAdmin?.role?.replace("_", " ") ?? "—"}</p>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Change Password</CardTitle>
          <CardDescription>Update your login password.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>

      {adminRole === "super_admin" && (
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
                admins={allAdmins as {
                  id: string;
                  username: string;
                  display_name: string | null;
                  role:
                    | "super_admin"
                    | "operations_admin"
                    | "support_admin"
                    | "finance_admin"
                    | "moderation_admin"
                    | "analyst";
                }[]}
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
