import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Role } from "@/generated/prisma/enums";
import { hasMinRole } from "@/lib/rbac";

// Route protection config
const PROTECTED_ROUTES = ["/dashboard"];
const AUTH_ROUTES = ["/login"];

const ROUTE_ROLES: Record<string, Role> = {
  "/dashboard/employees": "HR_ADMIN",
  "/dashboard/geofence": "ADMIN",
  "/dashboard/settings": "ADMIN",
};

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const pathname = nextUrl.pathname;

  // Redirect logged-in users away from login page
  if (AUTH_ROUTES.some((r) => pathname.startsWith(r))) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL("/dashboard", nextUrl));
    }
    return NextResponse.next();
  }

  // Protect dashboard routes
  if (PROTECTED_ROUTES.some((r) => pathname.startsWith(r))) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL("/login", nextUrl));
    }

    // Check role-based access
    const userRole = req.auth?.user?.role as Role;
    for (const [route, requiredRole] of Object.entries(ROUTE_ROLES)) {
      if (pathname.startsWith(route) && !hasMinRole(userRole, requiredRole)) {
        return NextResponse.redirect(new URL("/dashboard", nextUrl));
      }
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.json|icons|sw.js).*)",
  ],
};
