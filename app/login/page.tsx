import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin/permissions";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const admin = await getAdminContext();
  if (admin) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
            Centmond Admin
          </h1>
          <p className="mt-1.5 text-sm text-neutral-500">
            Sign in to your account
          </p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-8 shadow-sm">
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
