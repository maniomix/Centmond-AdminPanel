import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;

    if (!token) {
      return NextResponse.json(
        { valid: false, error: "No session" },
        { status: 401 }
      );
    }

    const session = await verifyAdminSession(token);
    if (!session) {
      const response = NextResponse.json(
        { valid: false, error: "Session expired" },
        { status: 401 }
      );
      response.cookies.delete(ADMIN_SESSION_COOKIE);
      return response;
    }

    return NextResponse.json({
      valid: true,
      admin: {
        id: session.sub,
        username: session.username,
        role: session.role,
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
