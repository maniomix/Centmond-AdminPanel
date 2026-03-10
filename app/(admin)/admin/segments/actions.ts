"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auditWithCurrentAdmin } from "@/lib/admin/audit";
import { requirePermission } from "@/lib/admin/permissions";
import { assertSameOriginMutation } from "@/lib/admin/security";
import { createAdminClient } from "@/lib/supabase/admin";

const saveViewSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(240).optional().nullable(),
  filters: z.record(z.string(), z.string()),
  isShared: z.boolean().optional(),
});

export async function saveSegmentViewAction(input: z.infer<typeof saveViewSchema>) {
  await assertSameOriginMutation();
  const actor = await requirePermission("saved_views.manage");
  const parsed = saveViewSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid saved view" };
  }

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
  if (error) return { error: error.message };

  await auditWithCurrentAdmin({
    actionType: "saved_view.created",
    category: "config",
    targetEntityType: "saved_view",
    targetEntityId: data.id,
    targetSummary: parsed.data.name,
    afterState: payload,
  });

  revalidatePath("/admin/segments");
  return {};
}

export async function deleteSegmentViewAction(id: string, name: string) {
  await assertSameOriginMutation();
  await requirePermission("saved_views.manage");

  const supabase = createAdminClient();
  const { error } = await supabase.from("saved_views").delete().eq("id", id);
  if (error) return { error: error.message };

  await auditWithCurrentAdmin({
    actionType: "saved_view.deleted",
    category: "config",
    severity: "warning",
    targetEntityType: "saved_view",
    targetEntityId: id,
    targetSummary: name,
  });

  revalidatePath("/admin/segments");
  return {};
}
