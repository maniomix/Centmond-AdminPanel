"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { runAdminMutation, toAdminActionError } from "@/lib/admin/mutations";
import type { OrderRow } from "@/types";

export async function updateOrderStatusAction(
  id: string,
  status: OrderRow["status"]
): Promise<{ error?: string }> {
  try {
    return await runAdminMutation({
      permission: "orders.manage",
      requireRecentAuth: true,
      execute: async () => {
        const supabase = createAdminClient();
        const { data: order } = await supabase
          .from("orders")
          .select("id, status, order_number")
          .eq("id", id)
          .maybeSingle();
        if (!order) {
          throw new Error("Order not found");
        }

        const { error } = await supabase
          .from("orders")
          .update({ status, updated_at: new Date().toISOString() })
          .eq("id", id);
        if (error) {
          throw new Error(error.message);
        }

        return {
          value: {},
          audit: {
            actionType: "order.status_updated",
            category: "billing",
            targetEntityType: "order",
            targetEntityId: id,
            targetSummary: order.order_number,
            beforeState: { status: order.status },
            afterState: { status },
          },
          revalidatePaths: [`/admin/orders/${id}`, "/admin/orders"],
        };
      },
    });
  } catch (error) {
    return toAdminActionError(error, "Failed to update order status");
  }
}
