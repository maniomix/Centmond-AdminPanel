"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ContentRow } from "@/types";
import { upsertContentAction } from "../actions";

const contentSchema = z.object({
  title: z.string().min(1, "Title is required"),
  slug: z.string().min(1, "Slug is required").regex(/^[a-z0-9-]+$/, "Slug: lowercase letters, numbers, hyphens only"),
  body: z.string().optional(),
  status: z.enum(["draft", "published", "archived"]),
  category: z.string().optional(),
});

type ContentValues = z.infer<typeof contentSchema>;

function slugify(str: string) {
  return str.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export function ContentForm({ content }: { content?: ContentRow }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, setValue, control, formState: { errors } } = useForm<ContentValues>({
    resolver: zodResolver(contentSchema),
    defaultValues: {
      title: content?.title ?? "",
      slug: content?.slug ?? "",
      body: content?.body ?? "",
      status: content?.status ?? "draft",
      category: content?.category ?? "",
    },
  });

  function handleTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const title = e.target.value;
    setValue("title", title);
    if (!content) {
      setValue("slug", slugify(title));
    }
  }

  async function onSubmit(values: ContentValues) {
    setLoading(true);

    const payload = {
      title: values.title,
      slug: values.slug,
      body: values.body?.trim() ? values.body : null,
      status: values.status,
      category: values.category?.trim() ? values.category : null,
      published_at: values.status === "published" && !content?.published_at
        ? new Date().toISOString()
        : content?.published_at ?? null,
    };

    const result = await upsertContentAction(content?.id ?? null, payload);
    if (result?.error) {
      toast.error(content ? "Failed to update content" : "Failed to create content");
      setLoading(false);
      return;
    }

    toast.success(content ? "Content updated" : "Content created");
    if (content) router.refresh();
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Title</Label>
          <Input
            {...register("title")}
            onChange={handleTitleChange}
          />
          {errors.title && <p className="text-xs text-red-600">{errors.title.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Slug</Label>
          <Input {...register("slug")} className="font-mono text-sm" />
          {errors.slug && <p className="text-xs text-red-600">{errors.slug.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Controller
            name="status"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Category</Label>
          <Input {...register("category")} placeholder="Optional" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Body</Label>
        <Textarea {...register("body")} rows={10} placeholder="Content body..." />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={loading}>
          {loading ? "Saving..." : content ? "Save changes" : "Create content"}
        </Button>
      </div>
    </form>
  );
}
