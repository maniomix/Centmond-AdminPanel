import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/admin/permissions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { AdminRoleBadge } from "@/components/admin/admins/admin-role-badge";
import { AdminDetailActions } from "@/components/admin/admins/admin-detail-actions";

const statusVariant: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
  active: "success",
  suspended: "warning",
  deactivated: "destructive",
};

export default async function AdminDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("admins.view");
  const { id } = await params;
  const supabase = createAdminClient();

  const [{ data: admin }, { data: sessions }, { data: auditLogs }] = await Promise.all([
    supabase.from("admin_users").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("admin_sessions")
      .select("id, created_at, last_seen_at, expires_at, idle_expires_at, revoked_at, ip_address, device_label, user_agent")
      .eq("admin_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("admin_audit_logs")
      .select("id, action_type, category, severity, reason, created_at, target_summary")
      .or(`actor_admin_id.eq.${id},target_entity_id.eq.${id}`)
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  if (!admin) notFound();

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="h-8 w-8">
          <Link href="/admin/admins">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-neutral-900">
              {admin.display_name ?? admin.username}
            </h1>
            <AdminRoleBadge role={admin.role} />
            <Badge variant={statusVariant[admin.status] ?? "secondary"} className="capitalize">
              {admin.status}
            </Badge>
          </div>
          <p className="text-sm text-neutral-500">{admin.email ?? `@${admin.username}`}</p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Admin Controls</CardTitle>
              <CardDescription>Manage role, status and sessions for this admin.</CardDescription>
            </CardHeader>
            <CardContent>
              <AdminDetailActions
                adminId={admin.id}
                username={admin.username}
                currentRole={admin.role}
                currentStatus={admin.status}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Recent Sessions</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {!sessions?.length ? (
                <div className="px-6 py-8 text-center text-sm text-neutral-400">
                  No sessions recorded.
                </div>
              ) : (
                <div className="divide-y divide-neutral-100">
                  {sessions.map((session) => (
                    <div key={session.id} className="px-6 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium text-neutral-900">
                          {session.device_label ?? "Unknown device"}
                        </p>
                        <p className="text-xs text-neutral-500">
                          {session.revoked_at ? "Revoked" : "Active/Recent"}
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-neutral-500">
                        {session.ip_address ?? "No IP"} • {formatDate(session.last_seen_at)}
                      </p>
                      <p className="mt-1 break-all text-xs text-neutral-400">
                        {session.user_agent ?? "No user agent"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Audit Trail</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {!auditLogs?.length ? (
                <div className="px-6 py-8 text-center text-sm text-neutral-400">
                  No admin audit activity found.
                </div>
              ) : (
                <div className="divide-y divide-neutral-100">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="px-6 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium text-neutral-900">{log.action_type}</p>
                        <p className="text-xs text-neutral-500">{formatDate(log.created_at)}</p>
                      </div>
                      <p className="mt-1 text-xs text-neutral-500">
                        {log.category} • {log.severity}
                      </p>
                      {log.reason ? (
                        <p className="mt-1 text-xs text-neutral-500">{log.reason}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-neutral-500">Username</p>
                <p className="mt-0.5 text-sm text-neutral-900">@{admin.username}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500">Email</p>
                <p className="mt-0.5 text-sm text-neutral-900">{admin.email ?? "-"}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500">Last Login</p>
                <p className="mt-0.5 text-sm text-neutral-900">
                  {admin.last_login_at ? formatDate(admin.last_login_at) : "Never"}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-500">MFA enabled</p>
                <p className="mt-0.5 text-sm text-neutral-900">
                  {admin.mfa_enabled ? "Enabled" : "Not enabled"}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-500">Created</p>
                <p className="mt-0.5 text-sm text-neutral-900">{formatDate(admin.created_at)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
