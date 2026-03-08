"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePasswordAction } from "./actions";

const schema = z.object({
  oldPassword: z.string().min(1, "Required"),
  newPassword: z.string().min(6, "Minimum 6 characters"),
  confirmPassword: z.string().min(1, "Required"),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type Values = z.infer<typeof schema>;

export function ChangePasswordForm() {
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(values: Values) {
    setLoading(true);
    const result = await changePasswordAction(values.oldPassword, values.newPassword);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Password changed successfully");
      reset();
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Current Password</Label>
        <Input type="password" autoComplete="current-password" {...register("oldPassword")} />
        {errors.oldPassword && <p className="text-xs text-red-600">{errors.oldPassword.message}</p>}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>New Password</Label>
          <Input type="password" autoComplete="new-password" {...register("newPassword")} />
          {errors.newPassword && <p className="text-xs text-red-600">{errors.newPassword.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Confirm New Password</Label>
          <Input type="password" autoComplete="new-password" {...register("confirmPassword")} />
          {errors.confirmPassword && <p className="text-xs text-red-600">{errors.confirmPassword.message}</p>}
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={loading}>
          {loading ? "Changing..." : "Change password"}
        </Button>
      </div>
    </form>
  );
}
