"use server";

import { runAdminMutation, toAdminActionError } from "@/lib/admin/mutations";
import { reviewDecisionSchema, supportHandoffSchema } from "@/lib/admin/schemas/phase2";
import { createSupportHandoff, upsertReviewQueueItem } from "@/lib/admin/services/reviews";

export async function updateReviewQueueItemAction(values: unknown) {
  let parsed: ReturnType<typeof reviewDecisionSchema.parse>;
  try {
    parsed = reviewDecisionSchema.parse(values);
  } catch {
    return { error: "Invalid review decision payload" };
  }

  try {
    return await runAdminMutation({
      permission: "reviews.manage",
      requireRecentAuth: ["approved", "restricted", "rejected"].includes(parsed.status),
      execute: async (actor) => {
        const item = await upsertReviewQueueItem({
          userId: parsed.userId,
          status: parsed.status,
          priority: parsed.priority,
          reason: parsed.reason,
          actorAdminId: actor.id,
          assignedToAdminId: parsed.assignedToAdminId ?? null,
        });

        return {
          value: { itemId: item.id },
          audit: {
            actionType: `review.status_changed.${parsed.status}`,
            category: "risk",
            targetEntityType: "review_queue_item",
            targetEntityId: item.id,
            targetSummary: parsed.userId,
            reason: parsed.reason,
            afterState: {
              status: parsed.status,
              priority: parsed.priority,
              assignedToAdminId: parsed.assignedToAdminId ?? null,
            },
          },
          revalidatePaths: ["/admin/reviews", `/admin/users/${parsed.userId}`],
        };
      },
    });
  } catch (error) {
    return toAdminActionError(error, "Failed to update review queue");
  }
}

export async function createSupportHandoffAction(values: unknown) {
  let parsed: ReturnType<typeof supportHandoffSchema.parse>;
  try {
    parsed = supportHandoffSchema.parse(values);
  } catch {
    return { error: "Invalid support handoff payload" };
  }

  try {
    return await runAdminMutation({
      anyPermissions: ["support.notes.manage", "finance.notes.manage"],
      execute: async (actor) => {
        const handoff = await createSupportHandoff({
          userId: parsed.userId,
          fromAdminId: actor.id,
          toAdminId: parsed.toAdminId ?? null,
          priority: parsed.priority,
          summary: parsed.summary,
          details: parsed.details ?? null,
        });

        return {
          value: { handoffId: handoff.id },
          audit: {
            actionType: "support.handoff_created",
            category: "support",
            targetEntityType: "support_handoff",
            targetEntityId: handoff.id,
            targetSummary: parsed.summary,
            reason: parsed.summary,
            afterState: {
              userId: parsed.userId,
              toAdminId: parsed.toAdminId ?? null,
              priority: parsed.priority,
            },
          },
          revalidatePaths: ["/admin/reviews", `/admin/users/${parsed.userId}`],
        };
      },
    });
  } catch (error) {
    return toAdminActionError(error, "Failed to create support handoff");
  }
}
