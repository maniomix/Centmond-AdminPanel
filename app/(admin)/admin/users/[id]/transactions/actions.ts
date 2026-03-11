"use server";

import { toStoredMoney } from "@/lib/money";
import { runAdminMutation, toAdminActionError } from "@/lib/admin/mutations";
import {
  createTransactionSchema,
  deleteTransactionSchema,
  updateTransactionSchema,
} from "@/lib/admin/schemas/hardening";
import { createAdminClient } from "@/lib/supabase/admin";

function transactionWritePermissions() {
  return ["finance.manage", "billing.refunds.issue", "subscriptions.manage"] as const;
}

function transactionPaths(userId: string) {
  return [`/admin/users/${userId}/transactions`, `/admin/users/${userId}`];
}

export async function deleteTransactionAction(
  id: string,
  userId: string
): Promise<{ error?: string }> {
  const parsed = deleteTransactionSchema.safeParse({ id, userId });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid transaction delete request" };
  }

  try {
    return await runAdminMutation({
      anyPermissions: [...transactionWritePermissions()],
      requireRecentAuth: true,
      execute: async () => {
        const supabase = createAdminClient();
        const { data: before } = await supabase
          .from("transactions")
          .select("*")
          .eq("id", parsed.data.id)
          .maybeSingle();

        const { error } = await supabase
          .from("transactions")
          .update({ is_deleted: true, updated_at: new Date().toISOString() })
          .eq("id", parsed.data.id);

        if (error) {
          throw new Error(error.message);
        }

        return {
          value: {},
          audit: {
            actionType: "transaction.deleted",
            category: "billing",
            severity: "warning",
            targetEntityType: "transaction",
            targetEntityId: parsed.data.id,
            targetSummary: before?.category ?? parsed.data.id,
            beforeState: before ?? null,
            afterState: { is_deleted: true },
          },
          revalidatePaths: transactionPaths(parsed.data.userId),
        };
      },
    });
  } catch (error) {
    return toAdminActionError(error, "Failed to delete transaction");
  }
}

export async function updateTransactionAction(
  id: string,
  userId: string,
  values: {
    amount: unknown;
    type: string;
    category: string;
    note?: string | null;
    date: string;
  }
): Promise<{ error?: string }> {
  const parsed = updateTransactionSchema.safeParse({ id, userId, values });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid transaction update" };
  }

  try {
    return await runAdminMutation({
      anyPermissions: [...transactionWritePermissions()],
      requireRecentAuth: true,
      execute: async () => {
        const supabase = createAdminClient();
        const { data: before } = await supabase
          .from("transactions")
          .select("*")
          .eq("id", parsed.data.id)
          .maybeSingle();

        const payload = {
          ...parsed.data.values,
          amount: toStoredMoney(parsed.data.values.amount),
          note: parsed.data.values.note ?? null,
          updated_at: new Date().toISOString(),
        };

        const { error } = await supabase
          .from("transactions")
          .update(payload)
          .eq("id", parsed.data.id);

        if (error) {
          throw new Error(error.message);
        }

        return {
          value: {},
          audit: {
            actionType: "transaction.updated",
            category: "billing",
            targetEntityType: "transaction",
            targetEntityId: parsed.data.id,
            targetSummary: parsed.data.values.category,
            beforeState: before ?? null,
            afterState: payload,
          },
          revalidatePaths: transactionPaths(parsed.data.userId),
        };
      },
    });
  } catch (error) {
    return toAdminActionError(error, "Failed to update transaction");
  }
}

export async function createTransactionAction(
  userId: string,
  values: {
    amount: unknown;
    type: string;
    category: string;
    note?: string | null;
    date: string;
  }
): Promise<{ error?: string }> {
  const parsed = createTransactionSchema.safeParse({ userId, values });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid transaction payload" };
  }

  try {
    return await runAdminMutation({
      anyPermissions: [...transactionWritePermissions()],
      requireRecentAuth: true,
      execute: async () => {
        const supabase = createAdminClient();
        const payload = {
          user_id: parsed.data.userId,
          is_deleted: false,
          ...parsed.data.values,
          amount: toStoredMoney(parsed.data.values.amount),
          note: parsed.data.values.note ?? null,
        };

        const { data, error } = await supabase
          .from("transactions")
          .insert(payload)
          .select("id")
          .single();

        if (error || !data) {
          throw new Error(error?.message ?? "Failed to create transaction");
        }

        return {
          value: {},
          audit: {
            actionType: "transaction.created",
            category: "billing",
            targetEntityType: "transaction",
            targetEntityId: data.id,
            targetSummary: parsed.data.values.category,
            afterState: payload,
          },
          revalidatePaths: transactionPaths(parsed.data.userId),
        };
      },
    });
  } catch (error) {
    return toAdminActionError(error, "Failed to create transaction");
  }
}
