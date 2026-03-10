"use server";

import { runAdminMutation, toAdminActionError } from "@/lib/admin/mutations";
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
  try {
    return await runAdminMutation({
      permission: "subscriptions.manage",
      requireRecentAuth: true,
      execute: async () => {
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
        if (error) {
          throw new Error(error.message);
        }

        return {
          value: {},
          audit: {
            actionType: "subscription.updated",
            category: "subscription",
            targetEntityType: "subscription",
            targetEntityId: id,
            targetSummary: before?.stripe_subscription_id ?? before?.plan ?? id,
            beforeState: before ?? null,
            afterState: payload,
          },
          revalidatePaths: ["/admin/subscriptions", `/admin/users/${userId}`],
        };
      },
    });
  } catch (error) {
    return toAdminActionError(error, "Failed to update subscription");
  }
}
