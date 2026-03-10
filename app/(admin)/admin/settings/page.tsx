import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { SettingsProfileForm } from "./settings-profile-form";
import { ChangePasswordForm } from "./change-password-form";
import { SessionSecurityPanel } from "./session-security-panel";
import { getAdminEnv } from "@/lib/admin/env";
import { getRoleLabel } from "@/lib/admin/constants";
import { getAdminContext, hasPermission } from "@/lib/admin/permissions";
import {
  hasRecentSensitiveAuthTimestamp,
  requireAdminSession,
} from "@/lib/admin-session";
import { redirect } from "next/navigation";

interface CurrentAdminProfile {
  id: string;
  username: string;
  display_name: string | null;
  email: string | null;
  role: string;
  mfa_enabled: boolean;
  allowed_ip_cidrs: string[] | null;
}

interface ActiveAdminSession {
  id: string;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  idle_expires_at: string;
  device_label: string | null;
  ip_address: string | null;
  user_agent: string | null;
}

async function loadCurrentAdminProfile(
  adminId: string
): Promise<CurrentAdminProfile | null> {
  const supabase = createAdminClient();
  const baseProfileResponse = await supabase
    .from("admin_users")
    .select("id, username, display_name, role")
    .eq("id", adminId)
    .maybeSingle();

  if (baseProfileResponse.error || !baseProfileResponse.data) {
    return null;
  }

  const baseProfile = baseProfileResponse.data as {
    id: string;
    username: string;
    display_name: string | null;
    role: string;
  };

  const detailsResponse = await supabase
    .from("admin_users")
    .select("email, mfa_enabled, allowed_ip_cidrs")
    .eq("id", adminId)
    .maybeSingle();

  if (detailsResponse.error || !detailsResponse.data) {
    return {
      ...baseProfile,
      email: null,
      mfa_enabled: false,
      allowed_ip_cidrs: [],
    };
  }

  const details = detailsResponse.data as {
    email?: string | null;
    mfa_enabled?: boolean | null;
    allowed_ip_cidrs?: string[] | null;
  };

  return {
    ...baseProfile,
    email: details.email ?? null,
    mfa_enabled: details.mfa_enabled ?? false,
    allowed_ip_cidrs: details.allowed_ip_cidrs ?? [],
  };
}

async function loadActiveAdminSessions(
  adminId: string
): Promise<ActiveAdminSession[]> {
  const supabase = createAdminClient();
  const sessionResponse = await supabase
    .from("admin_sessions")
    .select("id, created_at, last_seen_at, expires_at")
    .eq("admin_id", adminId)
    .is("revoked_at", null)
    .order("last_seen_at", { ascending: false })
    .limit(12);

  if (sessionResponse.error || !sessionResponse.data) {
    return [];
  }

  return ((sessionResponse.data as Array<{
    id: string;
    created_at: string;
    last_seen_at: string;
    expires_at: string;
  }> | null) ?? []).map(
    (session) => ({
      ...session,
      idle_expires_at: session.expires_at,
      device_label: null,
      ip_address: null,
      user_agent: null,
    })
  );
}

export default async function SettingsPage() {
  const [session, adminContext] = await Promise.all([
    requireAdminSession(),
    getAdminContext(),
  ]);
  const adminId = session.sub;
  const sensitiveActionWindowMinutes =
    getAdminEnv().ADMIN_SENSITIVE_ACTION_WINDOW_MINUTES;

  const [currentAdmin, activeSessions] = await Promise.all([
    loadCurrentAdminProfile(adminId),
    loadActiveAdminSessions(adminId),
  ]);

  if (!currentAdmin) {
    redirect("/login");
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <PageHeader
        title="Settings"
        description="Manage your admin profile, password, active sessions, and sensitive-action confirmation."
      />

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
              <p className="text-sm font-medium text-neutral-900">Email</p>
              <p className="text-sm text-neutral-500">{currentAdmin?.email ?? "—"}</p>
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-sm font-medium text-neutral-900">Role</p>
              <p className="text-sm text-neutral-500">{getRoleLabel(currentAdmin?.role ?? "analyst")}</p>
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-sm font-medium text-neutral-900">MFA</p>
              <p className="text-sm text-neutral-500">
                {currentAdmin?.mfa_enabled ? "Enabled" : "Not enabled"}
              </p>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Session Security</CardTitle>
          <CardDescription>
            Confirm your password for sensitive admin actions and manage your active sessions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SessionSecurityPanel
            activeSessions={activeSessions}
            allowedIpCidrs={currentAdmin.allowed_ip_cidrs ?? []}
            currentSessionId={session.sessionId}
            hasRecentSensitiveAuth={hasRecentSensitiveAuthTimestamp(
              session.lastSensitiveAuthAt,
              sensitiveActionWindowMinutes
            )}
            lastSensitiveAuthAt={session.lastSensitiveAuthAt}
            sensitiveActionWindowMinutes={sensitiveActionWindowMinutes}
          />
        </CardContent>
      </Card>

      {hasPermission(adminContext, "admins.view") ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Admin Management</CardTitle>
            <CardDescription>
              Organization-wide admin access, role assignment, and admin session controls live in the Admins module.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/admin/admins">Open admin management</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
