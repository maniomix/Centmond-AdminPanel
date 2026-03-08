"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageData, getAdminSession } from "@/lib/admin-session";
import type { OrderRow } from "@/types";

export async function updateOrderStatusAction(
  id: string,
  status: OrderRow["status"]
): Promise<{ error?: string }> {
  const session = await getAdminSession();
  if (!session) return { error: "Unauthorized" };
  if (!canManageData(session.role)) return { error: "Permission denied" };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("orders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/admin/orders");
  return {};
}
