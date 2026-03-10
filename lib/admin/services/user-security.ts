import { createAdminClient } from "@/lib/supabase/admin";

export async function listUserSecurityData(userId: string) {
  const supabase = createAdminClient();
  const [{ data: devices }, { data: sessions }] = await Promise.all([
    supabase
      .from("user_devices")
      .select("*")
      .eq("user_id", userId)
      .order("last_seen_at", { ascending: false })
      .limit(20),
    supabase
      .from("user_sessions")
      .select("*")
      .eq("user_id", userId)
      .order("last_seen_at", { ascending: false })
      .limit(20),
  ]);

  return {
    devices: devices ?? [],
    sessions: sessions ?? [],
  };
}

export async function revokeUserSession(input: {
  sessionId: string;
  actorAdminId: string;
  reason: string;
}) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("user_sessions")
    .update({
      status: "revoked",
      revoked_at: new Date().toISOString(),
      revoked_reason: input.reason,
      revoked_by_admin_id: input.actorAdminId,
      require_reauth: true,
    })
    .eq("id", input.sessionId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function revokeAllUserSessions(input: {
  userId: string;
  actorAdminId: string;
  reason: string;
}) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("user_sessions")
    .update({
      status: "revoked",
      revoked_at: new Date().toISOString(),
      revoked_reason: input.reason,
      revoked_by_admin_id: input.actorAdminId,
      require_reauth: true,
    })
    .eq("user_id", input.userId)
    .in("status", ["active", "suspicious"]);

  if (error) {
    throw new Error(error.message);
  }
}

export async function markUserDeviceSuspicious(input: {
  deviceId: string;
  isSuspicious: boolean;
}) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("user_devices")
    .update({
      is_suspicious: input.isSuspicious,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.deviceId);

  if (error) {
    throw new Error(error.message);
  }
}
