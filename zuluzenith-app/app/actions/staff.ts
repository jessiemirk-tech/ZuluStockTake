// app/actions/staff.ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Deliberately uses the normal RLS-scoped client, NOT the service role.
 * The migration's "office updates own tenant staff (not role)" policy
 * already permits an office/super_admin caller to update rows in their
 * own tenant as long as the row's role stays 'staff' after the edit — so
 * flipping `active` for a staff row is already covered without needing
 * elevated privilege. If a staff caller (or anyone outside the tenant)
 * tries this, the UPDATE simply matches zero rows; Postgres does not
 * error, so we check `count` ourselves and surface a clear message.
 */
export async function setStaffActive(profileId: string, active: boolean) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated.");

  const { data, error } = await supabase
    .from("profiles")
    .update({ active })
    .eq("id", profileId)
    .eq("role", "staff") // matches the RLS with-check; also guards office from disabling itself
    .select("id");

  if (error) throw new Error(`Could not update staff status: ${error.message}`);
  if (!data || data.length === 0) {
    throw new Error(
      "No matching staff row updated — check permissions or that this account is role 'staff'."
    );
  }

  revalidatePath("/dashboard/office/staff");
  return { ok: true as const };
}
