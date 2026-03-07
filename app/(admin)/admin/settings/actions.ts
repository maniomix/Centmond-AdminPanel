"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

export async function updateProfileAction(
  adminId: string,
  fullName: string
): Promise<{ error?: string }> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("panel_admins")
    .update({ full_name: fullName, updated_at: new Date().toISOString() })
    .eq("id", adminId);

  if (error) return { error: "Failed to update profile" };
  revalidatePath("/admin/settings");
  return {};
}

export async function updateAdminRoleAction(
  id: string,
  role: "admin" | "editor"
): Promise<{ error?: string }> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("panel_admins")
    .update({ role, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: "Failed to update role" };
  revalidatePath("/admin/settings");
  return {};
}

export async function revokeAdminAction(id: string): Promise<{ error?: string }> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("panel_admins").delete().eq("id", id);

  if (error) return { error: "Failed to revoke access" };
  revalidatePath("/admin/settings");
  return {};
}
