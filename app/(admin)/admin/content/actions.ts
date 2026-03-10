"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { runAdminMutation, toAdminActionError } from "@/lib/admin/mutations";
import type { ContentRow } from "@/types";

export async function deleteContentAction(id: string): Promise<{ error?: string }> {
  try {
    return await runAdminMutation({
      permission: "content.manage",
      requireRecentAuth: true,
      execute: async () => {
        const supabase = createAdminClient();
        const { data: content } = await supabase
          .from("content")
          .select("id, title, slug")
          .eq("id", id)
          .maybeSingle();
        if (!content) {
          throw new Error("Content item not found");
        }

        const { error } = await supabase.from("content").delete().eq("id", id);
        if (error) {
          throw new Error(error.message);
        }

        return {
          value: {},
          audit: {
            actionType: "content.deleted",
            category: "config",
            severity: "warning",
            targetEntityType: "content",
            targetEntityId: id,
            targetSummary: content.title,
            beforeState: { slug: content.slug },
          },
          revalidatePaths: ["/admin/content"],
        };
      },
    });
  } catch (error) {
    return toAdminActionError(error, "Failed to delete content");
  }
}

export async function upsertContentAction(
  id: string | null,
  values: Pick<
    ContentRow,
    "title" | "slug" | "status" | "published_at" | "body" | "category"
  >
): Promise<{ error?: string }> {
  try {
    const result = await runAdminMutation({
      permission: "content.manage",
      requireRecentAuth: true,
      execute: async (actor) => {
        const supabase = createAdminClient();

        if (id) {
          const { data: existing } = await supabase
            .from("content")
            .select("id, title, slug, status, category")
            .eq("id", id)
            .maybeSingle();
          if (!existing) {
            throw new Error("Content item not found");
          }

          const { error } = await supabase
            .from("content")
            .update({ ...values, updated_at: new Date().toISOString() })
            .eq("id", id);
          if (error) {
            throw new Error(error.message);
          }

          return {
            value: { created: false },
            audit: {
              actionType: "content.updated",
              category: "config",
              targetEntityType: "content",
              targetEntityId: id,
              targetSummary: values.title,
              beforeState: {
                title: existing.title,
                slug: existing.slug,
                status: existing.status,
                category: existing.category,
              },
              afterState: {
                title: values.title,
                slug: values.slug,
                status: values.status,
                category: values.category,
              },
            },
            revalidatePaths: [`/admin/content/${id}`, "/admin/content"],
          };
        }

        const { data: created, error } = await supabase
          .from("content")
          .insert({
            ...values,
            author_id: actor.id,
          })
          .select("id")
          .single();
        if (error || !created) {
          throw new Error(error?.message ?? "Failed to create content");
        }

        return {
          value: { created: true },
          audit: {
            actionType: "content.created",
            category: "config",
            targetEntityType: "content",
            targetEntityId: created.id,
            targetSummary: values.title,
            afterState: {
              title: values.title,
              slug: values.slug,
              status: values.status,
              category: values.category,
            },
          },
          revalidatePaths: ["/admin/content", `/admin/content/${created.id}`],
        };
      },
    });

    if (result.created) {
      redirect("/admin/content");
    }

    return {};
  } catch (error) {
    return toAdminActionError(
      error,
      id ? "Failed to update content" : "Failed to create content"
    );
  }
}
