import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  SESSION_MAX_AGE,
  createAdminSession,
} from "@/lib/admin-auth";
import { authenticateAdmin } from "@/lib/admin-login";

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (typeof username !== "string" || typeof password !== "string") {
      return NextResponse.json(
        { success: false, error: "Username and password are required" },
        { status: 400 }
      );
    }

    const { admin, error } = await authenticateAdmin(username, password);
    if (!admin || error) {
      return NextResponse.json(
        { success: false, error: error ?? "Invalid credentials" },
        { status: 401 }
      );
    }

    const token = await createAdminSession(admin);
    const response = NextResponse.json({
      success: true,
      admin,
    });

    response.cookies.set(ADMIN_SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE,
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
