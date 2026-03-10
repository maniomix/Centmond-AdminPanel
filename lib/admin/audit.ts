import { createAdminClient } from "@/lib/supabase/admin";
import { getRequestMetadata } from "@/lib/admin/security";
import { getAdminSession } from "@/lib/admin-session";
import type { Json } from "@/types/database";
import { classifyAuditWriteFailure } from "./audit-utils";

export type AdminAuditCategory =
  | "auth"
  | "admin"
  | "user"
  | "subscription"
  | "billing"
  | "support"
  | "risk"
  | "search"
  | "export"
  | "config"
  | "security"
  | "bulk";

export type AdminAuditSeverity = "info" | "warning" | "critical";

export interface WriteAdminAuditLogInput {
  actorAdminId?: string | null;
  actorRole?: string | null;
  actionType: string;
  category: AdminAuditCategory;
  severity?: AdminAuditSeverity;
  targetEntityType?: string | null;
  targetEntityId?: string | null;
  targetSummary?: string | null;
  reason?: string | null;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  approvedByAdminId?: string | null;
  approvedAt?: string | null;
}

export class AdminAuditWriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminAuditWriteError";
  }
}

let hasWarnedAboutMissingAuditTable = false;

export async function writeAdminAuditLog(
  input: WriteAdminAuditLogInput,
  options?: { required?: boolean }
): Promise<void> {
  const supabase = createAdminClient();
  const request = await getRequestMetadata();
  const payload = {
    actor_admin_id: input.actorAdminId ?? null,
    actor_role: input.actorRole ?? null,
    action_type: input.actionType,
    category: input.category,
    severity: input.severity ?? "info",
    target_entity_type: input.targetEntityType ?? null,
    target_entity_id: input.targetEntityId ?? null,
    target_summary: input.targetSummary ?? null,
    reason: input.reason ?? null,
    before_state: (input.beforeState ?? null) as Json | null,
    after_state: (input.afterState ?? null) as Json | null,
    metadata: (input.metadata ?? null) as Json | null,
    approved_by_admin_id: input.approvedByAdminId ?? null,
    approved_at: input.approvedAt ?? null,
    ip_address: request.ipAddress,
    user_agent: request.userAgent,
    request_id: request.requestId,
  } satisfies {
    actor_admin_id?: string | null;
    actor_role?: string | null;
    action_type: string;
    category: AdminAuditCategory;
    severity?: AdminAuditSeverity;
    target_entity_type?: string | null;
    target_entity_id?: string | null;
    target_summary?: string | null;
    reason?: string | null;
    before_state?: Json | null;
    after_state?: Json | null;
    metadata?: Json | null;
    approved_by_admin_id?: string | null;
    approved_at?: string | null;
    ip_address?: string | null;
    user_agent?: string | null;
    request_id?: string | null;
  };

  const { error } = await supabase.from("admin_audit_logs").insert(payload);

  if (error) {
    const failureMode = classifyAuditWriteFailure(error.message, options);

    if (failureMode === "throw") {
      throw new AdminAuditWriteError(error.message);
    }

    if (failureMode === "skip") {
      if (!hasWarnedAboutMissingAuditTable && process.env.NODE_ENV !== "production") {
        hasWarnedAboutMissingAuditTable = true;
        console.warn(
          "Skipping optional admin audit log writes because 'admin_audit_logs' is missing."
        );
      }
      return;
    }

    console.warn("Failed to write optional admin audit log:", error.message);
  }
}

export async function auditWithCurrentAdmin(
  input: Omit<WriteAdminAuditLogInput, "actorAdminId" | "actorRole">,
  options?: { required?: boolean }
) {
  const session = await getAdminSession();
  await writeAdminAuditLog({
    ...input,
    actorAdminId: session?.sub ?? null,
    actorRole: session?.role ?? null,
  }, options);
}
