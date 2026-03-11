import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingTableError } from "@/lib/admin/table-error-utils";
import type { Json } from "@/types/database";

export async function listFeatureFlags() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("feature_flags")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    if (isMissingTableError(error.message, "feature_flags")) {
      return [];
    }
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function upsertFeatureFlag(input: {
  key: string;
  label: string;
  description?: string | null;
  enabled: boolean;
  rolloutPercentage: number;
  audienceFilters?: Record<string, unknown> | null;
  updatedByAdminId: string;
}) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("feature_flags").upsert({
    key: input.key,
    label: input.label,
    description: input.description ?? null,
    enabled: input.enabled,
    rollout_percentage: input.rolloutPercentage,
    audience_filters: (input.audienceFilters ?? null) as Json | null,
    updated_by_admin_id: input.updatedByAdminId,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function listInternalSettings() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("internal_settings")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    if (isMissingTableError(error.message, "internal_settings")) {
      return [];
    }
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function upsertInternalSetting(input: {
  key: string;
  label: string;
  description?: string | null;
  value: Record<string, unknown>;
  isSensitive: boolean;
  updatedByAdminId: string;
}) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("internal_settings").upsert({
    key: input.key,
    label: input.label,
    description: input.description ?? null,
    value: input.value as Json,
    is_sensitive: input.isSensitive,
    updated_by_admin_id: input.updatedByAdminId,
  });

  if (error) {
    throw new Error(error.message);
  }
}
