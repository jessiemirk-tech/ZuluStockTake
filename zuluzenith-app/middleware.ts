// middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { response, userId, role } = await updateSession(request);
  const path = request.nextUrl.pathname;

  const isDashboardRoute = path.startsWith("/dashboard");
  const isOfficeRoute = path.startsWith("/dashboard/office");
  const isCounterRoute = path.startsWith("/dashboard/counter");

  // Not logged in (or profile deactivated) -> bounce to login, preserving
  // where they were headed so we can redirect back after auth.
  if (isDashboardRoute && !userId) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", path);
    return NextResponse.redirect(loginUrl);
  }

  if (isDashboardRoute && userId && !role) {
    // Authenticated in Supabase Auth but no active profile row —
    // deactivated staff account, or provisioning hasn't finished.
    return NextResponse.redirect(new URL("/account-disabled", request.url));
  }

  // Office dashboard: office + super_admin only. Staff get bounced to
  // their own counter dashboard rather than a bare 403, since this is
  // the normal "wrong door" case, not an attack.
  if (isOfficeRoute && role === "staff") {
    return NextResponse.redirect(new URL("/dashboard/counter", request.url));
  }

  // Counter dashboard: any authenticated tenant member can use it —
  // office/super_admin may still want to jump in and count stock too.
  if (isCounterRoute && !role) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Run on everything except static assets and Next internals, so the
     * session cookie stays fresh app-wide, but the redirect LOGIC above
     * only actually acts on /dashboard/* paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
