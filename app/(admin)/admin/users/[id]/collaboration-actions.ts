"use server";

import { runAdminMutation, toAdminActionError } from "@/lib/admin/mutations";
import {
  addUserNoteSchema,
  assignUserFlagSchema,
  resolveUserFlagSchema,
  toggleUserNotePinSchema,
  userTagAssignmentSchema,
} from "@/lib/admin/schemas/hardening";
import { createAdminClient } from "@/lib/supabase/admin";

function revalidateUserCollaboration(userId: string) {
  return [`/admin/users/${userId}`, "/admin/users"];
}

export async function addUserNoteAction(values: unknown): Promise<{ error?: string }> {
  const parsed = addUserNoteSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid note payload" };
  }

  const anyPermissions =
    parsed.data.noteType === "finance"
      ? (["finance.notes.manage", "support.notes.manage"] as const)
      : (["support.notes.manage", "finance.notes.manage"] as const);

  try {
    return await runAdminMutation({
      anyPermissions: [...anyPermissions],
      execute: async (actor) => {
        const supabase = createAdminClient();
        const { error } = await supabase.from("user_notes").insert({
          user_id: parsed.data.userId,
          author_admin_id: actor.id,
          note_type: parsed.data.noteType,
          body: parsed.data.body,
          is_pinned: parsed.data.isPinned ?? false,
          is_internal_only: true,
        });

        if (error) {
          throw new Error(error.message);
        }

        return {
          value: {},
          audit: {
            actionType: "user.note_added",
            category: parsed.data.noteType === "finance" ? "billing" : "support",
            targetEntityType: "user",
            targetEntityId: parsed.data.userId,
            reason: parsed.data.body.slice(0, 140),
            afterState: {
              noteType: parsed.data.noteType,
              isPinned: parsed.data.isPinned ?? false,
            },
          },
          revalidatePaths: revalidateUserCollaboration(parsed.data.userId),
        };
      },
    });
  } catch (error) {
    return toAdminActionError(error, "Failed to add note");
  }
}

export async function toggleUserNotePinAction(
  noteId: string,
  userId: string,
  nextPinnedState: boolean
): Promise<{ error?: string }> {
  const parsed = toggleUserNotePinSchema.safeParse({ noteId, userId, nextPinnedState });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid note update" };
  }

  try {
    return await runAdminMutation({
      anyPermissions: ["support.notes.manage", "finance.notes.manage"],
      execute: async () => {
        const supabase = createAdminClient();
        const { error } = await supabase
          .from("user_notes")
          .update({
            is_pinned: parsed.data.nextPinnedState,
            updated_at: new Date().toISOString(),
          })
          .eq("id", parsed.data.noteId);

        if (error) {
          throw new Error(error.message);
        }

        return {
          value: {},
          audit: {
            actionType: "user.note_pin_toggled",
            category: "support",
            targetEntityType: "user",
            targetEntityId: parsed.data.userId,
            afterState: {
              noteId: parsed.data.noteId,
              isPinned: parsed.data.nextPinnedState,
            },
          },
          revalidatePaths: revalidateUserCollaboration(parsed.data.userId),
        };
      },
    });
  } catch (error) {
    return toAdminActionError(error, "Failed to update note pin");
  }
}

export async function assignUserTagAction(
  userId: string,
  tagId: string
): Promise<{ error?: string }> {
  const parsed = userTagAssignmentSchema.safeParse({ userId, tagId });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid tag assignment" };
  }

  try {
    return await runAdminMutation({
      permission: "tags.manage",
      execute: async (actor) => {
        const supabase = createAdminClient();
        const { error } = await supabase.from("user_tag_assignments").upsert({
          user_id: parsed.data.userId,
          tag_id: parsed.data.tagId,
          assigned_by_admin_id: actor.id,
        });

        if (error) {
          throw new Error(error.message);
        }

        return {
          value: {},
          audit: {
            actionType: "user.tag_added",
            category: "user",
            targetEntityType: "user",
            targetEntityId: parsed.data.userId,
            afterState: { tagId: parsed.data.tagId },
          },
          revalidatePaths: revalidateUserCollaboration(parsed.data.userId),
        };
      },
    });
  } catch (error) {
    return toAdminActionError(error, "Failed to add tag");
  }
}

export async function removeUserTagAction(
  userId: string,
  tagId: string
): Promise<{ error?: string }> {
  const parsed = userTagAssignmentSchema.safeParse({ userId, tagId });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid tag removal" };
  }

  try {
    return await runAdminMutation({
      permission: "tags.manage",
      execute: async () => {
        const supabase = createAdminClient();
        const { error } = await supabase
          .from("user_tag_assignments")
          .delete()
          .eq("user_id", parsed.data.userId)
          .eq("tag_id", parsed.data.tagId);

        if (error) {
          throw new Error(error.message);
        }

        return {
          value: {},
          audit: {
            actionType: "user.tag_removed",
            category: "user",
            targetEntityType: "user",
            targetEntityId: parsed.data.userId,
            beforeState: { tagId: parsed.data.tagId },
          },
          revalidatePaths: revalidateUserCollaboration(parsed.data.userId),
        };
      },
    });
  } catch (error) {
    return toAdminActionError(error, "Failed to remove tag");
  }
}

export async function assignUserFlagAction(
  userId: string,
  flagId: string,
  reason: string
): Promise<{ error?: string }> {
  const parsed = assignUserFlagSchema.safeParse({ userId, flagId, reason });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid flag assignment" };
  }

  try {
    return await runAdminMutation({
      permission: "flags.manage",
      execute: async (actor) => {
        const supabase = createAdminClient();
        const { error } = await supabase.from("user_flag_assignments").insert({
          user_id: parsed.data.userId,
          flag_id: parsed.data.flagId,
          reason: parsed.data.reason,
          assigned_by_admin_id: actor.id,
          status: "active",
        });

        if (error) {
          throw new Error(error.message);
        }

        return {
          value: {},
          audit: {
            actionType: "user.flag_added",
            category: "risk",
            severity: "warning",
            targetEntityType: "user",
            targetEntityId: parsed.data.userId,
            reason: parsed.data.reason,
            afterState: { flagId: parsed.data.flagId },
          },
          revalidatePaths: revalidateUserCollaboration(parsed.data.userId),
        };
      },
    });
  } catch (error) {
    return toAdminActionError(error, "Failed to add flag");
  }
}

export async function resolveUserFlagAction(
  assignmentId: string,
  userId: string,
  reason: string
): Promise<{ error?: string }> {
  const parsed = resolveUserFlagSchema.safeParse({ assignmentId, userId, reason });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid flag update" };
  }

  try {
    return await runAdminMutation({
      permission: "flags.manage",
      execute: async (actor) => {
        const supabase = createAdminClient();
        const { error } = await supabase
          .from("user_flag_assignments")
          .update({
            status: "resolved",
            reason: parsed.data.reason,
            resolved_by_admin_id: actor.id,
            resolved_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", parsed.data.assignmentId);

        if (error) {
          throw new Error(error.message);
        }

        return {
          value: {},
          audit: {
            actionType: "user.flag_resolved",
            category: "risk",
            targetEntityType: "user",
            targetEntityId: parsed.data.userId,
            reason: parsed.data.reason,
            afterState: {
              assignmentId: parsed.data.assignmentId,
              status: "resolved",
            },
          },
          revalidatePaths: revalidateUserCollaboration(parsed.data.userId),
        };
      },
    });
  } catch (error) {
    return toAdminActionError(error, "Failed to resolve flag");
  }
}
