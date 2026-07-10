// lib/supabase/middleware.ts
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import type { UserRole } from "@/types/database";

export interface SessionContext {
  response: NextResponse;
  userId: string | null;
  role: UserRole | null;
  tenantId: string | null;
}

/**
 * Refreshes the Supabase auth session cookie on every request and, if a
 * user is logged in, fetches their role/tenant from `profiles` so the
 * calling middleware.ts can make routing decisions without a second
 * round-trip. This is the ONLY place role is read for routing purposes —
 * real data access is still separately protected by RLS + the export route
 * handlers, so this is a UX/redirect layer, not the security boundary.
 */
export async function updateSession(
  request: NextRequest
): Promise<SessionContext> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }: { name: string; value: string }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(
            ({
              name,
              value,
              options,
            }: {
              name: string;
              value: string;
              options?: CookieOptions;
            }) => response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { response, userId: null, role: null, tenantId: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, tenant_id, active")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.active) {
    return { response, userId: user.id, role: null, tenantId: null };
  }

  return {
    response,
    userId: user.id,
    role: profile.role,
    tenantId: profile.tenant_id,
  };
}
