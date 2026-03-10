"use server";

import { runAdminMutation, toAdminActionError } from "@/lib/admin/mutations";
import { featureFlagSchema } from "@/lib/admin/schemas/phase2";
import { upsertFeatureFlag } from "@/lib/admin/services/config";

export async function upsertFeatureFlagAction(values: unknown) {
  let parsed: ReturnType<typeof featureFlagSchema.parse>;
  try {
    parsed = featureFlagSchema.parse(values);
  } catch {
    return { error: "Invalid feature flag payload" };
  }

  try {
    return await runAdminMutation({
      permission: "feature_flags.manage",
      requireRecentAuth: true,
      execute: async (actor) => {
        await upsertFeatureFlag({
          key: parsed.key,
          label: parsed.label,
          description: parsed.description ?? null,
          enabled: parsed.enabled,
          rolloutPercentage: parsed.rolloutPercentage,
          audienceFilters: parsed.audienceFilters ?? null,
          updatedByAdminId: actor.id,
        });

        return {
          value: {},
          audit: {
            actionType: "feature_flag.upserted",
            category: "config",
            targetEntityType: "feature_flag",
            targetEntityId: parsed.key,
            targetSummary: parsed.label,
            reason: parsed.reason,
            afterState: {
              enabled: parsed.enabled,
              rolloutPercentage: parsed.rolloutPercentage,
              audienceFilters: parsed.audienceFilters ?? null,
            },
          },
          revalidatePaths: ["/admin/feature-flags"],
        };
      },
    });
  } catch (error) {
    return toAdminActionError(error, "Failed to save feature flag");
  }
}
