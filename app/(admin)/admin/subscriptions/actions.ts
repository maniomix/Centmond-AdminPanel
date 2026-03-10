"use server";

import { revalidatePath } from "next/cache";
import { auditWithCurrentAdmin } from "@/lib/admin/audit";
import { requirePermission } from "@/lib/admin/permissions";
import { assertSameOriginMutation } from "@/lib/admin/security";
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

export async function updateSubscriptionAction(
  id: string,
  userId: string,
  values: UpdateValues
): Promise<{ error?: string }> {
  await assertSameOriginMutation();
  await requirePermission("subscriptions.manage");

  const supabase = createAdminClient();
  const { data: before } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  const payload = {
    ...values,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("subscriptions").update(payload).eq("id", id);
  if (error) return { error: error.message };

  await auditWithCurrentAdmin({
    actionType: "subscription.updated",
    category: "subscription",
    targetEntityType: "subscription",
    targetEntityId: id,
    targetSummary: before?.stripe_subscription_id ?? before?.plan ?? id,
    beforeState: before ?? null,
    afterState: payload,
  });

  revalidatePath("/admin/subscriptions");
  revalidatePath(`/admin/users/${userId}`);
  return {};
}
