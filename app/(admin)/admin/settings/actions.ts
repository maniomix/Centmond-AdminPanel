"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminSession } from "@/lib/admin-session";
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

export async function updateAdminRoleAction(
  id: string,
  role: "super_admin" | "operations_admin" | "support_admin" | "finance_admin" | "moderation_admin" | "analyst"
): Promise<{ error?: string }> {
  await assertSameOriginMutation();
  await requirePermission("roles.assign");

  const supabase = createAdminClient();
  const { data: target } = await supabase
    .from("admin_users")
    .select("role, username")
    .eq("id", id)
    .maybeSingle();
  const { data: roleRow } = await supabase
    .from("admin_roles")
    .select("id")
    .eq("key", role)
    .maybeSingle();
  if (!roleRow) return { error: "Role not configured" };

  await supabase.from("admin_user_roles").delete().eq("admin_id", id);
  const { error: roleAssignmentError } = await supabase.from("admin_user_roles").insert({
    admin_id: id,
    role_id: roleRow.id,
  });
  if (roleAssignmentError) return { error: roleAssignmentError.message };

  const { error } = await supabase
    .from("admin_users")
    .update({ role, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: "Failed to update role" };
  await auditWithCurrentAdmin({
    actionType: "admin.role_changed",
    category: "admin",
    targetEntityType: "admin_user",
    targetEntityId: id,
    targetSummary: target?.username ?? id,
    beforeState: { role: target?.role },
    afterState: { role },
  });
  revalidatePath("/admin/settings");
  return {};
}

export async function revokeAdminAction(id: string): Promise<{ error?: string }> {
  await assertSameOriginMutation();
  const session = await getAdminSession();
  if (!session) return { error: "Unauthorized" };
  await requirePermission("admins.deactivate");
  if (session.sub === id) return { error: "You cannot revoke your own access" };

  const supabase = createAdminClient();
  const { data: before } = await supabase
    .from("admin_users")
    .select("username, status")
    .eq("id", id)
    .maybeSingle();
  const { error } = await supabase
    .from("admin_users")
    .update({
      status: "deactivated",
      is_active: false,
      must_reauth_after: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: "Failed to revoke access" };
  await auditWithCurrentAdmin({
    actionType: "admin.deactivated",
    category: "admin",
    severity: "warning",
    targetEntityType: "admin_user",
    targetEntityId: id,
    targetSummary: before?.username ?? id,
    beforeState: before ?? null,
    afterState: { status: "deactivated", is_active: false },
  });
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

  await auditWithCurrentAdmin({
    actionType: "admin.password_changed",
    category: "security",
    targetEntityType: "admin_user",
    targetEntityId: session.sub,
    targetSummary: session.username,
  });

  return {};
}
