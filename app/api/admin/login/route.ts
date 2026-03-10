import { NextRequest, NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/admin-login";
import { setAdminSessionCookie } from "@/lib/admin-session";

export async function POST(request: NextRequest) {
  try {
    const { identifier, password, rememberMe } = await request.json();

    if (typeof identifier !== "string" || typeof password !== "string") {
      return NextResponse.json(
        { success: false, error: "Username or email and password are required" },
        { status: 400 }
      );
    }

    const { admin, error } = await authenticateAdmin(identifier, password);
    if (!admin || error) {
      return NextResponse.json(
        { success: false, error: error ?? "Invalid credentials" },
        { status: 401 }
      );
    }

    await setAdminSessionCookie(admin, { rememberMe: Boolean(rememberMe) });
    const response = NextResponse.json({ success: true, admin });

    return response;
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
