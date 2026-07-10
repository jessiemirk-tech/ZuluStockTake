// lib/supabase/server.ts
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient as createRawClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

/**
 * Server-side Supabase client bound to the current request's cookies.
 * Use inside Server Components, Server Actions, and Route Handlers.
 * This client runs AS THE LOGGED-IN USER (their JWT), so every query is
 * subject to RLS — it is NOT the service role and cannot bypass policies.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options as CookieOptions);
            });
          } catch {
            // setAll called from a Server Component (not an Action/Route
            // Handler) — safe to ignore since middleware refreshes the
            // session on every request anyway.
          }
        },
      },
    }
  );
}

/**
 * Service-role client — bypasses RLS entirely. NEVER import this into any
 * client-facing code path. Only use it from trusted server-only contexts
 * (e.g. an admin "create staff" Route Handler) that have already verified
 * the caller's role themselves.
 */
export function createServiceRoleClient() {
  return createRawClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // server-only env var, never NEXT_PUBLIC_
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
