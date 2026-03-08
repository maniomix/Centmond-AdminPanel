"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";
import { getAdminSession, isSuperAdmin } from "@/lib/admin-session";

type JsonObj = { [key: string]: Json | undefined };

export async function updateProfileAction(
  adminId: string,
  displayName: string
): Promise<{ error?: string }> {
  const session = await getAdminSession();
  if (!session) return { error: "Unauthorized" };
  if (session.sub !== adminId && !isSuperAdmin(session.role)) {
    return { error: "Permission denied" };
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("admin_users")
    .update({ display_name: displayName, updated_at: new Date().toISOString() })
    .eq("id", adminId);

  if (error) return { error: "Failed to update profile" };
  revalidatePath("/admin/settings");
  return {};
}

export async function updateAdminRoleAction(
  id: string,
  role: "super_admin" | "admin" | "viewer"
): Promise<{ error?: string }> {
  const session = await getAdminSession();
  if (!session) return { error: "Unauthorized" };
  if (!isSuperAdmin(session.role)) return { error: "Only super admins can update roles" };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("admin_users")
    .update({ role, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: "Failed to update role" };
  revalidatePath("/admin/settings");
  return {};
}

export async function revokeAdminAction(id: string): Promise<{ error?: string }> {
  const session = await getAdminSession();
  if (!session) return { error: "Unauthorized" };
  if (!isSuperAdmin(session.role)) return { error: "Only super admins can revoke access" };
  if (session.sub === id) return { error: "You cannot revoke your own access" };

  const supabase = createAdminClient();
  const { error } = await supabase.from("admin_users").delete().eq("id", id);

  if (error) return { error: "Failed to revoke access" };
  revalidatePath("/admin/settings");
  return {};
}

export async function changePasswordAction(
  oldPassword: string,
  newPassword: string
): Promise<{ error?: string }> {
  const session = await getAdminSession();
  if (!session) return { error: "Unauthorized" };

  const supabase = createAdminClient();

  // Verify old password by logging in → get a temporary DB session token
  const { data: loginData, error: loginError } = await supabase.rpc("admin_login", {
    p_username: session.username,
    p_password: oldPassword,
  });

  if (loginError || !loginData) return { error: "Current password is incorrect" };

  const loginResult = loginData as JsonObj;
  if (!loginResult.success || !loginResult.token) {
    return { error: "Current password is incorrect" };
  }

  // Use the DB session token to change the password
  const { data: changeData, error: changeError } = await supabase.rpc("admin_change_password", {
    p_admin_token: loginResult.token as string,
    p_old_password: oldPassword,
    p_new_password: newPassword,
  });

  if (changeError || !changeData) return { error: "Failed to change password" };

  const changeResult = changeData as JsonObj;
  if (!changeResult.success) return { error: (changeResult.error as string) ?? "Failed to change password" };

  return {};
}
