"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { canManageData, getAdminSession } from "@/lib/admin-session";
import type { ContentRow } from "@/types";

export async function deleteContentAction(id: string): Promise<{ error?: string }> {
  const session = await getAdminSession();
  if (!session) return { error: "Unauthorized" };
  if (!canManageData(session.role)) return { error: "Permission denied" };

  const supabase = createAdminClient();
  const { error } = await supabase.from("content").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/content");
  return {};
}

export async function upsertContentAction(
  id: string | null,
  values: Pick<
    ContentRow,
    "title" | "slug" | "status" | "published_at" | "body" | "category"
  >
): Promise<{ error?: string }> {
  const session = await getAdminSession();
  if (!session) return { error: "Unauthorized" };
  if (!canManageData(session.role)) return { error: "Permission denied" };

  const supabase = createAdminClient();

  if (id) {
    const { error } = await supabase
      .from("content")
      .update({ ...values, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return { error: error.message };
    revalidatePath(`/admin/content/${id}`);
    revalidatePath("/admin/content");
    return {};
  } else {
    const { error } = await supabase.from("content").insert({
      ...values,
      author_id: session.sub,
    });
    if (error) return { error: error.message };
    revalidatePath("/admin/content");
    redirect("/admin/content");
  }
}
