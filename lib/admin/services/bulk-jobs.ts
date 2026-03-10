import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

export async function createBulkJob(input: {
  createdByAdminId: string;
  jobType: string;
  reason: string;
  targetScope?: string;
  payload: Json;
}) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("bulk_jobs")
    .insert({
      created_by_admin_id: input.createdByAdminId,
      job_type: input.jobType,
      target_scope: input.targetScope ?? "users",
      reason: input.reason,
      input: input.payload,
      status: "queued",
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create bulk job");
  }

  return data;
}

export async function updateBulkJobState(
  jobId: string,
  input:
    | { status: "processing"; startedAt: string }
    | { status: "completed" | "partially_completed"; completedAt: string; result: Json }
    | { status: "failed"; failedAt: string; errorMessage: string; result?: Json | null }
) {
  const supabase = createAdminClient();

  const payload =
    input.status === "processing"
      ? {
          status: input.status,
          started_at: input.startedAt,
        }
      : input.status === "failed"
        ? {
            status: input.status,
            failed_at: input.failedAt,
            error_message: input.errorMessage,
            result: input.result ?? null,
          }
        : {
            status: input.status,
            completed_at: input.completedAt,
            result: input.result,
          };

  const { error } = await supabase.from("bulk_jobs").update(payload).eq("id", jobId);
  if (error) {
    throw new Error(error.message);
  }
}

export async function listRecentBulkJobs(limit = 10) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("bulk_jobs")
    .select("id, job_type, status, reason, created_at, completed_at, error_message, result")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}
