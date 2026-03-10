import { createAdminClient } from "@/lib/supabase/admin";
import { fromStoredMoney } from "@/lib/money";

export async function getFinanceOverview() {
  const supabase = createAdminClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const [
    { data: subscriptions },
    { data: transactions },
    { data: financeEvents },
    { data: financeNotes },
  ] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("id, user_id, plan, status, platform, current_period_end, updated_at")
      .order("updated_at", { ascending: false })
      .limit(12),
    supabase
      .from("transactions")
      .select("id, user_id, amount, type, category, note, date, created_at")
      .eq("is_deleted", false)
      .gte("date", thirtyDaysAgo)
      .order("date", { ascending: false })
      .limit(100),
    supabase
      .from("finance_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("user_notes")
      .select("id, user_id, body, created_at")
      .eq("note_type", "finance")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const activePaidSubscriptions = (subscriptions ?? []).filter(
    (row) => row.plan !== "free" && ["active", "trialing", "past_due"].includes(row.status)
  ).length;
  const pastDueSubscriptions = (subscriptions ?? []).filter(
    (row) => row.status === "past_due"
  ).length;
  const refundsRecorded30d = (financeEvents ?? []).filter(
    (row) => row.event_type === "refund_recorded"
  ).length;
  const netRevenue30d = (transactions ?? []).reduce((sum, row) => {
    const amount = fromStoredMoney(Number(row.amount ?? 0));
    return row.type === "income" ? sum + amount : sum - amount;
  }, 0);

  return {
    metrics: {
      activePaidSubscriptions,
      pastDueSubscriptions,
      refundsRecorded30d,
      netRevenue30d,
    },
    subscriptions: subscriptions ?? [],
    transactions: transactions ?? [],
    financeEvents: financeEvents ?? [],
    financeNotes: financeNotes ?? [],
  };
}

export async function recordFinanceEvent(input: {
  actorAdminId: string;
  userId?: string | null;
  subscriptionId?: string | null;
  transactionId?: string | null;
  eventType: string;
  status: "recorded" | "pending_provider_action" | "resolved" | "cancelled";
  amount?: number | null;
  currency: string;
  provider?: string | null;
  referenceId?: string | null;
  reason: string;
  note?: string | null;
}) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("finance_events")
    .insert({
      actor_admin_id: input.actorAdminId,
      user_id: input.userId ?? null,
      subscription_id: input.subscriptionId ?? null,
      transaction_id: input.transactionId ?? null,
      event_type: input.eventType,
      status: input.status,
      amount: input.amount ?? null,
      currency: input.currency,
      provider: input.provider ?? null,
      reference_id: input.referenceId ?? null,
      reason: input.reason,
      note: input.note ?? null,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to record finance event");
  }

  return data;
}
