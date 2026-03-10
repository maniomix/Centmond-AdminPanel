"use server";
import { runAdminMutation, toAdminActionError } from "@/lib/admin/mutations";
import { financeEventSchema } from "@/lib/admin/schemas/phase2";
import { recordFinanceEvent } from "@/lib/admin/services/finance";

export async function recordFinanceEventAction(values: unknown) {
  let parsed: ReturnType<typeof financeEventSchema.parse>;
  try {
    parsed = financeEventSchema.parse(values);
  } catch {
    return { error: "Invalid finance event payload" };
  }

  try {
    return await runAdminMutation({
      permission: "finance.manage",
      requireRecentAuth: true,
      execute: async (actor) => {
        const event = await recordFinanceEvent({
          actorAdminId: actor.id,
          userId: parsed.userId ?? null,
          subscriptionId: parsed.subscriptionId ?? null,
          transactionId: parsed.transactionId ?? null,
          eventType: parsed.eventType,
          status: parsed.status,
          amount: parsed.amount ?? null,
          currency: parsed.currency,
          provider: parsed.provider ?? null,
          referenceId: parsed.referenceId ?? null,
          reason: parsed.reason,
          note: parsed.note ?? null,
        });

        return {
          value: { eventId: event.id },
          audit: {
            actionType: "finance.event_recorded",
            category: "billing",
            targetEntityType: "finance_event",
            targetEntityId: event.id,
            targetSummary: parsed.eventType,
            reason: parsed.reason,
            afterState: {
              userId: parsed.userId ?? null,
              subscriptionId: parsed.subscriptionId ?? null,
              eventType: parsed.eventType,
              status: parsed.status,
              amount: parsed.amount ?? null,
              currency: parsed.currency,
            },
          },
          revalidatePaths: [
            "/admin/finance",
            ...(parsed.userId ? [`/admin/users/${parsed.userId}`] : []),
          ],
        };
      },
    });
  } catch (error) {
    return toAdminActionError(error, "Failed to record finance event");
  }
}
