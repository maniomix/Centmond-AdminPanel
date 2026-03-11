"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  markCurrentAdminSessionSensitiveAuth,
  requireAdminSession,
  revokeAdminSession,
} from "@/lib/admin-session";
import { auditWithCurrentAdmin } from "@/lib/admin/audit";
import { hasPermission } from "@/lib/admin/permissions";
import { runAdminMutation, toAdminActionError } from "@/lib/admin/mutations";
import {
  changePasswordSchema,
  confirmSensitiveAccessSchema,
  revokeManagedSessionSchema,
  updateProfileSchema,
} from "@/lib/admin/schemas/hardening";

export async function updateProfileAction(
  adminId: string,
  displayName: string
): Promise<{ error?: string }> {
  const parsed = updateProfileSchema.safeParse({ adminId, displayName });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid profile update" };
  }

  try {
    return await runAdminMutation({
      execute: async (actor) => {
        if (actor.id !== parsed.data.adminId && !hasPermission(actor, "admins.edit")) {
          throw new Error("Permission denied");
        }
        if (actor.id !== parsed.data.adminId && actor.role !== "super_admin") {
          throw new Error("Permission denied");
        }

        const supabase = createAdminClient();
        const { error } = await supabase
          .from("admin_users")
          .update({
            display_name: parsed.data.displayName,
            updated_at: new Date().toISOString(),
          })
          .eq("id", parsed.data.adminId);

        if (error) {
          throw new Error("Failed to update profile");
        }

        return {
          value: {},
          audit: {
            actionType: "admin.profile_updated",
            category: "admin",
            targetEntityType: "admin_user",
            targetEntityId: parsed.data.adminId,
            afterState: { display_name: parsed.data.displayName },
          },
          revalidatePaths: ["/admin/settings", `/admin/admins/${parsed.data.adminId}`],
        };
      },
    });
  } catch (error) {
    return toAdminActionError(error, "Failed to update profile");
  }
}

export async function confirmSensitiveAccessAction(
  password: string
): Promise<{ error?: string }> {
  const parsed = confirmSensitiveAccessSchema.safeParse({ password });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Password is required" };
  }

  try {
    return await runAdminMutation({
      execute: async () => {
        const session = await requireAdminSession();
        const supabase = createAdminClient();
        const { data, error } = await supabase.rpc("admin_login", {
          p_username: session.username,
          p_password: parsed.data.password,
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
          throw new Error("Current password is incorrect");
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
          throw new Error("Current password is incorrect");
        }

        await markCurrentAdminSessionSensitiveAuth();
        return {
          value: {},
          audit: {
            actionType: "admin.reauth.confirmed",
            category: "security",
            targetEntityType: "admin_session",
            targetEntityId: session.sessionId,
            targetSummary: session.username,
          },
          revalidatePaths: ["/admin/settings"],
        };
      },
    });
  } catch (error) {
    return toAdminActionError(error, "Failed to confirm password");
  }
}

export async function revokeManagedSessionAction(
  sessionId: string
): Promise<{ error?: string }> {
  const parsed = revokeManagedSessionSchema.safeParse({ sessionId });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid session" };
  }

  try {
    return await runAdminMutation({
      execute: async (actor) => {
        const currentSession = await requireAdminSession();
        if (parsed.data.sessionId === currentSession.sessionId) {
          throw new Error("Use the account menu to sign out the current session");
        }

        const supabase = createAdminClient();
        const { data: targetSession } = await supabase
          .from("admin_sessions")
          .select("id, admin_id, device_label, ip_address")
          .eq("id", parsed.data.sessionId)
          .maybeSingle();

        if (!targetSession || targetSession.admin_id !== actor.id) {
          throw new Error("Session not found");
        }

        await revokeAdminSession(parsed.data.sessionId, "self_service_session_revoke");
        return {
          value: {},
          audit: {
            actionType: "admin.session_revoked.self_service",
            category: "security",
            severity: "warning",
            targetEntityType: "admin_session",
            targetEntityId: parsed.data.sessionId,
            targetSummary:
              targetSession.device_label ?? targetSession.ip_address ?? parsed.data.sessionId,
          },
          revalidatePaths: ["/admin/settings"],
        };
      },
    });
  } catch (error) {
    return toAdminActionError(error, "Failed to revoke session");
  }
}

export async function changePasswordAction(
  oldPassword: string,
  newPassword: string
): Promise<{ error?: string }> {
  const parsed = changePasswordSchema.safeParse({ oldPassword, newPassword });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid password update" };
  }

  try {
    return await runAdminMutation({
      execute: async (actor) => {
        const session = await requireAdminSession();
        const supabase = createAdminClient();
        const { data: changeData, error: changeError } = await supabase.rpc(
          "admin_change_password",
          {
            p_admin_id: session.sub,
            p_old_password: parsed.data.oldPassword,
            p_new_password: parsed.data.newPassword,
          }
        );

        if (changeError || !changeData) {
          throw new Error("Failed to change password");
        }

        const changeResult = changeData as { success?: boolean; error?: string };
        if (!changeResult.success) {
          throw new Error(changeResult.error ?? "Failed to change password");
        }

        return {
          value: {},
          audit: {
            actionType: "admin.password_changed",
            category: "security",
            targetEntityType: "admin_user",
            targetEntityId: actor.id,
            targetSummary: actor.username,
          },
        };
      },
    });
  } catch (error) {
    return toAdminActionError(error, "Failed to change password");
  }
}
