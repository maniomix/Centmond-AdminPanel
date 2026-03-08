"use server";

import { revalidatePath } from "next/cache";
import { canManageData, getAdminSession } from "@/lib/admin-session";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SubscriptionRow } from "@/types";

type UpdateValues = Pick<
  SubscriptionRow,
  | "plan"
  | "status"
  | "platform"
  | "current_period_start"
  | "current_period_end"
  | "subscription_start"
  | "subscription_end"
  | "trial_start"
  | "trial_end"
  | "stripe_customer_id"
  | "stripe_subscription_id"
  | "apple_transaction_id"
>;

async function requireWriteAccess(): Promise<{ error?: string }> {
  const session = await getAdminSession();
  if (!session) return { error: "Unauthorized" };
  if (!canManageData(session.role)) return { error: "Permission denied" };
  return {};
}

export async function updateSubscriptionAction(
  id: string,
  userId: string,
  values: UpdateValues
): Promise<{ error?: string }> {
  const auth = await requireWriteAccess();
  if (auth.error) return auth;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("subscriptions")
    .update({
      ...values,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/admin/subscriptions");
  revalidatePath(`/admin/users/${userId}`);
  return {};
}
