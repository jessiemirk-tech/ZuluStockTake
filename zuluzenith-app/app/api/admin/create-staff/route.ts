// app/api/admin/create-staff/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/database";

interface CreateStaffBody {
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
}

/**
 * POST /api/admin/create-staff
 *
 * This is the ONLY place a new staff/office account is created. It is the
 * one legitimate caller of createServiceRoleClient() in the whole app —
 * everything else uses the RLS-scoped client. The service role bypasses
 * RLS entirely, so this route is where all the safety has to live:
 *
 *   1. Caller must be authenticated (their own RLS-scoped session).
 *   2. Caller's role must be 'office' or 'super_admin' — checked via a
 *      normal RLS-scoped query BEFORE the service-role client is ever
 *      touched, so a staff caller never gets anywhere near it.
 *   3. An 'office' caller is hard-pinned to their OWN tenant_id and can
 *      only assign 'staff' or 'office' — never 'super_admin', and never a
 *      tenant_id they pass in the request body (that field is ignored for
 *      office callers on purpose, not just validated).
 *   4. A 'super_admin' caller may specify any tenant_id/role.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role, tenant_id, active")
    .eq("id", user.id)
    .single();

  if (!callerProfile?.active) {
    return NextResponse.json({ error: "Account inactive." }, { status: 403 });
  }
  if (callerProfile.role !== "office" && callerProfile.role !== "super_admin") {
    return NextResponse.json(
      { error: "Only Office accounts can add staff." },
      { status: 403 }
    );
  }

  let body: Partial<CreateStaffBody> & { tenantId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { email, password, fullName } = body;
  if (!email || !password || !fullName) {
    return NextResponse.json(
      { error: "email, password, and fullName are required." },
      { status: 400 }
    );
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "Password/PIN must be at least 6 characters." },
      { status: 400 }
    );
  }

  // --- Resolve role + tenant, ignoring anything the client tries to
  //     smuggle in beyond what the caller's own role is allowed to grant.
  let resolvedRole: UserRole;
  let resolvedTenantId: string | null;

  if (callerProfile.role === "office") {
    resolvedTenantId = callerProfile.tenant_id; // always own tenant, body.tenantId ignored
    resolvedRole = body.role === "office" ? "office" : "staff"; // never super_admin
  } else {
    // super_admin
    resolvedTenantId = body.tenantId ?? null;
    resolvedRole = body.role ?? "staff";
    if (resolvedRole !== "super_admin" && !resolvedTenantId) {
      return NextResponse.json(
        { error: "tenantId is required for staff/office accounts." },
        { status: 400 }
      );
    }
  }

  const admin = createServiceRoleClient();
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role: resolvedRole,
      tenant_id: resolvedTenantId,
    },
  });

  if (error) {
    // Supabase returns a 422-ish error for duplicate emails — surface it
    // plainly rather than a generic 500.
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, userId: created.user?.id });
}
