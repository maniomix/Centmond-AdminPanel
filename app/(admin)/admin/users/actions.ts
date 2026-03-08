"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageData, getAdminSession } from "@/lib/admin-session";
import type { UserRow } from "@/types";

async function requireWriteAccess(): Promise<{ error?: string }> {
  const session = await getAdminSession();
  if (!session) return { error: "Unauthorized" };
  if (!canManageData(session.role)) return { error: "Permission denied" };
  return {};
}

export async function deleteUserAction(id: string): Promise<{ error?: string }> {
  const auth = await requireWriteAccess();
  if (auth.error) return auth;

  const supabase = createAdminClient();
  const { error } = await supabase.from("users").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/users");
  return {};
}

export async function updateUserAction(
  id: string,
  values: Pick<UserRow, "display_name" | "is_email_verified">
): Promise<{ error?: string }> {
  const auth = await requireWriteAccess();
  if (auth.error) return auth;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("users")
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/admin/users/${id}`);
  revalidatePath("/admin/users");
  return {};
}
