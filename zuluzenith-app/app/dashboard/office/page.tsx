// app/dashboard/office/page.tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ExportButton } from "@/components/export-button";

/**
 * middleware.ts already bounces staff away from /dashboard/office/* before
 * this ever renders. This second, explicit check is deliberate belt-and-
 * braces: middleware is a UX/redirect layer, this is the actual page-level
 * gate, and the Route Handler behind ExportButton is the real data
 * boundary. Three independent layers, any one of which is sufficient on
 * its own to stop a staff download.
 */
export default async function OfficeDashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, tenant_id, full_name")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "office" && profile.role !== "super_admin")) {
    redirect("/dashboard/counter");
  }

  const { data: session } = await supabase
    .from("stock_take_sessions")
    .select("id, started_at")
    .eq("tenant_id", profile.tenant_id!)
    .is("closed_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-md space-y-6 p-4">
      <h1 className="font-space-grotesk text-lg font-bold">
        Welcome, {profile.full_name}
      </h1>

      <div className="grid grid-cols-2 gap-2">
        <Link
          href="/dashboard/office/staff"
          className="rounded-xl border p-3 text-center text-sm font-semibold hover:bg-muted"
        >
          👥 Manage Staff
        </Link>
        <Link
          href="/dashboard/office/exchange-history"
          className="rounded-xl border p-3 text-center text-sm font-semibold hover:bg-muted"
        >
          🔄 Exchange History
        </Link>
      </div>

      {session ? (
        <div className="space-y-3 rounded-xl border p-4">
          <p className="text-sm text-muted-foreground">
            Open stock take started{" "}
            {new Date(session.started_at).toLocaleString()}
          </p>
          <ExportButton
            href={`/api/export/stock-take?sessionId=${session.id}`}
            label="Download Stock Take (.xlsx)"
            filename="ZuluZenith_StockTake.xlsx"
          />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No open stock take session.
        </p>
      )}

      <div className="rounded-xl border p-4">
        <ExportButton
          href="/api/export/exchange-log"
          label="Download Exchange & Return Log (.xlsx)"
          filename="ZuluZenith_ExchangeReturn.xlsx"
        />
      </div>
    </div>
  );
}
