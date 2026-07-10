// app/dashboard/office/exchange-history/page.tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ExportButton } from "@/components/export-button";

interface HistoryEntry {
  id: string;
  order_number: string | null;
  customer_name: string | null;
  channel: string;
  transaction_type: string;
  created_at: string;
  inspector_name: string | null;
  profiles?: { full_name?: string } | null;
}

export default async function ExchangeHistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "office" && profile.role !== "super_admin")) {
    redirect("/dashboard/counter");
  }

  // Office role's RLS policy allows every tenant row here, unlike the
  // staff-facing page which is limited to operator_id = auth.uid().
  const { data: entries } = await supabase
    .from("exchange_logs")
    .select(
      "id, order_number, customer_name, channel, transaction_type, created_at, inspector_name, profiles:operator_id (full_name)"
    )
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="font-space-grotesk text-lg font-bold">
          Exchange &amp; Return History
        </h1>
      </div>

      <ExportButton
        href="/api/export/exchange-log"
        label="Download Full Log (.xlsx)"
        filename="ZuluZenith_ExchangeReturn.xlsx"
      />

      <div className="space-y-2">
        {((entries ?? []) as HistoryEntry[]).map((e) => (
          <div key={e.id} className="rounded-lg border p-3 text-xs">
            <p className="font-semibold">
              {e.transaction_type} · {e.channel}
              {e.order_number ? ` · #${e.order_number}` : ""}
            </p>
            <p className="text-muted-foreground">
              {e.customer_name ?? "—"} ·{" "}
              {new Date(e.created_at).toLocaleString()}
            </p>
            <p className="text-muted-foreground">
              Logged by {e.profiles?.full_name ?? "—"} · Inspected by{" "}
              {e.inspector_name ?? "—"}
            </p>
          </div>
        ))}
        {(entries ?? []).length === 0 && (
          <p className="text-xs text-muted-foreground">No entries yet.</p>
        )}
      </div>
    </div>
  );
}
