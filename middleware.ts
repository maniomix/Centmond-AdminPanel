import { NextResponse, type NextRequest } from "next/server";
import { verifyAdminSession, ADMIN_SESSION_COOKIE } from "@/lib/admin-auth";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;

  const isProtected = pathname.startsWith("/admin") || pathname === "/dashboard";
  const isLogin = pathname === "/login";

  if (isLogin) {
    if (token) {
      const payload = await verifyAdminSession(token);
      if (payload) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    }
    return NextResponse.next();
  }

  if (isProtected) {
    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const payload = await verifyAdminSession(token);
    if (!payload) {
      const response = NextResponse.redirect(new URL("/login", request.url));
      response.cookies.delete(ADMIN_SESSION_COOKIE);
      return response;
    }

    // Pass admin info to layout via headers (avoids extra DB query in layout)
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-admin-id", payload.sub);
    requestHeaders.set("x-admin-username", payload.username);
    requestHeaders.set("x-admin-role", payload.role);

    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
