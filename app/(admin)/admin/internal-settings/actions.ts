"use server";

import { runAdminMutation, toAdminActionError } from "@/lib/admin/mutations";
import { internalSettingSchema } from "@/lib/admin/schemas/phase2";
import { upsertInternalSetting } from "@/lib/admin/services/config";

export async function upsertInternalSettingAction(values: unknown) {
  let parsed: ReturnType<typeof internalSettingSchema.parse>;
  try {
    parsed = internalSettingSchema.parse(values);
  } catch {
    return { error: "Invalid internal setting payload" };
  }

  try {
    return await runAdminMutation({
      permission: "internal_settings.manage",
      requireRecentAuth: true,
      execute: async (actor) => {
        await upsertInternalSetting({
          key: parsed.key,
          label: parsed.label,
          description: parsed.description ?? null,
          value: parsed.value,
          isSensitive: parsed.isSensitive,
          updatedByAdminId: actor.id,
        });

        return {
          value: {},
          audit: {
            actionType: "internal_setting.upserted",
            category: "config",
            targetEntityType: "internal_setting",
            targetEntityId: parsed.key,
            targetSummary: parsed.label,
            reason: parsed.reason,
            afterState: {
              isSensitive: parsed.isSensitive,
              value: parsed.value,
            },
          },
          revalidatePaths: ["/admin/internal-settings"],
        };
      },
    });
  } catch (error) {
    return toAdminActionError(error, "Failed to save internal setting");
  }
}
