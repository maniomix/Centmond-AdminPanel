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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { UserRow } from "@/types";
import { updateUserAction } from "../actions";

const userSchema = z.object({
  display_name: z.string().trim().min(1, "Display name is required"),
  is_email_verified: z.enum(["verified", "unverified"]),
});

type UserValues = z.infer<typeof userSchema>;

export function UserEditForm({ user }: { user: UserRow }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<UserValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      display_name: user.display_name ?? "",
      is_email_verified: user.is_email_verified ? "verified" : "unverified",
    },
  });

  async function onSubmit(values: UserValues) {
    setLoading(true);
    const result = await updateUserAction(user.id, {
      display_name: values.display_name,
      is_email_verified: values.is_email_verified === "verified",
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
      <div className="grid grid-cols-2 gap-4">
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
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={loading} size="sm">
          {loading ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
