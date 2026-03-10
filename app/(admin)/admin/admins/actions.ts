"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { auditWithCurrentAdmin } from "@/lib/admin/audit";
import { requirePermission } from "@/lib/admin/permissions";
import { assertSameOriginMutation } from "@/lib/admin/security";
import {
  isAdminRole,
  type AdminRole,
} from "@/lib/admin/constants";
import { getAdminSession, revokeAllAdminSessions } from "@/lib/admin-session";

async function getRoleIdByKey(roleKey: AdminRole): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("admin_roles")
    .select("id")
    .eq("key", roleKey)
    .maybeSingle();
  return data?.id ?? null;
}

function revalidateAdminPages(adminId?: string) {
  revalidatePath("/admin/admins");
  revalidatePath("/admin/settings");
  if (adminId) {
    revalidatePath(`/admin/admins/${adminId}`);
  }
}

export async function createAdminAccountAction(values: {
  username: string;
  email: string;
  displayName: string;
  password: string;
  role: AdminRole;
}) {
  await assertSameOriginMutation();
  const actor = await requirePermission("admins.create");
  if (!isAdminRole(values.role)) {
    return { error: "Invalid role" };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("admin_create_user", {
    p_username: values.username.trim().toLowerCase(),
    p_email: values.email.trim().toLowerCase(),
    p_display_name: values.displayName.trim(),
    p_password: values.password,
    p_role: values.role,
  });

  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    return { error: error?.message ?? "Failed to create admin" };
  }

  const result = data as { success?: boolean; error?: string; admin_id?: string };
  if (!result.success || !result.admin_id) {
    return { error: result.error ?? "Failed to create admin" };
  }

  const roleId = await getRoleIdByKey(values.role);
  if (roleId) {
    await supabase.from("admin_user_roles").upsert({
      admin_id: result.admin_id,
      role_id: roleId,
      assigned_by_admin_id: actor.id,
    });
  }

  await auditWithCurrentAdmin({
    actionType: "admin.create",
    category: "admin",
    targetEntityType: "admin_user",
    targetEntityId: result.admin_id,
    targetSummary: values.username.trim().toLowerCase(),
    afterState: {
      username: values.username.trim().toLowerCase(),
      email: values.email.trim().toLowerCase(),
      role: values.role,
    },
  });

  revalidateAdminPages(result.admin_id);
  return { adminId: result.admin_id };
}

export async function assignAdminRoleAction(
  adminId: string,
  role: AdminRole,
  reason: string
) {
  await assertSameOriginMutation();
  const actor = await requirePermission("roles.assign");
  if (!isAdminRole(role)) {
    return { error: "Invalid role" };
  }

  const supabase = createAdminClient();
  const { data: targetAdmin } = await supabase
    .from("admin_users")
    .select("id, username, role")
    .eq("id", adminId)
    .maybeSingle();
  if (!targetAdmin) {
    return { error: "Admin not found" };
  }

  const roleId = await getRoleIdByKey(role);
  if (!roleId) return { error: "Role not configured" };

  await supabase.from("admin_user_roles").delete().eq("admin_id", adminId);
  const { error: assignmentError } = await supabase.from("admin_user_roles").insert({
    admin_id: adminId,
    role_id: roleId,
    assigned_by_admin_id: actor.id,
  });
  if (assignmentError) {
    return { error: assignmentError.message };
  }

  const { error: updateError } = await supabase
    .from("admin_users")
    .update({ role, updated_at: new Date().toISOString() })
    .eq("id", adminId);
  if (updateError) {
    return { error: updateError.message };
  }

  await auditWithCurrentAdmin({
    actionType: "admin.role_changed",
    category: "admin",
    targetEntityType: "admin_user",
    targetEntityId: adminId,
    targetSummary: targetAdmin.username,
    reason,
    beforeState: { role: targetAdmin.role },
    afterState: { role },
  });

  revalidateAdminPages(adminId);
  return {};
}

export async function updateAdminStatusAction(
  adminId: string,
  status: "active" | "suspended" | "deactivated",
  reason: string
) {
  await assertSameOriginMutation();
  const session = await getAdminSession();
  await requirePermission("admins.deactivate");
  if (session?.sub === adminId && status !== "active") {
    return { error: "You cannot deactivate yourself" };
  }

  const supabase = createAdminClient();
  const { data: targetAdmin } = await supabase
    .from("admin_users")
    .select("id, username, status, is_active")
    .eq("id", adminId)
    .maybeSingle();
  if (!targetAdmin) {
    return { error: "Admin not found" };
  }

  const { error } = await supabase
    .from("admin_users")
    .update({
      status,
      is_active: status === "active",
      must_reauth_after: status === "active" ? null : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", adminId);
  if (error) {
    return { error: error.message };
  }

  if (status !== "active") {
    await revokeAllAdminSessions(adminId, `status_${status}`);
  }

  await auditWithCurrentAdmin({
    actionType: "admin.status_changed",
    category: "admin",
    severity: status === "active" ? "info" : "warning",
    targetEntityType: "admin_user",
    targetEntityId: adminId,
    targetSummary: targetAdmin.username,
    reason,
    beforeState: { status: targetAdmin.status, isActive: targetAdmin.is_active },
    afterState: { status, isActive: status === "active" },
  });

  revalidateAdminPages(adminId);
  return {};
}

export async function revokeAdminSessionsAction(adminId: string, reason: string) {
  await assertSameOriginMutation();
  await requirePermission("admins.edit");
  const supabase = createAdminClient();
  const { data: targetAdmin } = await supabase
    .from("admin_users")
    .select("id, username")
    .eq("id", adminId)
    .maybeSingle();
  if (!targetAdmin) {
    return { error: "Admin not found" };
  }

  await revokeAllAdminSessions(adminId, "manual_revoke_all");
  await auditWithCurrentAdmin({
    actionType: "admin.sessions_revoked",
    category: "security",
    severity: "warning",
    targetEntityType: "admin_user",
    targetEntityId: adminId,
    targetSummary: targetAdmin.username,
    reason,
  });
  revalidateAdminPages(adminId);
  return {};
}
