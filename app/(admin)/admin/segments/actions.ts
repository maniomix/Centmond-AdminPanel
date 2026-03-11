"use server";

import { runAdminMutation, toAdminActionError } from "@/lib/admin/mutations";
import {
  deleteSegmentViewSchema,
  saveSegmentViewSchema,
} from "@/lib/admin/schemas/hardening";
import { createAdminClient } from "@/lib/supabase/admin";

export async function saveSegmentViewAction(input: unknown): Promise<{ error?: string }> {
  const parsed = saveSegmentViewSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid saved view" };
  }

  try {
    return await runAdminMutation({
      permission: "saved_views.manage",
      execute: async (actor) => {
        const supabase = createAdminClient();
        const payload = {
          owner_admin_id: actor.id,
          scope: "users" as const,
          name: parsed.data.name,
          description: parsed.data.description?.trim() || null,
          filters: parsed.data.filters,
          columns: null,
          is_shared: parsed.data.isShared ?? false,
        };

        const { data, error } = await supabase
          .from("saved_views")
          .insert(payload)
          .select("id")
          .single();

        if (error || !data) {
          throw new Error(error?.message ?? "Failed to create saved view");
        }

        return {
          value: {},
          audit: {
            actionType: "saved_view.created",
            category: "config",
            targetEntityType: "saved_view",
            targetEntityId: data.id,
            targetSummary: parsed.data.name,
            afterState: payload,
          },
          revalidatePaths: ["/admin/segments"],
        };
      },
    });
  } catch (error) {
    return toAdminActionError(error, "Failed to save segment view");
  }
}

export async function deleteSegmentViewAction(
  id: string,
  name: string
): Promise<{ error?: string }> {
  const parsed = deleteSegmentViewSchema.safeParse({ id, name });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid saved view" };
  }

  try {
    return await runAdminMutation({
      permission: "saved_views.manage",
      execute: async () => {
        const supabase = createAdminClient();
        const { error } = await supabase
          .from("saved_views")
          .delete()
          .eq("id", parsed.data.id);

        if (error) {
          throw new Error(error.message);
        }

        return {
          value: {},
          audit: {
            actionType: "saved_view.deleted",
            category: "config",
            severity: "warning",
            targetEntityType: "saved_view",
            targetEntityId: parsed.data.id,
            targetSummary: parsed.data.name,
          },
          revalidatePaths: ["/admin/segments"],
        };
      },
    });
  } catch (error) {
    return toAdminActionError(error, "Failed to delete segment view");
  }
}
