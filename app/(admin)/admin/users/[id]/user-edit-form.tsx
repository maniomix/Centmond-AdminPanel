"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import type { UserRow } from "@/types";

const userSchema = z.object({
  full_name: z.string().min(1, "Name is required"),
  role: z.enum(["admin", "editor", "viewer"]),
  status: z.enum(["active", "inactive", "suspended"]),
});

type UserValues = z.infer<typeof userSchema>;

export function UserEditForm({ user }: { user: UserRow }) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<UserValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      full_name: user.full_name ?? "",
      role: user.role,
      status: user.status,
    },
  });

  async function onSubmit(values: UserValues) {
    setLoading(true);
    const { error } = await supabase
      .from("users")
      .update({ ...values, updated_at: new Date().toISOString() })
      .eq("id", user.id);

    if (error) {
      toast.error("Failed to update user");
    } else {
      toast.success("User updated");
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Full Name</Label>
          <Input {...register("full_name")} />
          {errors.full_name && <p className="text-xs text-red-600">{errors.full_name.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input value={user.email} disabled className="text-neutral-400" />
        </div>
        <div className="space-y-1.5">
          <Label>Role</Label>
          <Select value={watch("role")} onValueChange={(v) => setValue("role", v as UserValues["role"])}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="editor">Editor</SelectItem>
              <SelectItem value="viewer">Viewer</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={watch("status")} onValueChange={(v) => setValue("status", v as UserValues["status"])}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
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
