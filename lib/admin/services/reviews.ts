import { createAdminClient } from "@/lib/supabase/admin";

export async function listReviewQueueData() {
  const supabase = createAdminClient();
  const [
    { data: queueItems },
    { data: users },
    { data: flags },
    { data: activeAssignments },
  ] = await Promise.all([
    supabase
      .from("review_queue_items")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(500),
    supabase
      .from("users")
      .select("id, email, display_name, status, risk_score, risk_status, last_active_at, created_at"),
    supabase.from("user_flags").select("id, label"),
    supabase
      .from("user_flag_assignments")
      .select("user_id, flag_id, status")
      .eq("status", "active"),
  ]);

  const usersById = new Map((users ?? []).map((user) => [user.id, user]));
  const flagLabelsById = new Map((flags ?? []).map((flag) => [flag.id, flag.label]));
  const activeFlagsByUserId = new Map<string, string[]>();

  for (const assignment of activeAssignments ?? []) {
    const label = flagLabelsById.get(assignment.flag_id);
    if (!label) continue;
    const current = activeFlagsByUserId.get(assignment.user_id) ?? [];
    current.push(label);
    activeFlagsByUserId.set(assignment.user_id, current);
  }

  return (queueItems ?? [])
    .map((item) => {
      const user = usersById.get(item.user_id);
      if (!user) return null;
      return {
        ...item,
        user,
        activeFlags: activeFlagsByUserId.get(item.user_id) ?? [],
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
}

export async function upsertReviewQueueItem(input: {
  userId: string;
  status:
    | "under_review"
    | "escalated"
    | "approved"
    | "rejected"
    | "restricted"
    | "false_positive"
    | "resolved";
  priority: string;
  reason: string;
  actorAdminId: string;
  assignedToAdminId?: string | null;
}) {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("review_queue_items")
    .upsert({
      user_id: input.userId,
      status: input.status,
      priority: input.priority,
      latest_reason: input.reason,
      created_by_admin_id: input.actorAdminId,
      assigned_to_admin_id: input.assignedToAdminId ?? null,
      last_decided_by_admin_id: input.actorAdminId,
      last_decided_at: now,
      resolved_at:
        input.status === "resolved" ||
        input.status === "approved" ||
        input.status === "false_positive"
          ? now
          : null,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to update review queue item");
  }

  return data;
}

export async function createSupportHandoff(input: {
  userId: string;
  fromAdminId: string;
  toAdminId?: string | null;
  priority: string;
  summary: string;
  details?: string | null;
}) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("support_handoffs")
    .insert({
      user_id: input.userId,
      from_admin_id: input.fromAdminId,
      to_admin_id: input.toAdminId ?? null,
      priority: input.priority,
      summary: input.summary,
      details: input.details ?? null,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create support handoff");
  }

  return data;
}

export async function listSupportHandoffsForUser(userId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("support_handoffs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}
