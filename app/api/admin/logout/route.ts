import { NextResponse } from "next/server";
import { clearAdminSessionCookie, getAdminSession, revokeAdminSession } from "@/lib/admin-session";
import { writeAdminAuditLog } from "@/lib/admin/audit";

export async function POST() {
  try {
    const session = await getAdminSession();
    if (session) {
      await revokeAdminSession(session.sessionId, "logout");
      await writeAdminAuditLog({
        actorAdminId: session.sub,
        actorRole: session.role,
        actionType: "admin.logout",
        category: "auth",
        targetEntityType: "admin_user",
        targetEntityId: session.sub,
        targetSummary: session.username,
      });
    }
    await clearAdminSessionCookie();
    const response = NextResponse.json({ success: true });
    return response;
  } catch (err) {
    console.error("Logout error:", err);
    await clearAdminSessionCookie();
    const response = NextResponse.json({ success: true });
    return response;
  }
}
