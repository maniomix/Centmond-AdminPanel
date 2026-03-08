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
import { updateProfileAction } from "./actions";

const profileSchema = z.object({
  display_name: z.string().min(1, "Name is required"),
});

type ProfileValues = z.infer<typeof profileSchema>;

interface SettingsProfileFormProps {
  adminId: string;
  displayName: string | null;
  username: string;
}

export function SettingsProfileForm({ adminId, displayName, username }: SettingsProfileFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      display_name: displayName ?? "",
    },
  });

  async function onSubmit(values: ProfileValues) {
    setLoading(true);
    const result = await updateProfileAction(adminId, values.display_name);

    if (result?.error) {
      toast.error("Failed to update profile");
    } else {
      toast.success("Profile updated");
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
          {errors.display_name && <p className="text-xs text-red-600">{errors.display_name.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Username</Label>
          <Input value={`@${username}`} disabled className="text-neutral-400 font-mono" />
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={loading}>
          {loading ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
