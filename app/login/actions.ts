"use server";

import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createAdminSession,
  ADMIN_SESSION_COOKIE,
  SESSION_MAX_AGE,
} from "@/lib/admin-auth";

export async function loginAction(
  username: string,
  password: string
): Promise<{ error?: string }> {
  const supabase = createAdminClient();

  // Verify credentials via PostgreSQL crypt() — completely independent of auth.users
  const { data, error } = await supabase.rpc("verify_admin_password", {
    p_username: username.toLowerCase().trim(),
    p_password: password,
  });

  if (error || !data || data.length === 0) {
    return { error: "Invalid username or password" };
  }

  const admin = data[0] as { id: string; username: string; role: string };

  const token = await createAdminSession({
    id: admin.id,
    username: admin.username,
    role: admin.role,
  });

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });

  return {};
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE);
}
