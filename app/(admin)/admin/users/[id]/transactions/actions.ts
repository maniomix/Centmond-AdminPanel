"use server";

import { revalidatePath } from "next/cache";
import { toStoredMoney } from "@/lib/money";
import { auditWithCurrentAdmin } from "@/lib/admin/audit";
import { requireAnyPermission } from "@/lib/admin/permissions";
import { assertSameOriginMutation } from "@/lib/admin/security";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TransactionRow } from "@/types";

async function requireTransactionWriteAccess() {
  await assertSameOriginMutation();
  await requireAnyPermission(["billing.refunds.issue", "subscriptions.manage"]);
}

export async function deleteTransactionAction(
  id: string,
  userId: string
): Promise<{ error?: string }> {
  await requireTransactionWriteAccess();

  const supabase = createAdminClient();
  const { data: before } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  const { error } = await supabase
    .from("transactions")
    .update({ is_deleted: true, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };

  await auditWithCurrentAdmin({
    actionType: "transaction.deleted",
    category: "billing",
    severity: "warning",
    targetEntityType: "transaction",
    targetEntityId: id,
    targetSummary: before?.category ?? id,
    beforeState: before ?? null,
    afterState: { is_deleted: true },
  });

  revalidatePath(`/admin/users/${userId}/transactions`);
  revalidatePath(`/admin/users/${userId}`);
  return {};
}

export async function updateTransactionAction(
  id: string,
  userId: string,
  values: Pick<
    TransactionRow,
    "amount" | "type" | "category" | "note" | "date"
  >
): Promise<{ error?: string }> {
  await requireTransactionWriteAccess();

  const supabase = createAdminClient();
  const { data: before } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  const payload = {
    ...values,
    amount: toStoredMoney(Number(values.amount)),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("transactions").update(payload).eq("id", id);
  if (error) return { error: error.message };

  await auditWithCurrentAdmin({
    actionType: "transaction.updated",
    category: "billing",
    targetEntityType: "transaction",
    targetEntityId: id,
    targetSummary: values.category,
    beforeState: before ?? null,
    afterState: payload,
  });

  revalidatePath(`/admin/users/${userId}/transactions`);
  revalidatePath(`/admin/users/${userId}`);
  return {};
}

export async function createTransactionAction(
  userId: string,
  values: Pick<
    TransactionRow,
    "amount" | "type" | "category" | "note" | "date"
  >
): Promise<{ error?: string }> {
  await requireTransactionWriteAccess();

  const supabase = createAdminClient();
  const payload = {
    user_id: userId,
    is_deleted: false,
    ...values,
    amount: toStoredMoney(Number(values.amount)),
  };
  const { data, error } = await supabase
    .from("transactions")
    .insert(payload)
    .select("id")
    .single();
  if (error) return { error: error.message };

  await auditWithCurrentAdmin({
    actionType: "transaction.created",
    category: "billing",
    targetEntityType: "transaction",
    targetEntityId: data.id,
    targetSummary: values.category,
    afterState: payload,
  });

  revalidatePath(`/admin/users/${userId}/transactions`);
  revalidatePath(`/admin/users/${userId}`);
  return {};
}
