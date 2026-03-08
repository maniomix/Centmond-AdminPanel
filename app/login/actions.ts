"use server";

import { authenticateAdmin } from "@/lib/admin-login";
import { clearAdminSessionCookie, setAdminSessionCookie } from "@/lib/admin-session";

export async function loginAction(
  username: string,
  password: string
): Promise<{ error?: string }> {
  const { admin, error } = await authenticateAdmin(username, password);
  if (!admin || error) {
    return { error: error ?? "Invalid username or password" };
  }

  await setAdminSessionCookie(admin);

  return {};
}

export async function logoutAction(): Promise<void> {
  await clearAdminSessionCookie();
}
