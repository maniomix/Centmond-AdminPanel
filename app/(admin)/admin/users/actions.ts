"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { auditWithCurrentAdmin } from "@/lib/admin/audit";
import { requirePermission } from "@/lib/admin/permissions";
import { assertSameOriginMutation } from "@/lib/admin/security";
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

function revalidateUserAdminPaths(userId: string) {
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/subscriptions");
  revalidatePath("/admin/reviews");
  revalidatePath("/admin/segments");
}

function resolveStatusPermission(nextStatus: UserRow["status"]) {
  if (nextStatus === "suspended") return "users.suspend" as const;
  if (nextStatus === "banned") return "users.ban" as const;
  if (nextStatus === "active") return "users.reactivate" as const;
  if (nextStatus === "under_review" || nextStatus === "flagged") {
    return "reviews.manage" as const;
  }
  return "users.edit" as const;
}

export async function deleteUserAction(
  id: string,
  reason?: string
): Promise<{ error?: string }> {
  await assertSameOriginMutation();
  await requirePermission("users.soft_delete");

  const supabase = createAdminClient();
  const { data: before } = await supabase
    .from("users")
    .select("id, email, status, deleted_at")
    .eq("id", id)
    .maybeSingle();
  const { error } = await supabase
    .from("users")
    .update({
      status: "soft_deleted",
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: error.message };
  await auditWithCurrentAdmin({
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
      deleted_at: new Date().toISOString(),
    },
  });
  revalidateUserAdminPaths(id);
  return {};
}

export async function updateUserAction(
  id: string,
  values: UserUpdateValues
): Promise<{ error?: string }> {
  await assertSameOriginMutation();
  await requirePermission("users.edit");

  const supabase = createAdminClient();
  const { data: before } = await supabase
    .from("users")
    .select("id, display_name, is_email_verified, profile_image_url, profile_image, custom_categories, last_active_at")
    .eq("id", id)
    .maybeSingle();
  const afterState = {
    display_name: normalizeText(values.display_name),
    is_email_verified: values.is_email_verified,
    profile_image_url: normalizeText(values.profile_image_url),
    profile_image: normalizeText(values.profile_image),
    custom_categories: values.custom_categories ?? null,
    last_active_at: values.last_active_at ?? null,
  };
  const { error } = await supabase
    .from("users")
    .update({
      ...afterState,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: error.message };
  await auditWithCurrentAdmin({
    actionType: "user.updated",
    category: "user",
    targetEntityType: "user",
    targetEntityId: id,
    beforeState: before ?? null,
    afterState,
  });
  revalidateUserAdminPaths(id);
  return {};
}

export async function setUserVerificationAction(
  id: string,
  isVerified: boolean
): Promise<{ error?: string }> {
  await assertSameOriginMutation();
  await requirePermission("users.edit");

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("users")
    .update({
      is_email_verified: isVerified,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: error.message };
  await auditWithCurrentAdmin({
    actionType: "user.email_verification_set",
    category: "user",
    targetEntityType: "user",
    targetEntityId: id,
    afterState: { is_email_verified: isVerified },
  });

  revalidateUserAdminPaths(id);
  return {};
}

export async function setUserLastActiveNowAction(id: string): Promise<{ error?: string }> {
  await assertSameOriginMutation();
  await requirePermission("users.edit");

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("users")
    .update({
      last_active_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: error.message };
  await auditWithCurrentAdmin({
    actionType: "user.last_active_overridden",
    category: "user",
    targetEntityType: "user",
    targetEntityId: id,
    afterState: { last_active_at: new Date().toISOString() },
  });

  revalidateUserAdminPaths(id);
  return {};
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
  await assertSameOriginMutation();
  await requirePermission("subscriptions.manage");

  if (!normalizeText(values.plan) || !normalizeText(values.status)) {
    return { error: "Plan and status are required" };
  }

  const { id: subscriptionId, error: subscriptionLookupError } =
    await getLatestSubscriptionId(userId);
  if (subscriptionLookupError) return { error: subscriptionLookupError };

  const supabase = createAdminClient();
  const { data: before } = subscriptionId
    ? await supabase.from("subscriptions").select("*").eq("id", subscriptionId).maybeSingle()
    : { data: null };
  const payload = {
    plan: normalizeText(values.plan) ?? "free",
    status: normalizeText(values.status) ?? "active",
    platform: normalizeText(values.platform),
    trial_start: values.trial_start ?? null,
    trial_end: values.trial_end ?? null,
    subscription_start: values.subscription_start ?? null,
    subscription_end: values.subscription_end ?? null,
    current_period_start: values.current_period_start ?? null,
    current_period_end: values.current_period_end ?? null,
    stripe_customer_id: normalizeText(values.stripe_customer_id),
    stripe_subscription_id: normalizeText(values.stripe_subscription_id),
    apple_transaction_id: normalizeText(values.apple_transaction_id),
    updated_at: new Date().toISOString(),
  };

  const result = subscriptionId
    ? await supabase.from("subscriptions").update(payload).eq("id", subscriptionId)
    : await supabase.from("subscriptions").insert({
        user_id: userId,
        ...payload,
      });

  if (result.error) return { error: result.error.message };
  await auditWithCurrentAdmin({
    actionType: subscriptionId ? "subscription.updated" : "subscription.created",
    category: "subscription",
    targetEntityType: "user",
    targetEntityId: userId,
    beforeState: before ?? null,
    afterState: payload,
  });

  revalidateUserAdminPaths(userId);
  return {};
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
  await assertSameOriginMutation();
  await requirePermission("subscriptions.manage");

  const supabase = createAdminClient();
  const { data: before } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("id", subscriptionId)
    .maybeSingle();
  const { error } = await supabase.from("subscriptions").delete().eq("id", subscriptionId);
  if (error) return { error: error.message };

  await auditWithCurrentAdmin({
    actionType: "subscription.deleted",
    category: "subscription",
    severity: "warning",
    targetEntityType: "user",
    targetEntityId: userId,
    beforeState: before ?? null,
  });

  revalidateUserAdminPaths(userId);
  return {};
}

export async function updateUserStatusAction(
  userId: string,
  nextStatus: UserRow["status"],
  reason: string
): Promise<{ error?: string }> {
  await assertSameOriginMutation();
  if (!reason.trim()) return { error: "Reason is required" };
  await requirePermission(resolveStatusPermission(nextStatus));

  const supabase = createAdminClient();
  const { data: before } = await supabase
    .from("users")
    .select("id, email, status, deleted_at")
    .eq("id", userId)
    .maybeSingle();
  if (!before) return { error: "User not found" };

  const payload = {
    status: nextStatus,
    deleted_at: nextStatus === "soft_deleted" ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("users").update(payload).eq("id", userId);
  if (error) return { error: error.message };

  await auditWithCurrentAdmin({
    actionType: `user.status_changed.${nextStatus}`,
    category: nextStatus === "under_review" || nextStatus === "flagged" ? "risk" : "user",
    severity: nextStatus === "banned" ? "critical" : nextStatus === "suspended" ? "warning" : "info",
    targetEntityType: "user",
    targetEntityId: userId,
    targetSummary: before.email,
    reason,
    beforeState: before,
    afterState: payload,
  });

  revalidateUserAdminPaths(userId);
  return {};
}

type BulkUserActionInput =
  | {
      action: "suspend" | "reactivate" | "mark_under_review";
      userIds: string[];
      reason: string;
    }
  | {
      action: "add_tag";
      userIds: string[];
      reason: string;
      tagId: string;
    };

export async function runBulkUserActionAction(
  input: BulkUserActionInput
): Promise<{ error?: string; affectedCount?: number }> {
  await assertSameOriginMutation();
  if (!input.reason.trim()) {
    return { error: "Reason is required" };
  }

  const userIds = Array.from(new Set(input.userIds.filter(Boolean)));
  if (!userIds.length) {
    return { error: "Select at least one user" };
  }

  const supabase = createAdminClient();

  if (input.action === "add_tag") {
    await requirePermission("tags.manage");
    const tagId = input.tagId?.trim();
    if (!tagId) return { error: "Tag is required" };
    const rows = userIds.map((userId) => ({
      user_id: userId,
      tag_id: tagId,
    }));
    const { error } = await supabase.from("user_tag_assignments").upsert(rows);
    if (error) return { error: error.message };

    await auditWithCurrentAdmin({
      actionType: "users.bulk.tag_added",
      category: "bulk",
      targetEntityType: "user_batch",
      targetSummary: `${userIds.length} users`,
      reason: input.reason,
      afterState: { tagId, userIds },
      metadata: { affectedCount: userIds.length },
    });

    revalidatePath("/admin/users");
    revalidatePath("/admin/segments");
    return { affectedCount: userIds.length };
  }

  const nextStatusMap = {
    suspend: "suspended",
    reactivate: "active",
    mark_under_review: "under_review",
  } as const;

  const nextStatus = nextStatusMap[input.action];
  await requirePermission(resolveStatusPermission(nextStatus));
  const payload = {
    status: nextStatus,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("users").update(payload).in("id", userIds);
  if (error) return { error: error.message };

  await auditWithCurrentAdmin({
    actionType: `users.bulk.status_changed.${nextStatus}`,
    category: input.action === "mark_under_review" ? "risk" : "bulk",
    severity: nextStatus === "suspended" ? "warning" : "info",
    targetEntityType: "user_batch",
    targetSummary: `${userIds.length} users`,
    reason: input.reason,
    afterState: { status: nextStatus, userIds },
    metadata: { affectedCount: userIds.length },
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin/reviews");
  revalidatePath("/admin/segments");
  return { affectedCount: userIds.length };
}
