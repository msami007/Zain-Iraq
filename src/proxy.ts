import NextAuth from "next-auth";
import { authConfig } from "./lib/auth.config";
import { NextResponse } from "next/server";

export const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const userRole = req.auth?.user?.role;

  const isApiRoute = nextUrl.pathname.startsWith("/api");
  const isAuthRoute = nextUrl.pathname.startsWith("/api/auth") || nextUrl.pathname === "/login";
  
  // Publicly accessible paths
  const isPublicRoute =
    nextUrl.pathname === "/" ||
    nextUrl.pathname.startsWith("/articles") ||
    nextUrl.pathname.startsWith("/api/v1/health") ||
    nextUrl.pathname.startsWith("/api/v1/search") ||
    nextUrl.pathname.startsWith("/api/v1/feedback");

  // Allow authentication endpoints to go through
  if (isAuthRoute) {
    return NextResponse.next();
  }

  // Allow public pages and health endpoints
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Redirect to login if user is not authenticated
  if (!isLoggedIn) {
    if (isApiRoute) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  // Role-based Access Controls (RBAC)
  
  // 1. SuperAdmin Guards
  if (nextUrl.pathname.startsWith("/superadmin")) {
    if (userRole !== "SuperAdmin") {
      if (isApiRoute) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/", nextUrl));
    }
  }

  // 2. Administrator Guards
  if (nextUrl.pathname.startsWith("/admin")) {
    if (userRole !== "Admin" && userRole !== "SuperAdmin") {
      if (isApiRoute) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/", nextUrl));
    }
  }

  // 3. Customer Support Agent Guards
  if (nextUrl.pathname.startsWith("/agent")) {
    if (userRole !== "Agent" && userRole !== "Admin" && userRole !== "SuperAdmin") {
      if (isApiRoute) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/", nextUrl));
    }
  }

  return NextResponse.next();
});

export const config = {
  // Run proxy on all paths except static assets
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logos|branding).*)"],
};
