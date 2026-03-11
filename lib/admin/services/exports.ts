import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingTableError } from "@/lib/admin/table-error-utils";
import { formatDate } from "@/lib/utils";

function escapeCsvCell(value: unknown): string {
  const stringValue =
    value === null || value === undefined ? "" : typeof value === "string" ? value : String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function buildCsv(headers: string[], rows: Array<Record<string, unknown>>): string {
  const headerLine = headers.map((header) => escapeCsvCell(header)).join(",");
  const body = rows
    .map((row) => headers.map((header) => escapeCsvCell(row[header])).join(","))
    .join("\n");
  return `${headerLine}\n${body}`;
}

async function queryExportRows(scope: "users" | "subscriptions" | "audit_logs" | "review_queue") {
  const supabase = createAdminClient();

  if (scope === "users") {
    const { data, error } = await supabase
      .from("users")
      .select("id, email, display_name, status, is_email_verified, created_at, last_active_at")
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) throw new Error(error.message);
    return {
      rows: (data ?? []).map((row) => ({
        id: row.id,
        email: row.email,
        display_name: row.display_name ?? "",
        status: row.status,
        is_email_verified: row.is_email_verified,
        created_at: row.created_at,
        last_active_at: row.last_active_at ?? "",
      })),
      fileName: `users-export-${Date.now()}.csv`,
    };
  }

  if (scope === "subscriptions") {
    const { data, error } = await supabase
      .from("subscriptions")
      .select("id, user_id, plan, status, platform, current_period_end, updated_at")
      .order("updated_at", { ascending: false })
      .limit(2000);
    if (error) throw new Error(error.message);
    return {
      rows: (data ?? []).map((row) => ({
        id: row.id,
        user_id: row.user_id,
        plan: row.plan,
        status: row.status,
        platform: row.platform ?? "",
        current_period_end: row.current_period_end ?? "",
        updated_at: row.updated_at,
      })),
      fileName: `subscriptions-export-${Date.now()}.csv`,
    };
  }

  if (scope === "audit_logs") {
    const { data, error } = await supabase
      .from("admin_audit_logs")
      .select("id, action_type, category, severity, target_entity_type, target_entity_id, reason, created_at")
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) throw new Error(error.message);
    return {
      rows: (data ?? []).map((row) => ({
        id: row.id,
        action_type: row.action_type,
        category: row.category,
        severity: row.severity,
        target_entity_type: row.target_entity_type ?? "",
        target_entity_id: row.target_entity_id ?? "",
        reason: row.reason ?? "",
        created_at: row.created_at,
      })),
      fileName: `audit-export-${Date.now()}.csv`,
    };
  }

  const { data, error } = await supabase
    .from("review_queue_items")
    .select("id, user_id, status, priority, latest_reason, opened_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(2000);
  if (error) throw new Error(error.message);
  return {
    rows: (data ?? []).map((row) => ({
      id: row.id,
      user_id: row.user_id,
      status: row.status,
      priority: row.priority,
      latest_reason: row.latest_reason ?? "",
      opened_at: row.opened_at,
      updated_at: row.updated_at,
    })),
    fileName: `review-queue-export-${Date.now()}.csv`,
  };
}

export async function listExportJobs(limit = 20) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("export_jobs")
    .select("id, export_type, target_scope, status, format, row_count, file_name, reason, created_at, completed_at, error_message")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (isMissingTableError(error.message, "export_jobs")) {
      return [];
    }
    throw new Error(error.message);
  }
  return data ?? [];
}

export async function createAndRunExportJob(input: {
  createdByAdminId: string;
  exportType: string;
  targetScope: "users" | "subscriptions" | "audit_logs" | "review_queue";
  format: "csv";
  reason: string;
  filters?: Record<string, string>;
}) {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const { data: job, error: createError } = await supabase
    .from("export_jobs")
    .insert({
      created_by_admin_id: input.createdByAdminId,
      export_type: input.exportType,
      target_scope: input.targetScope,
      status: "queued",
      format: input.format,
      reason: input.reason,
      filters: input.filters ?? {},
    })
    .select("*")
    .single();

  if (createError || !job) {
    throw new Error(createError?.message ?? "Failed to create export job");
  }

  await supabase
    .from("export_jobs")
    .update({ status: "processing", started_at: now })
    .eq("id", job.id);

  try {
    const { rows, fileName } = await queryExportRows(input.targetScope);
    const headers = Object.keys(rows[0] ?? { id: "id" });
    const content = buildCsv(headers, rows);
    const completedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { error: completeError } = await supabase
      .from("export_jobs")
      .update({
        status: "completed",
        row_count: rows.length,
        file_name: fileName,
        content,
        metadata: {
          generated_at: formatDate(completedAt),
          headers,
        },
        completed_at: completedAt,
        expires_at: expiresAt,
      })
      .eq("id", job.id);

    if (completeError) {
      throw new Error(completeError.message);
    }

    return { jobId: job.id, rowCount: rows.length, fileName };
  } catch (error) {
    await supabase
      .from("export_jobs")
      .update({
        status: "failed",
        failed_at: new Date().toISOString(),
        error_message: error instanceof Error ? error.message : "Unknown export failure",
      })
      .eq("id", job.id);
    throw error;
  }
}

export async function getExportJobContent(jobId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("export_jobs")
    .select("id, status, file_name, format, content, expires_at")
    .eq("id", jobId)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error.message, "export_jobs")) {
      return null;
    }
    throw new Error(error.message);
  }

  return data;
}
