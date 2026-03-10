"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  isAdminRole,
  type AdminRole,
} from "@/lib/admin/constants";
import { getAdminSession, revokeAllAdminSessions } from "@/lib/admin-session";
import { runAdminMutation, toAdminActionError } from "@/lib/admin/mutations";

async function getRoleIdByKey(roleKey: AdminRole): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("admin_roles")
    .select("id")
    .eq("key", roleKey)
    .maybeSingle();
  return data?.id ?? null;
}

function getAdminRevalidationPaths(adminId?: string): string[] {
  return [
    "/admin/admins",
    "/admin/settings",
    ...(adminId ? [`/admin/admins/${adminId}`] : []),
  ];
}

export async function createAdminAccountAction(values: {
  username: string;
  email: string;
  displayName: string;
  password: string;
  role: AdminRole;
}) {
  if (!isAdminRole(values.role)) {
    return { error: "Invalid role" };
  }

  try {
    return await runAdminMutation({
      permission: "admins.create",
      requireRecentAuth: true,
      execute: async (actor) => {
        const supabase = createAdminClient();
        const username = values.username.trim().toLowerCase();
        const email = values.email.trim().toLowerCase();
        const displayName = values.displayName.trim();
        const { data, error } = await supabase.rpc("admin_create_user", {
          p_username: username,
          p_email: email,
          p_display_name: displayName,
          p_password: values.password,
          p_role: values.role,
        });

        if (error || !data || typeof data !== "object" || Array.isArray(data)) {
          throw new Error(error?.message ?? "Failed to create admin");
        }

        const result = data as { success?: boolean; error?: string; admin_id?: string };
        if (!result.success || !result.admin_id) {
          throw new Error(result.error ?? "Failed to create admin");
        }

        const roleId = await getRoleIdByKey(values.role);
        if (!roleId) {
          throw new Error("Role not configured");
        }

        const { error: assignmentError } = await supabase
          .from("admin_user_roles")
          .upsert({
            admin_id: result.admin_id,
            role_id: roleId,
            assigned_by_admin_id: actor.id,
          });
        if (assignmentError) {
          throw new Error(assignmentError.message);
        }

        return {
          value: { adminId: result.admin_id },
          audit: {
            actionType: "admin.create",
            category: "admin",
            targetEntityType: "admin_user",
            targetEntityId: result.admin_id,
            targetSummary: username,
            afterState: {
              username,
              email,
              role: values.role,
            },
          },
          revalidatePaths: getAdminRevalidationPaths(result.admin_id),
        };
      },
    });
  } catch (error) {
    return toAdminActionError(error, "Failed to create admin");
  }
}

export async function assignAdminRoleAction(
  adminId: string,
  role: AdminRole,
  reason: string
) {
  if (!isAdminRole(role)) {
    return { error: "Invalid role" };
  }
  if (!reason.trim()) {
    return { error: "Reason is required" };
  }

  try {
    return await runAdminMutation({
      permission: "roles.assign",
      requireRecentAuth: true,
      execute: async (actor) => {
        const supabase = createAdminClient();
        const { data: targetAdmin } = await supabase
          .from("admin_users")
          .select("id, username, role")
          .eq("id", adminId)
          .maybeSingle();
        if (!targetAdmin) {
          throw new Error("Admin not found");
        }

        const roleId = await getRoleIdByKey(role);
        if (!roleId) {
          throw new Error("Role not configured");
        }

        await supabase.from("admin_user_roles").delete().eq("admin_id", adminId);
        const { error: assignmentError } = await supabase.from("admin_user_roles").insert({
          admin_id: adminId,
          role_id: roleId,
          assigned_by_admin_id: actor.id,
        });
        if (assignmentError) {
          throw new Error(assignmentError.message);
        }

        const { error: updateError } = await supabase
          .from("admin_users")
          .update({ role, updated_at: new Date().toISOString() })
          .eq("id", adminId);
        if (updateError) {
          throw new Error(updateError.message);
        }

        return {
          value: {},
          audit: {
            actionType: "admin.role_changed",
            category: "admin",
            targetEntityType: "admin_user",
            targetEntityId: adminId,
            targetSummary: targetAdmin.username,
            reason: reason.trim(),
            beforeState: { role: targetAdmin.role },
            afterState: { role },
          },
          revalidatePaths: getAdminRevalidationPaths(adminId),
        };
      },
    });
  } catch (error) {
    return toAdminActionError(error, "Failed to update admin role");
  }
}

export async function updateAdminStatusAction(
  adminId: string,
  status: "active" | "suspended" | "deactivated",
  reason: string
) {
  if (!reason.trim()) {
    return { error: "Reason is required" };
  }

  const session = await getAdminSession();
  if (session?.sub === adminId && status !== "active") {
    return { error: "You cannot deactivate yourself" };
  }

  try {
    return await runAdminMutation({
      permission: "admins.deactivate",
      requireRecentAuth: true,
      execute: async () => {
        const supabase = createAdminClient();
        const { data: targetAdmin } = await supabase
          .from("admin_users")
          .select("id, username, status, is_active")
          .eq("id", adminId)
          .maybeSingle();
        if (!targetAdmin) {
          throw new Error("Admin not found");
        }

        const payload = {
          status,
          is_active: status === "active",
          must_reauth_after: status === "active" ? null : new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { error } = await supabase
          .from("admin_users")
          .update(payload)
          .eq("id", adminId);
        if (error) {
          throw new Error(error.message);
        }

        if (status !== "active") {
          await revokeAllAdminSessions(adminId, `status_${status}`);
        }

        return {
          value: {},
          audit: {
            actionType: "admin.status_changed",
            category: "admin",
            severity: status === "active" ? "info" : "warning",
            targetEntityType: "admin_user",
            targetEntityId: adminId,
            targetSummary: targetAdmin.username,
            reason: reason.trim(),
            beforeState: { status: targetAdmin.status, isActive: targetAdmin.is_active },
            afterState: { status, isActive: status === "active" },
          },
          revalidatePaths: getAdminRevalidationPaths(adminId),
        };
      },
    });
  } catch (error) {
    return toAdminActionError(error, "Failed to update admin status");
  }
}

export async function revokeAdminSessionsAction(adminId: string, reason: string) {
  if (!reason.trim()) {
    return { error: "Reason is required" };
  }

  try {
    return await runAdminMutation({
      permission: "admins.sessions.manage",
      requireRecentAuth: true,
      execute: async () => {
        const supabase = createAdminClient();
        const { data: targetAdmin } = await supabase
          .from("admin_users")
          .select("id, username")
          .eq("id", adminId)
          .maybeSingle();
        if (!targetAdmin) {
          throw new Error("Admin not found");
        }

        await revokeAllAdminSessions(adminId, "manual_revoke_all");
        return {
          value: {},
          audit: {
            actionType: "admin.sessions_revoked",
            category: "security",
            severity: "warning",
            targetEntityType: "admin_user",
            targetEntityId: adminId,
            targetSummary: targetAdmin.username,
            reason: reason.trim(),
          },
          revalidatePaths: getAdminRevalidationPaths(adminId),
        };
      },
    });
  } catch (error) {
    return toAdminActionError(error, "Failed to revoke admin sessions");
  }
}
