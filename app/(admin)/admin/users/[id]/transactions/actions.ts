"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageData, getAdminSession } from "@/lib/admin-session";
import type { TransactionRow } from "@/types";
import { toStoredMoney } from "@/lib/money";

async function requireWriteAccess(): Promise<{ error?: string }> {
  const session = await getAdminSession();
  if (!session) return { error: "Unauthorized" };
  if (!canManageData(session.role)) return { error: "Permission denied" };
  return {};
}

export async function deleteTransactionAction(
  id: string,
  userId: string
): Promise<{ error?: string }> {
  const auth = await requireWriteAccess();
  if (auth.error) return auth;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("transactions")
    .update({ is_deleted: true, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/admin/users/${userId}/transactions`);
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
  const auth = await requireWriteAccess();
  if (auth.error) return auth;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("transactions")
    .update({
      ...values,
      amount: toStoredMoney(Number(values.amount)),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/admin/users/${userId}/transactions`);
  return {};
}

export async function createTransactionAction(
  userId: string,
  values: Pick<
    TransactionRow,
    "amount" | "type" | "category" | "note" | "date"
  >
): Promise<{ error?: string }> {
  const auth = await requireWriteAccess();
  if (auth.error) return auth;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("transactions")
    .insert({
      user_id: userId,
      is_deleted: false,
      ...values,
      amount: toStoredMoney(Number(values.amount)),
    });
  if (error) return { error: error.message };
  revalidatePath(`/admin/users/${userId}/transactions`);
  return {};
}
