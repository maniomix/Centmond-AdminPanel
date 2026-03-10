"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction } from "./actions";

const loginSchema = z.object({
  identifier: z.string().min(1, "Username or email is required"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean(),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);

  const accessDenied = searchParams.get("error") === "access_denied";

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      rememberMe: false,
    },
  });

  async function onSubmit(values: LoginValues) {
    setLoading(true);
    const result = await loginAction(
      values.identifier,
      values.password,
      values.rememberMe
    );

    if (result.error) {
      toast.error(result.error);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {accessDenied && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          Access denied. This panel is for admins only.
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="identifier">Username or Email</Label>
        <Input
          id="identifier"
          type="text"
          placeholder="admin@example.com"
          autoComplete="username email"
          autoCapitalize="none"
          {...register("identifier")}
        />
        {errors.identifier && (
          <p className="text-xs text-red-600">{errors.identifier.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          {...register("password")}
        />
        {errors.password && (
          <p className="text-xs text-red-600">{errors.password.message}</p>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm text-neutral-600">
        <input type="checkbox" {...register("rememberMe")} className="h-4 w-4" />
        Keep this admin session for longer on this device
      </label>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}
