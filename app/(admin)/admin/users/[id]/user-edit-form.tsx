"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { extractUserCategories, parseAdminCategoryInput, stringifyUserCategories } from "@/lib/user-admin";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { UserRow } from "@/types";
import { updateUserAction } from "../actions";

function toLocalInput(value: string | null): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 16);
}

function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

const userSchema = z.object({
  display_name: z.string().trim(),
  is_email_verified: z.enum(["verified", "unverified"]),
  profile_image_url: z.string().trim(),
  profile_image: z.string().trim(),
  custom_categories: z.string().trim(),
  last_active_at: z.string().trim(),
});

type UserValues = z.infer<typeof userSchema>;

export function UserEditForm({ user }: { user: UserRow }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<UserValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      display_name: user.display_name ?? "",
      is_email_verified: user.is_email_verified ? "verified" : "unverified",
      profile_image_url: user.profile_image_url ?? "",
      profile_image: user.profile_image ?? "",
      custom_categories: stringifyUserCategories(user.custom_categories),
      last_active_at: toLocalInput(user.last_active_at),
    },
  });
  const customCategoriesInput =
    useWatch({
      control,
      name: "custom_categories",
    }) ?? "";
  const previewCategories = extractUserCategories(
    parseAdminCategoryInput(customCategoriesInput)
  );

  async function onSubmit(values: UserValues) {
    setLoading(true);
    const result = await updateUserAction(user.id, {
      display_name: values.display_name || null,
      is_email_verified: values.is_email_verified === "verified",
      profile_image_url: values.profile_image_url || null,
      profile_image: values.profile_image || null,
      custom_categories: parseAdminCategoryInput(values.custom_categories),
      last_active_at: fromLocalInput(values.last_active_at),
    });

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("User updated");
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Display Name</Label>
          <Input {...register("display_name")} />
          {errors.display_name && (
            <p className="text-xs text-red-600">{errors.display_name.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input value={user.email} disabled className="text-neutral-400" />
        </div>
        <div className="space-y-1.5">
          <Label>Email Verification</Label>
          <Controller
            name="is_email_verified"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="unverified">Unverified</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label>Last Active Override</Label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setValue("last_active_at", new Date().toISOString().slice(0, 16))}
            >
              Now
            </Button>
          </div>
          <Input type="datetime-local" {...register("last_active_at")} />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label>Profile Image URL</Label>
          <Input
            {...register("profile_image_url")}
            placeholder="https://..."
          />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label>Profile Image Raw Value</Label>
          <Textarea
            {...register("profile_image")}
            rows={3}
            placeholder="Paste base64/blob/raw image reference if your app uses it"
          />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label>Custom Categories</Label>
          <Textarea
            {...register("custom_categories")}
            rows={5}
            placeholder={"One category per line, comma separated, or a JSON array"}
          />
          <p className="text-xs text-neutral-500">
            You can paste plain text, comma-separated items, or raw JSON.
          </p>
          {previewCategories.length ? (
            <div className="flex flex-wrap gap-2">
              {previewCategories.map((category) => (
                <span
                  key={category}
                  className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs text-neutral-700"
                >
                  {category}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-neutral-400">No custom categories configured.</p>
          )}
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={loading} size="sm">
          {loading ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
