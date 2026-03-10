"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { auditWithCurrentAdmin } from "@/lib/admin/audit";
import { requireAnyPermission, requirePermission } from "@/lib/admin/permissions";
import { assertSameOriginMutation } from "@/lib/admin/security";

function revalidateUserCollaboration(userId: string) {
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
}

export async function addUserNoteAction(values: {
  userId: string;
  noteType: "general" | "support" | "finance" | "risk" | "moderation";
  body: string;
  isPinned?: boolean;
}) {
  await assertSameOriginMutation();
  const actor =
    values.noteType === "finance"
      ? await requireAnyPermission(["finance.notes.manage", "support.notes.manage"])
      : await requireAnyPermission(["support.notes.manage", "finance.notes.manage"]);

  const supabase = createAdminClient();
  const { error } = await supabase.from("user_notes").insert({
    user_id: values.userId,
    author_admin_id: actor.id,
    note_type: values.noteType,
    body: values.body.trim(),
    is_pinned: values.isPinned ?? false,
    is_internal_only: true,
  });
  if (error) return { error: error.message };

  await auditWithCurrentAdmin({
    actionType: "user.note_added",
    category: "support",
    targetEntityType: "user",
    targetEntityId: values.userId,
    reason: values.body.trim().slice(0, 140),
    afterState: { noteType: values.noteType, isPinned: values.isPinned ?? false },
  });

  revalidateUserCollaboration(values.userId);
  return {};
}

export async function toggleUserNotePinAction(
  noteId: string,
  userId: string,
  nextPinnedState: boolean
) {
  await assertSameOriginMutation();
  await requireAnyPermission(["support.notes.manage", "finance.notes.manage"]);
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("user_notes")
    .update({ is_pinned: nextPinnedState, updated_at: new Date().toISOString() })
    .eq("id", noteId);
  if (error) return { error: error.message };

  await auditWithCurrentAdmin({
    actionType: "user.note_pin_toggled",
    category: "support",
    targetEntityType: "user",
    targetEntityId: userId,
    afterState: { noteId, isPinned: nextPinnedState },
  });

  revalidateUserCollaboration(userId);
  return {};
}

export async function assignUserTagAction(userId: string, tagId: string) {
  await assertSameOriginMutation();
  const actor = await requirePermission("tags.manage");
  const supabase = createAdminClient();
  const { error } = await supabase.from("user_tag_assignments").upsert({
    user_id: userId,
    tag_id: tagId,
    assigned_by_admin_id: actor.id,
  });
  if (error) return { error: error.message };

  await auditWithCurrentAdmin({
    actionType: "user.tag_added",
    category: "user",
    targetEntityType: "user",
    targetEntityId: userId,
    afterState: { tagId },
  });
  revalidateUserCollaboration(userId);
  return {};
}

export async function removeUserTagAction(userId: string, tagId: string) {
  await assertSameOriginMutation();
  await requirePermission("tags.manage");
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("user_tag_assignments")
    .delete()
    .eq("user_id", userId)
    .eq("tag_id", tagId);
  if (error) return { error: error.message };

  await auditWithCurrentAdmin({
    actionType: "user.tag_removed",
    category: "user",
    targetEntityType: "user",
    targetEntityId: userId,
    beforeState: { tagId },
  });
  revalidateUserCollaboration(userId);
  return {};
}

export async function assignUserFlagAction(
  userId: string,
  flagId: string,
  reason: string
) {
  await assertSameOriginMutation();
  const actor = await requirePermission("flags.manage");
  const supabase = createAdminClient();
  const { error } = await supabase.from("user_flag_assignments").insert({
    user_id: userId,
    flag_id: flagId,
    reason,
    assigned_by_admin_id: actor.id,
    status: "active",
  });
  if (error) return { error: error.message };

  await auditWithCurrentAdmin({
    actionType: "user.flag_added",
    category: "risk",
    severity: "warning",
    targetEntityType: "user",
    targetEntityId: userId,
    reason,
    afterState: { flagId },
  });
  revalidateUserCollaboration(userId);
  return {};
}

export async function resolveUserFlagAction(
  assignmentId: string,
  userId: string,
  reason: string
) {
  await assertSameOriginMutation();
  const actor = await requirePermission("flags.manage");
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("user_flag_assignments")
    .update({
      status: "resolved",
      reason,
      resolved_by_admin_id: actor.id,
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", assignmentId);
  if (error) return { error: error.message };

  await auditWithCurrentAdmin({
    actionType: "user.flag_resolved",
    category: "risk",
    targetEntityType: "user",
    targetEntityId: userId,
    reason,
    afterState: { assignmentId, status: "resolved" },
  });
  revalidateUserCollaboration(userId);
  return {};
}
