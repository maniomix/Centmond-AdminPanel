"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { runAdminMutation, toAdminActionError } from "@/lib/admin/mutations";
import {
  deleteSubscriptionSchema,
  setUserVerificationSchema,
  subscriptionUpsertSchema,
  userIdSchema,
  userUpdateSchema,
} from "@/lib/admin/schemas/hardening";
import { bulkJobInputSchema } from "@/lib/admin/schemas/phase2";
import { createBulkJob, updateBulkJobState } from "@/lib/admin/services/bulk-jobs";
import { upsertReviewQueueItem } from "@/lib/admin/services/reviews";
import type { Json } from "@/types/database";
import type { SubscriptionRow, UserRow } from "@/types";

type UserUpdateValues = Pick<
  UserRow,
  | "display_name"
  | "is_email_verified"
  | "profile_image_url"
  | "profile_image"
  | "custom_categories"
  | "last_active_at"
>;

type SubscriptionUpsertValues = Pick<
  SubscriptionRow,
  | "plan"
  | "status"
  | "platform"
  | "trial_start"
  | "trial_end"
  | "subscription_start"
  | "subscription_end"
  | "current_period_start"
  | "current_period_end"
  | "stripe_customer_id"
  | "stripe_subscription_id"
  | "apple_transaction_id"
>;

function normalizeText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function resolveStatusPermission(nextStatus: UserRow["status"]) {
  if (nextStatus === "suspended") return "users.suspend" as const;
  if (nextStatus === "banned") return "users.ban" as const;
  if (nextStatus === "active") return "users.reactivate" as const;
  if (nextStatus === "under_review" || nextStatus === "flagged") {
    return "review_queue.manage" as const;
  }
  return "users.edit" as const;
}

export async function deleteUserAction(
  id: string,
  reason?: string
): Promise<{ error?: string }> {
  try {
    return await runAdminMutation({
      permission: "users.soft_delete",
      requireRecentAuth: true,
      execute: async () => {
        const supabase = createAdminClient();
        const deletedAt = new Date().toISOString();
        const { data: before } = await supabase
          .from("users")
          .select("id, email, status, deleted_at")
          .eq("id", id)
          .maybeSingle();
        const { error } = await supabase
          .from("users")
          .update({
            status: "soft_deleted",
            deleted_at: deletedAt,
            updated_at: new Date().toISOString(),
          })
          .eq("id", id);
        if (error) {
          throw new Error(error.message);
        }

        return {
          value: {},
          audit: {
            actionType: "user.soft_deleted",
            category: "user",
            severity: "warning",
            targetEntityType: "user",
            targetEntityId: id,
            targetSummary: before?.email ?? id,
            reason: reason?.trim() || null,
            beforeState: before ?? null,
            afterState: {
              status: "soft_deleted",
              deleted_at: deletedAt,
            },
          },
          revalidatePaths: [
            "/admin/users",
            `/admin/users/${id}`,
            "/admin/subscriptions",
            "/admin/reviews",
            "/admin/segments",
          ],
        };
      },
    });
  } catch (error) {
    return toAdminActionError(error, "Failed to archive user");
  }
}

export async function updateUserAction(
  id: string,
  values: UserUpdateValues
): Promise<{ error?: string }> {
  const parsed = userUpdateSchema.safeParse({ id, values });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid user update" };
  }

  try {
    return await runAdminMutation({
      permission: "users.edit",
      execute: async () => {
        const supabase = createAdminClient();
        const { data: before } = await supabase
          .from("users")
          .select("id, display_name, is_email_verified, profile_image_url, profile_image, custom_categories, last_active_at")
          .eq("id", parsed.data.id)
          .maybeSingle();

        const afterState = {
          display_name: normalizeText(parsed.data.values.display_name),
          is_email_verified: parsed.data.values.is_email_verified,
          profile_image_url: normalizeText(parsed.data.values.profile_image_url),
          profile_image: normalizeText(parsed.data.values.profile_image),
          custom_categories: (parsed.data.values.custom_categories ?? null) as Json | null,
          last_active_at: parsed.data.values.last_active_at ?? null,
        };

        const { error } = await supabase
          .from("users")
          .update({
            ...afterState,
            updated_at: new Date().toISOString(),
          })
          .eq("id", parsed.data.id);

        if (error) {
          throw new Error(error.message);
        }

        return {
          value: {},
          audit: {
            actionType: "user.updated",
            category: "user",
            targetEntityType: "user",
            targetEntityId: parsed.data.id,
            beforeState: before ?? null,
            afterState,
          },
          revalidatePaths: [
            "/admin/users",
            `/admin/users/${parsed.data.id}`,
            "/admin/subscriptions",
            "/admin/reviews",
            "/admin/segments",
          ],
        };
      },
    });
  } catch (error) {
    return toAdminActionError(error, "Failed to update user");
  }
}

export async function setUserVerificationAction(
  id: string,
  isVerified: boolean
): Promise<{ error?: string }> {
  const parsed = setUserVerificationSchema.safeParse({ id, isVerified });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid verification update" };
  }

  try {
    return await runAdminMutation({
      permission: "users.edit",
      execute: async () => {
        const supabase = createAdminClient();
        const { error } = await supabase
          .from("users")
          .update({
            is_email_verified: parsed.data.isVerified,
            updated_at: new Date().toISOString(),
          })
          .eq("id", parsed.data.id);

        if (error) {
          throw new Error(error.message);
        }

        return {
          value: {},
          audit: {
            actionType: "user.email_verification_set",
            category: "user",
            targetEntityType: "user",
            targetEntityId: parsed.data.id,
            afterState: { is_email_verified: parsed.data.isVerified },
          },
          revalidatePaths: [
            "/admin/users",
            `/admin/users/${parsed.data.id}`,
            "/admin/subscriptions",
            "/admin/reviews",
            "/admin/segments",
          ],
        };
      },
    });
  } catch (error) {
    return toAdminActionError(error, "Failed to update verification");
  }
}

export async function setUserLastActiveNowAction(id: string): Promise<{ error?: string }> {
  const parsed = userIdSchema.safeParse({ id });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid user id" };
  }

  try {
    return await runAdminMutation({
      permission: "users.edit",
      execute: async () => {
        const supabase = createAdminClient();
        const lastActiveAt = new Date().toISOString();
        const { error } = await supabase
          .from("users")
          .update({
            last_active_at: lastActiveAt,
            updated_at: new Date().toISOString(),
          })
          .eq("id", parsed.data.id);

        if (error) {
          throw new Error(error.message);
        }

        return {
          value: {},
          audit: {
            actionType: "user.last_active_overridden",
            category: "user",
            targetEntityType: "user",
            targetEntityId: parsed.data.id,
            afterState: { last_active_at: lastActiveAt },
          },
          revalidatePaths: [
            "/admin/users",
            `/admin/users/${parsed.data.id}`,
            "/admin/subscriptions",
            "/admin/reviews",
            "/admin/segments",
          ],
        };
      },
    });
  } catch (error) {
    return toAdminActionError(error, "Failed to set last active");
  }
}

async function getLatestSubscriptionId(
  userId: string
): Promise<{ id: string | null; error?: string }> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return { id: null, error: error.message };
  return { id: data?.id ?? null };
}

export async function upsertUserSubscriptionAction(
  userId: string,
  values: SubscriptionUpsertValues
): Promise<{ error?: string }> {
  const parsed = subscriptionUpsertSchema.safeParse({ userId, values });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid subscription payload" };
  }

  try {
    return await runAdminMutation({
      permission: "subscriptions.manage",
      requireRecentAuth: true,
      execute: async () => {
        const { id: subscriptionId, error: subscriptionLookupError } =
          await getLatestSubscriptionId(parsed.data.userId);
        if (subscriptionLookupError) {
          throw new Error(subscriptionLookupError);
        }

        const supabase = createAdminClient();
        const { data: before } = subscriptionId
          ? await supabase
              .from("subscriptions")
              .select("*")
              .eq("id", subscriptionId)
              .maybeSingle()
          : { data: null };

        const payload = {
          plan: normalizeText(parsed.data.values.plan) ?? "free",
          status: normalizeText(parsed.data.values.status) ?? "active",
          platform: normalizeText(parsed.data.values.platform),
          trial_start: parsed.data.values.trial_start ?? null,
          trial_end: parsed.data.values.trial_end ?? null,
          subscription_start: parsed.data.values.subscription_start ?? null,
          subscription_end: parsed.data.values.subscription_end ?? null,
          current_period_start: parsed.data.values.current_period_start ?? null,
          current_period_end: parsed.data.values.current_period_end ?? null,
          stripe_customer_id: normalizeText(parsed.data.values.stripe_customer_id),
          stripe_subscription_id: normalizeText(parsed.data.values.stripe_subscription_id),
          apple_transaction_id: normalizeText(parsed.data.values.apple_transaction_id),
          updated_at: new Date().toISOString(),
        };

        const result = subscriptionId
          ? await supabase.from("subscriptions").update(payload).eq("id", subscriptionId)
          : await supabase.from("subscriptions").insert({
              user_id: parsed.data.userId,
              ...payload,
            });

        if (result.error) {
          throw new Error(result.error.message);
        }

        return {
          value: {},
          audit: {
            actionType: subscriptionId ? "subscription.updated" : "subscription.created",
            category: "subscription",
            targetEntityType: "user",
            targetEntityId: parsed.data.userId,
            beforeState: before ?? null,
            afterState: payload,
          },
          revalidatePaths: [
            "/admin/users",
            `/admin/users/${parsed.data.userId}`,
            "/admin/subscriptions",
            "/admin/reviews",
            "/admin/segments",
          ],
        };
      },
    });
  } catch (error) {
    return toAdminActionError(error, "Failed to save subscription");
  }
}

export async function applySubscriptionPresetAction(
  userId: string,
  preset: "free" | "monthly" | "yearly"
): Promise<{ error?: string }> {
  const now = new Date();
  const periodEnd = new Date(now);
  if (preset === "monthly") {
    periodEnd.setDate(periodEnd.getDate() + 30);
  } else if (preset === "yearly") {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  }

  return upsertUserSubscriptionAction(userId, {
    plan: preset,
    status: "active",
    platform: "admin",
    trial_start: null,
    trial_end: null,
    subscription_start: now.toISOString(),
    subscription_end: preset === "free" ? null : periodEnd.toISOString(),
    current_period_start: now.toISOString(),
    current_period_end: preset === "free" ? null : periodEnd.toISOString(),
    stripe_customer_id: null,
    stripe_subscription_id: null,
    apple_transaction_id: null,
  });
}

export async function deleteSubscriptionAction(
  subscriptionId: string,
  userId: string
): Promise<{ error?: string }> {
  const parsed = deleteSubscriptionSchema.safeParse({ subscriptionId, userId });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid subscription delete request" };
  }

  try {
    return await runAdminMutation({
      permission: "subscriptions.manage",
      requireRecentAuth: true,
      execute: async () => {
        const supabase = createAdminClient();
        const { data: before } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("id", parsed.data.subscriptionId)
          .maybeSingle();

        const { error } = await supabase
          .from("subscriptions")
          .delete()
          .eq("id", parsed.data.subscriptionId);

        if (error) {
          throw new Error(error.message);
        }

        return {
          value: {},
          audit: {
            actionType: "subscription.deleted",
            category: "subscription",
            severity: "warning",
            targetEntityType: "user",
            targetEntityId: parsed.data.userId,
            beforeState: before ?? null,
          },
          revalidatePaths: [
            "/admin/users",
            `/admin/users/${parsed.data.userId}`,
            "/admin/subscriptions",
            "/admin/reviews",
            "/admin/segments",
          ],
        };
      },
    });
  } catch (error) {
    return toAdminActionError(error, "Failed to delete subscription");
  }
}

export async function updateUserStatusAction(
  userId: string,
  nextStatus: UserRow["status"],
  reason: string
): Promise<{ error?: string }> {
  if (!reason.trim()) return { error: "Reason is required" };
  try {
    return await runAdminMutation({
      permission: resolveStatusPermission(nextStatus),
      requireRecentAuth: ["active", "suspended", "banned", "soft_deleted"].includes(nextStatus),
      execute: async () => {
        const supabase = createAdminClient();
        const { data: before } = await supabase
          .from("users")
          .select("id, email, status, deleted_at")
          .eq("id", userId)
          .maybeSingle();
        if (!before) {
          throw new Error("User not found");
        }

        const payload = {
          status: nextStatus,
          deleted_at: nextStatus === "soft_deleted" ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        };

        const { error } = await supabase.from("users").update(payload).eq("id", userId);
        if (error) {
          throw new Error(error.message);
        }

        return {
          value: {},
          audit: {
            actionType: `user.status_changed.${nextStatus}`,
            category:
              nextStatus === "under_review" || nextStatus === "flagged" ? "risk" : "user",
            severity:
              nextStatus === "banned"
                ? "critical"
                : nextStatus === "suspended"
                  ? "warning"
                  : "info",
            targetEntityType: "user",
            targetEntityId: userId,
            targetSummary: before.email,
            reason,
            beforeState: before,
            afterState: payload,
          },
          revalidatePaths: [
            "/admin/users",
            `/admin/users/${userId}`,
            "/admin/subscriptions",
            "/admin/reviews",
            "/admin/segments",
          ],
        };
      },
    });
  } catch (error) {
    return toAdminActionError(error, "Failed to update user status");
  }
}

export async function runBulkUserActionAction(
  input: unknown
): Promise<{ error?: string; affectedCount?: number; jobId?: string }> {
  let parsed: ReturnType<typeof bulkJobInputSchema.parse>;
  try {
    parsed = bulkJobInputSchema.parse(input);
  } catch {
    return { error: "Invalid bulk action payload" };
  }

  try {
    return await runAdminMutation({
      permission: "bulk_actions.run",
      requireRecentAuth: true,
      execute: async (actor) => {
        const userIds = Array.from(new Set(parsed.userIds.filter(Boolean)));
        if (!userIds.length) {
          throw new Error("Select at least one user");
        }

        if (parsed.action === "add_tag" && !actor.permissions.has("tags.manage")) {
          throw new Error("Permission denied: tags.manage");
        }

        const nextStatusMap = {
          suspend: "suspended",
          reactivate: "active",
          mark_under_review: "under_review",
        } as const;

        if (
          parsed.action !== "add_tag" &&
          !actor.permissions.has(resolveStatusPermission(nextStatusMap[parsed.action]))
        ) {
          throw new Error(`Permission denied: ${resolveStatusPermission(nextStatusMap[parsed.action])}`);
        }

        const job = await createBulkJob({
          createdByAdminId: actor.id,
          jobType: `users.${parsed.action}`,
          reason: parsed.reason,
          payload: parsed as Json,
        });
        await updateBulkJobState(job.id, {
          status: "processing",
          startedAt: new Date().toISOString(),
        });

        const supabase = createAdminClient();
        let affectedCount = 0;

        try {
          if (parsed.action === "add_tag") {
            const rows = userIds.map((userId) => ({
              user_id: userId,
              tag_id: parsed.tagId,
              assigned_by_admin_id: actor.id,
            }));
            const { error } = await supabase.from("user_tag_assignments").upsert(rows);
            if (error) throw new Error(error.message);
            affectedCount = userIds.length;
          } else {
            const nextStatus = nextStatusMap[parsed.action];
            const payload = {
              status: nextStatus,
              updated_at: new Date().toISOString(),
            };
            const { error } = await supabase.from("users").update(payload).in("id", userIds);
            if (error) throw new Error(error.message);
            affectedCount = userIds.length;

            if (nextStatus === "under_review") {
              await Promise.all(
                userIds.map((userId) =>
                  upsertReviewQueueItem({
                    userId,
                    status: "under_review",
                    priority: "normal",
                    reason: parsed.reason,
                    actorAdminId: actor.id,
                  })
                )
              );
            }
          }

          const resultPayload = {
            affectedCount,
            userIds,
            action: parsed.action,
            ...(parsed.action === "add_tag" ? { tagId: parsed.tagId } : {}),
          };
          await updateBulkJobState(job.id, {
            status: "completed",
            completedAt: new Date().toISOString(),
            result: resultPayload,
          });

          return {
            value: { affectedCount, jobId: job.id },
            audit: {
              actionType:
                parsed.action === "add_tag"
                  ? "users.bulk.tag_added"
                  : `users.bulk.status_changed.${nextStatusMap[parsed.action]}`,
              category:
                parsed.action === "mark_under_review"
                  ? "risk"
                  : "bulk",
              severity:
                parsed.action === "suspend"
                  ? "warning"
                  : "info",
              targetEntityType: "bulk_job",
              targetEntityId: job.id,
              targetSummary: `${userIds.length} users`,
              reason: parsed.reason,
              afterState: resultPayload,
              metadata: { bulkJobId: job.id },
            },
            revalidatePaths: ["/admin/users", "/admin/reviews", "/admin/segments"],
          };
        } catch (error) {
          await updateBulkJobState(job.id, {
            status: "failed",
            failedAt: new Date().toISOString(),
            errorMessage: error instanceof Error ? error.message : "Unknown bulk job failure",
            result: {
              userIds,
              action: parsed.action,
            },
          });
          throw error;
        }
      },
    });
  } catch (error) {
    return toAdminActionError(error, "Failed to run bulk user action");
  }
}
