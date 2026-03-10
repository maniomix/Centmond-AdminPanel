import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminEnv } from "@/lib/admin/env";
import { writeAdminAuditLog } from "@/lib/admin/audit";
import { isIpAllowed } from "@/lib/admin/ip-allowlist";
import { getRequestMetadata } from "@/lib/admin/security";
import type { AdminRole } from "@/lib/admin/constants";

interface AdminLoginRpcResponse {
  success?: boolean;
  error?: string;
  admin?: {
    id?: string;
    username?: string;
    role?: string;
  };
}

export interface AuthenticatedAdmin {
  id: string;
  username: string;
  role: AdminRole;
}

interface AuthenticateAdminResult {
  admin?: AuthenticatedAdmin;
  error?: string;
}

interface AdminLoginLookupRecord {
  id: string;
  username: string;
  role: string;
  is_active?: boolean | null;
  status?: string | null;
  allowed_ip_cidrs?: string[] | null;
  last_login_ip?: string | null;
  last_login_user_agent?: string | null;
  failed_login_count?: number | null;
  last_failed_login_at?: string | null;
}

function normalizeIdentifier(identifier: string): string {
  return identifier.trim().toLowerCase();
}

async function loadAdminRecordForLogin(
  identifier: string
): Promise<AdminLoginLookupRecord | null> {
  const supabase = createAdminClient();

  const primaryLookup = await supabase
    .from("admin_users")
    .select("*")
    .or(`username.eq.${identifier},email.eq.${identifier}`)
    .limit(1)
    .maybeSingle();

  if (!primaryLookup.error && primaryLookup.data) {
    return primaryLookup.data as AdminLoginLookupRecord;
  }

  const fallbackLookup = await supabase
    .from("admin_users")
    .select("*")
    .eq("username", identifier)
    .limit(1)
    .maybeSingle();

  if (fallbackLookup.error || !fallbackLookup.data) return null;
  return fallbackLookup.data as AdminLoginLookupRecord;
}

function isAdminAccountActive(adminRecord: AdminLoginLookupRecord | null): boolean {
  if (!adminRecord) return false;
  const status = adminRecord.status ?? "active";
  return status === "active" && adminRecord.is_active !== false;
}

async function recordLoginAttempt(input: {
  adminId?: string | null;
  identifier: string;
  success: boolean;
  failureReason?: string | null;
}) {
  const supabase = createAdminClient();
  const request = await getRequestMetadata();
  await supabase.from("admin_login_attempts").insert({
    admin_id: input.adminId ?? null,
    identifier: input.identifier,
    success: input.success,
    failure_reason: input.failureReason ?? null,
    ip_address: request.ipAddress,
    user_agent: request.userAgent,
  });
}

async function checkRateLimit(identifier: string, ipAddress: string | null) {
  const env = getAdminEnv();
  const supabase = createAdminClient();
  const since = new Date(
    Date.now() - env.ADMIN_LOGIN_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000
  ).toISOString();

  const query = supabase
    .from("admin_login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("success", false)
    .gte("created_at", since)
    .eq("identifier", identifier);

  const [{ count: identifierFailures }, { count: ipFailures }] = await Promise.all([
    query,
    ipAddress
      ? supabase
          .from("admin_login_attempts")
          .select("id", { count: "exact", head: true })
          .eq("success", false)
          .gte("created_at", since)
          .eq("ip_address", ipAddress)
      : Promise.resolve({ count: 0 }),
  ]);

  return (
    (identifierFailures ?? 0) >= env.ADMIN_LOGIN_RATE_LIMIT_MAX_ATTEMPTS ||
    (ipFailures ?? 0) >= env.ADMIN_LOGIN_RATE_LIMIT_MAX_ATTEMPTS
  );
}

function normalizeError(error?: string): string {
  return error?.trim() || "Invalid admin credentials";
}

export async function authenticateAdmin(
  identifier: string,
  password: string
): Promise<AuthenticateAdminResult> {
  const normalizedIdentifier = normalizeIdentifier(identifier);
  if (!normalizedIdentifier || !password) {
    return { error: "Username or email and password are required" };
  }

  const request = await getRequestMetadata();
  const rateLimited = await checkRateLimit(normalizedIdentifier, request.ipAddress);
  if (rateLimited) {
    await writeAdminAuditLog({
      actionType: "admin.login.rate_limited",
      category: "auth",
      severity: "warning",
      targetEntityType: "admin_login",
      targetSummary: normalizedIdentifier,
      metadata: { identifier: normalizedIdentifier, ipAddress: request.ipAddress },
    });
    return { error: "Too many failed attempts. Try again later." };
  }

  const supabase = createAdminClient();
  const adminRecord = await loadAdminRecordForLogin(normalizedIdentifier);

  if (!adminRecord || !isAdminAccountActive(adminRecord)) {
    await recordLoginAttempt({
      identifier: normalizedIdentifier,
      success: false,
      adminId: adminRecord?.id ?? null,
      failureReason: adminRecord ? "inactive_admin" : "invalid_credentials",
    });
    await writeAdminAuditLog({
      actionType: "admin.login.failed",
      category: "auth",
      severity: "warning",
      actorAdminId: adminRecord?.id ?? null,
      actorRole: adminRecord?.role ?? null,
      targetEntityType: "admin_user",
      targetEntityId: adminRecord?.id ?? null,
      targetSummary: normalizedIdentifier,
      metadata: { identifier: normalizedIdentifier, reason: "inactive_or_invalid" },
    });
    return { error: "Invalid admin credentials" };
  }

  if (!isIpAllowed(request.ipAddress, adminRecord.allowed_ip_cidrs)) {
    await recordLoginAttempt({
      identifier: normalizedIdentifier,
      success: false,
      adminId: adminRecord.id,
      failureReason: "ip_not_allowed",
    });
    await writeAdminAuditLog({
      actionType: "admin.login.ip_denied",
      category: "security",
      severity: "warning",
      actorAdminId: adminRecord.id,
      actorRole: adminRecord.role,
      targetEntityType: "admin_user",
      targetEntityId: adminRecord.id,
      targetSummary: adminRecord.username,
      metadata: {
        identifier: normalizedIdentifier,
        ipAddress: request.ipAddress,
        allowedIpCidrs: adminRecord.allowed_ip_cidrs ?? [],
      },
    });
    return { error: "This network is not allowed for the selected admin account" };
  }

  const { data, error } = await supabase.rpc("admin_login", {
    p_username: adminRecord.username,
    p_password: password,
  });

  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    await recordLoginAttempt({
      identifier: normalizedIdentifier,
      success: false,
      adminId: adminRecord.id,
      failureReason: "invalid_credentials",
    });
    await supabase
      .from("admin_users")
      .update({
        ...("failed_login_count" in adminRecord
          ? {
              failed_login_count: adminRecord.failed_login_count
                ? adminRecord.failed_login_count + 1
                : 1,
            }
          : {}),
        ...("last_failed_login_at" in adminRecord
          ? { last_failed_login_at: new Date().toISOString() }
          : {}),
      })
      .eq("id", adminRecord.id);
    await writeAdminAuditLog({
      actionType: "admin.login.failed",
      category: "auth",
      severity: "warning",
      actorAdminId: adminRecord.id,
      actorRole: adminRecord.role,
      targetEntityType: "admin_user",
      targetEntityId: adminRecord.id,
      targetSummary: adminRecord.username,
      metadata: { identifier: normalizedIdentifier, reason: "invalid_credentials" },
    });
    return { error: "Invalid admin credentials" };
  }

  const result = data as AdminLoginRpcResponse;
  if (!result.success || !result.admin?.id || !result.admin.username || !result.admin.role) {
    await recordLoginAttempt({
      identifier: normalizedIdentifier,
      success: false,
      adminId: adminRecord.id,
      failureReason: normalizeError(result.error),
    });
    return { error: normalizeError(result.error) };
  }

  const suspiciousLogin =
    (adminRecord.last_login_ip && adminRecord.last_login_ip !== request.ipAddress) ||
    (adminRecord.last_login_user_agent &&
      adminRecord.last_login_user_agent !== request.userAgent);

  await recordLoginAttempt({
    identifier: normalizedIdentifier,
    success: true,
    adminId: adminRecord.id,
  });
  await supabase
    .from("admin_users")
    .update({
      ...("failed_login_count" in adminRecord ? { failed_login_count: 0 } : {}),
      ...("last_failed_login_at" in adminRecord ? { last_failed_login_at: null } : {}),
      last_login_at: new Date().toISOString(),
      ...("last_login_ip" in adminRecord ? { last_login_ip: request.ipAddress } : {}),
      ...("last_login_user_agent" in adminRecord
        ? { last_login_user_agent: request.userAgent }
        : {}),
    })
    .eq("id", adminRecord.id);

  await writeAdminAuditLog({
    actionType: suspiciousLogin ? "admin.login.suspicious" : "admin.login.success",
    category: "auth",
    severity: suspiciousLogin ? "warning" : "info",
    actorAdminId: adminRecord.id,
    actorRole: adminRecord.role,
    targetEntityType: "admin_user",
    targetEntityId: adminRecord.id,
    targetSummary: adminRecord.username,
    metadata: {
      identifier: normalizedIdentifier,
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
      suspiciousLogin,
    },
  });

  return {
    admin: {
      id: result.admin.id,
      username: result.admin.username,
      role: result.admin.role as AdminRole,
    },
  };
}
