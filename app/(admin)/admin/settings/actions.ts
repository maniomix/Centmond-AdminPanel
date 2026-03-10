"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getAdminSession,
  markCurrentAdminSessionSensitiveAuth,
  requireAdminSession,
  revokeAdminSession,
} from "@/lib/admin-session";
import { auditWithCurrentAdmin } from "@/lib/admin/audit";
import { requirePermission } from "@/lib/admin/permissions";
import { assertSameOriginMutation } from "@/lib/admin/security";

export async function updateProfileAction(
  adminId: string,
  displayName: string
): Promise<{ error?: string }> {
  await assertSameOriginMutation();
  const session = await getAdminSession();
  if (!session) return { error: "Unauthorized" };
  if (session.sub !== adminId) {
    await requirePermission("admins.edit");
  }
  if (session.sub !== adminId && session.role !== "super_admin") {
    return { error: "Permission denied" };
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("admin_users")
    .update({ display_name: displayName, updated_at: new Date().toISOString() })
    .eq("id", adminId);

  if (error) return { error: "Failed to update profile" };
  await auditWithCurrentAdmin({
    actionType: "admin.profile_updated",
    category: "admin",
    targetEntityType: "admin_user",
    targetEntityId: adminId,
    afterState: { display_name: displayName },
  });
  revalidatePath("/admin/settings");
  return {};
}

export async function confirmSensitiveAccessAction(
  password: string
): Promise<{ error?: string }> {
  await assertSameOriginMutation();
  const session = await requireAdminSession();
  if (!password.trim()) {
    return { error: "Password is required" };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("admin_login", {
    p_username: session.username,
    p_password: password,
  });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    await auditWithCurrentAdmin({
      actionType: "admin.reauth.failed",
      category: "security",
      severity: "warning",
      targetEntityType: "admin_session",
      targetEntityId: session.sessionId,
      targetSummary: session.username,
    });
    return { error: "Current password is incorrect" };
  }
  const result = data as {
    success?: boolean;
    admin?: { id?: string; username?: string };
  };
  if (!result.success || result.admin?.id !== session.sub) {
    await auditWithCurrentAdmin({
      actionType: "admin.reauth.failed",
      category: "security",
      severity: "warning",
      targetEntityType: "admin_session",
      targetEntityId: session.sessionId,
      targetSummary: session.username,
    });
    return { error: "Current password is incorrect" };
  }

  await markCurrentAdminSessionSensitiveAuth();
  await auditWithCurrentAdmin(
    {
      actionType: "admin.reauth.confirmed",
      category: "security",
      targetEntityType: "admin_session",
      targetEntityId: session.sessionId,
      targetSummary: session.username,
    },
    { required: true }
  );
  revalidatePath("/admin/settings");
  return {};
}

export async function revokeManagedSessionAction(
  sessionId: string
): Promise<{ error?: string }> {
  await assertSameOriginMutation();
  const session = await getAdminSession();
  if (!session) return { error: "Unauthorized" };
  if (sessionId === session.sessionId) {
    return { error: "Use the account menu to sign out the current session" };
  }

  const supabase = createAdminClient();
  const { data: targetSession } = await supabase
    .from("admin_sessions")
    .select("id, admin_id, device_label, ip_address")
    .eq("id", sessionId)
    .maybeSingle();
  if (!targetSession || targetSession.admin_id !== session.sub) {
    return { error: "Session not found" };
  }

  await revokeAdminSession(sessionId, "self_service_session_revoke");
  await auditWithCurrentAdmin(
    {
      actionType: "admin.session_revoked.self_service",
      category: "security",
      severity: "warning",
      targetEntityType: "admin_session",
      targetEntityId: sessionId,
      targetSummary: targetSession.device_label ?? targetSession.ip_address ?? sessionId,
    },
    { required: true }
  );
  revalidatePath("/admin/settings");
  return {};
}

export async function changePasswordAction(
  oldPassword: string,
  newPassword: string
): Promise<{ error?: string }> {
  await assertSameOriginMutation();
  const session = await getAdminSession();
  if (!session) return { error: "Unauthorized" };

  const supabase = createAdminClient();
  const { data: changeData, error: changeError } = await supabase.rpc("admin_change_password", {
    p_admin_id: session.sub,
    p_old_password: oldPassword,
    p_new_password: newPassword,
  });

  if (changeError || !changeData) return { error: "Failed to change password" };
  const changeResult = changeData as { success?: boolean; error?: string };
  if (!changeResult.success) return { error: changeResult.error ?? "Failed to change password" };

  await auditWithCurrentAdmin(
    {
      actionType: "admin.password_changed",
      category: "security",
      targetEntityType: "admin_user",
      targetEntityId: session.sub,
      targetSummary: session.username,
    },
    { required: true }
  );

  return {};
}
