import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_SESSION_COOKIE,
  SESSION_MAX_AGE,
  createAdminSession,
  verifyAdminSession,
  type AdminPayload,
  type AdminRole,
} from "@/lib/admin-auth";

export interface AdminIdentity {
  id: string;
  username: string;
  role: AdminRole;
}

export async function setAdminSessionCookie(admin: AdminIdentity): Promise<void> {
  const token = await createAdminSession(admin);
  const cookieStore = await cookies();

  cookieStore.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

export async function clearAdminSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE);
}

export async function getAdminSession(): Promise<AdminPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await verifyAdminSession(token);
  if (session) return session;

  try {
    cookieStore.delete(ADMIN_SESSION_COOKIE);
  } catch {
    // Ignore cookie mutation failures in read-only contexts.
  }

  return null;
}

export async function requireAdminSession(): Promise<AdminPayload> {
  const session = await getAdminSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

export function canManageData(role: string): boolean {
  return role === "admin" || role === "super_admin";
}

export function isSuperAdmin(role: string): boolean {
  return role === "super_admin";
}
