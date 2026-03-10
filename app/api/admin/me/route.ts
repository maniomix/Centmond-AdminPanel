import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/permissions";
import { clearAdminSessionCookie } from "@/lib/admin-session";

export async function GET() {
  try {
    const admin = await getAdminContext();
    if (!admin) {
      await clearAdminSessionCookie();
      return NextResponse.json({ valid: false, error: "Session expired" }, { status: 401 });
    }

    return NextResponse.json({
      valid: true,
      admin: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        role: admin.role,
        roles: admin.roleKeys,
        permissions: Array.from(admin.permissions),
      },
    });
  } catch (err) {
    console.error("Session validation error:", err);
    return NextResponse.json(
      { valid: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
