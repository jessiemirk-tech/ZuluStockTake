// app/dashboard/office/staff/page.tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AddStaffForm } from "./add-staff-form";
import { StaffRowActions } from "./staff-row-actions";

interface StaffRow {
  id: string;
  full_name: string;
  role: string;
  active: boolean;
  created_at: string;
}

export default async function StaffManagementPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (
    !callerProfile ||
    (callerProfile.role !== "office" && callerProfile.role !== "super_admin")
  ) {
    redirect("/dashboard/counter");
  }

  // RLS's "office reads own tenant profiles" policy scopes this to the
  // caller's own tenant automatically — no manual .eq("tenant_id", ...)
  // needed, and none would help a malicious caller bypass it either.
  const { data: staff } = await supabase
    .from("profiles")
    .select("id, full_name, role, active, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-md space-y-6 p-4">
      <h1 className="font-space-grotesk text-lg font-bold">Manage Staff</h1>

      <AddStaffForm />

      <div className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Team
        </h2>
        {((staff ?? []) as StaffRow[]).map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between rounded-lg border p-3 text-sm"
          >
            <div>
              <p className="font-semibold">{s.full_name}</p>
              <p className="text-xs capitalize text-muted-foreground">
                {s.role} · {s.active ? "active" : "deactivated"}
              </p>
            </div>
            {s.role === "staff" && (
              <StaffRowActions profileId={s.id} active={s.active} />
            )}
          </div>
        ))}
        {(staff ?? []).length === 0 && (
          <p className="text-xs text-muted-foreground">No staff yet.</p>
        )}
      </div>
    </div>
  );
}
