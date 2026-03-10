import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_SESSION_COOKIE,
  createSignedAdminSessionToken,
  verifySignedAdminSessionToken,
} from "@/lib/admin-auth";
import { getAdminEnv } from "@/lib/admin/env";
import { type AdminRole } from "@/lib/admin/constants";
import { isIpAllowed } from "@/lib/admin/ip-allowlist";
import { getRequestMetadata, hashToken, createOpaqueToken } from "@/lib/admin/security";
import { createAdminClient } from "@/lib/supabase/admin";

const LAST_SEEN_REFRESH_MS = 5 * 60 * 1000;

interface AdminSessionRowCompat {
  id: string;
  admin_id: string;
  token?: string | null;
  token_hash?: string | null;
  created_at: string;
  last_seen_at?: string | null;
  last_sensitive_auth_at?: string | null;
  expires_at: string;
  idle_expires_at?: string | null;
  revoked_at?: string | null;
}

interface AdminUserCompatRow {
  id: string;
  username: string;
  role: AdminRole;
  status?: string | null;
  is_active?: boolean | null;
  last_password_change_at?: string | null;
  must_reauth_after?: string | null;
  allowed_ip_cidrs?: string[] | null;
}

export interface AdminIdentity {
  id: string;
  username: string;
  role: AdminRole;
}

export interface AdminPayload {
  sub: string;
  username: string;
  role: AdminRole;
  sessionId: string;
  expiresAt: string;
  idleExpiresAt: string;
  lastSensitiveAuthAt: string | null;
  status: string;
}

export class RecentAdminAuthRequiredError extends Error {
  code = "RECENT_AUTH_REQUIRED";

  constructor() {
    super("Recent password confirmation required");
    this.name = "RecentAdminAuthRequiredError";
  }
}

export function hasRecentSensitiveAuthTimestamp(
  timestamp: string | null | undefined,
  windowMinutes: number
): boolean {
  if (!timestamp) return false;
  const parsed = Date.parse(timestamp);
  if (Number.isNaN(parsed)) return false;
  return Date.now() - parsed <= windowMinutes * 60 * 1000;
}

function buildSessionDurations(rememberMe = false) {
  const env = getAdminEnv();
  return {
    absoluteMs:
      env.ADMIN_SESSION_ABSOLUTE_HOURS * 60 * 60 * 1000 * (rememberMe ? 2 : 1),
    idleMs: env.ADMIN_SESSION_IDLE_MINUTES * 60 * 1000,
  };
}

export async function setAdminSessionCookie(
  admin: AdminIdentity,
  options?: { rememberMe?: boolean }
): Promise<void> {
  const cookieStore = await cookies();
  const supabase = createAdminClient();
  const secret = createOpaqueToken();
  const tokenHash = await hashToken(secret);
  const now = Date.now();
  const durations = buildSessionDurations(options?.rememberMe);
  const expiresAt = new Date(now + durations.absoluteMs);
  const idleExpiresAt = new Date(now + durations.idleMs);
  const request = await getRequestMetadata();

  let sessionId: string | null = null;
  const { data, error } = await supabase
    .from("admin_sessions")
    .insert({
      admin_id: admin.id,
      token_hash: tokenHash,
      expires_at: expiresAt.toISOString(),
      idle_expires_at: idleExpiresAt.toISOString(),
      last_seen_at: new Date(now).toISOString(),
      last_sensitive_auth_at: new Date(now).toISOString(),
      ip_address: request.ipAddress,
      user_agent: request.userAgent,
      device_label: request.deviceLabel,
    })
    .select("id")
    .single();

  if (!error && data?.id) {
    sessionId = data.id;
  } else {
    const legacyInsert = await supabase
      .from("admin_sessions")
      .insert({
        admin_id: admin.id,
        token: secret,
        expires_at: expiresAt.toISOString(),
        idle_expires_at: idleExpiresAt.toISOString(),
        last_seen_at: new Date(now).toISOString(),
        last_sensitive_auth_at: new Date(now).toISOString(),
      } as never)
      .select("id")
      .single();

    if (legacyInsert.error || !legacyInsert.data?.id) {
      throw new Error(
        legacyInsert.error?.message ?? error?.message ?? "Failed to create admin session"
      );
    }
    sessionId = legacyInsert.data.id;
  }

  const cookieToken = await createSignedAdminSessionToken({
    sid: sessionId,
    sub: admin.id,
    role: admin.role,
    secret,
    exp: expiresAt.getTime(),
  });

  cookieStore.set(ADMIN_SESSION_COOKIE, cookieToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: Math.floor(durations.absoluteMs / 1000),
    path: "/",
  });
}

export async function clearAdminSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE);
}

export async function revokeAdminSession(
  sessionId: string,
  reason = "manual_revocation"
): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from("admin_sessions")
    .update({
      revoked_at: new Date().toISOString(),
      revoked_reason: reason,
    })
    .eq("id", sessionId)
    .is("revoked_at", null);
}

export async function revokeAllAdminSessions(
  adminId: string,
  reason = "logout_all"
): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from("admin_sessions")
    .update({
      revoked_at: new Date().toISOString(),
      revoked_reason: reason,
    })
    .eq("admin_id", adminId)
    .is("revoked_at", null);
}

export async function getAdminSession(): Promise<AdminPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return null;

  const payload = await verifySignedAdminSessionToken(token);
  if (!payload) {
    return null;
  }

  const supabase = createAdminClient();
  const request = await getRequestMetadata();
  const { data: session } = await supabase
    .from("admin_sessions")
    .select("*")
    .eq("id", payload.sid)
    .maybeSingle();

  const sessionRecord = session as AdminSessionRowCompat | null;
  if (!sessionRecord || sessionRecord.admin_id !== payload.sub) {
    return null;
  }

  const expectedTokenHash = await hashToken(payload.secret);
  const sessionExpiresAt = sessionRecord.expires_at;
  const sessionIdleExpiresAt = sessionRecord.idle_expires_at ?? sessionRecord.expires_at;
  const tokenMatches = sessionRecord.token_hash
    ? expectedTokenHash === sessionRecord.token_hash
    : sessionRecord.token === payload.secret;
  const expired =
    sessionRecord.revoked_at ||
    new Date(sessionExpiresAt).getTime() <= Date.now() ||
    new Date(sessionIdleExpiresAt).getTime() <= Date.now() ||
    !tokenMatches;

  if (expired) {
    await revokeAdminSession(sessionRecord.id, "expired_or_invalid");
    return null;
  }

  const { data: admin } = await supabase
    .from("admin_users")
    .select("*")
    .eq("id", sessionRecord.admin_id)
    .maybeSingle();

  const adminRecord = admin as AdminUserCompatRow | null;
  const adminStatus = adminRecord?.status ?? "active";
  if (!adminRecord || adminStatus !== "active" || adminRecord.is_active === false) {
    await revokeAdminSession(sessionRecord.id, "admin_inactive");
    return null;
  }

  const sessionCreatedAt = new Date(sessionRecord.created_at).getTime();
  const invalidatedByAdminState =
    (adminRecord.last_password_change_at &&
      new Date(adminRecord.last_password_change_at).getTime() > sessionCreatedAt) ||
    (adminRecord.must_reauth_after &&
      new Date(adminRecord.must_reauth_after).getTime() > sessionCreatedAt);

  if (invalidatedByAdminState) {
    await revokeAdminSession(sessionRecord.id, "reauth_required");
    return null;
  }

  if (!isIpAllowed(request.ipAddress, adminRecord.allowed_ip_cidrs)) {
    await revokeAdminSession(sessionRecord.id, "ip_allowlist_mismatch");
    return null;
  }

  const lastSeenAt = sessionRecord.last_seen_at
    ? new Date(sessionRecord.last_seen_at).getTime()
    : 0;
  if (
    (sessionRecord.last_seen_at || sessionRecord.idle_expires_at) &&
    Date.now() - lastSeenAt > LAST_SEEN_REFRESH_MS
  ) {
    const idleMs = buildSessionDurations().idleMs;
    await supabase
      .from("admin_sessions")
      .update({
        last_seen_at: new Date().toISOString(),
        idle_expires_at: new Date(Date.now() + idleMs).toISOString(),
      })
      .eq("id", sessionRecord.id);
  }

  return {
    sub: adminRecord.id,
    username: adminRecord.username,
    role: adminRecord.role,
    sessionId: sessionRecord.id,
    expiresAt: sessionExpiresAt,
    idleExpiresAt: sessionIdleExpiresAt,
    lastSensitiveAuthAt:
      sessionRecord.last_sensitive_auth_at ?? sessionRecord.created_at ?? null,
    status: adminStatus,
  };
}

export async function requireAdminSession(): Promise<AdminPayload> {
  const session = await getAdminSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

export async function markCurrentAdminSessionSensitiveAuth(): Promise<void> {
  const session = await requireAdminSession();
  const supabase = createAdminClient();
  await supabase
    .from("admin_sessions")
    .update({ last_sensitive_auth_at: new Date().toISOString() })
    .eq("id", session.sessionId);
}

export async function requireRecentAdminAuth(): Promise<AdminPayload> {
  const session = await requireAdminSession();
  const windowMinutes = getAdminEnv().ADMIN_SENSITIVE_ACTION_WINDOW_MINUTES;
  if (!hasRecentSensitiveAuthTimestamp(session.lastSensitiveAuthAt, windowMinutes)) {
    throw new RecentAdminAuthRequiredError();
  }
  return session;
}
