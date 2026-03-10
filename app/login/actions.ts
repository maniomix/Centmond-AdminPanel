"use server";

import { authenticateAdmin } from "@/lib/admin-login";
import {
  clearAdminSessionCookie,
  getAdminSession,
  revokeAdminSession,
  revokeAllAdminSessions,
  setAdminSessionCookie,
} from "@/lib/admin-session";
import { writeAdminAuditLog } from "@/lib/admin/audit";
import { assertSameOriginMutation } from "@/lib/admin/security";

export async function loginAction(
  identifier: string,
  password: string,
  rememberMe = false
): Promise<{ error?: string }> {
  await assertSameOriginMutation();
  const { admin, error } = await authenticateAdmin(identifier, password);
  if (!admin || error) {
    return { error: error ?? "Invalid username or password" };
  }

  await setAdminSessionCookie(admin, { rememberMe });

  return {};
}

export async function logoutAction(options?: { logoutAll?: boolean }): Promise<void> {
  await assertSameOriginMutation();
  const session = await getAdminSession();
  if (session) {
    if (options?.logoutAll) {
      await revokeAllAdminSessions(session.sub, "logout_all");
    } else {
      await revokeAdminSession(session.sessionId, "logout");
    }
    await writeAdminAuditLog({
      actorAdminId: session.sub,
      actorRole: session.role,
      actionType: options?.logoutAll ? "admin.logout_all" : "admin.logout",
      category: "auth",
      targetEntityType: "admin_user",
      targetEntityId: session.sub,
      targetSummary: session.username,
    });
  }
  await clearAdminSessionCookie();
}
