// app/dashboard/counter/exchange/page.tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ExchangeForm } from "./exchange-form";

interface RecentEntry {
  id: string;
  order_number: string | null;
  customer_name: string | null;
  channel: string;
  transaction_type: string;
  created_at: string;
}

export default async function CounterExchangePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS limits this SELECT to the caller's own submitted rows — staff
  // cannot browse the full tenant history from here even by editing
  // this query, because the policy checks operator_id = auth.uid()
  // server-side regardless of what's requested.
  const { data: myEntries } = await supabase
    .from("exchange_logs")
    .select(
      "id, order_number, customer_name, channel, transaction_type, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div className="mx-auto max-w-md space-y-6 p-4">
      <h1 className="font-space-grotesk text-lg font-bold">
        Exchange &amp; Return
      </h1>
      <ExchangeForm />

      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Your recent entries
        </h2>
        <div className="space-y-2">
          {((myEntries ?? []) as RecentEntry[]).map((e) => (
            <div key={e.id} className="rounded-lg border p-3 text-xs">
              <p className="font-semibold">
                {e.transaction_type} · {e.channel}
                {e.order_number ? ` · #${e.order_number}` : ""}
              </p>
              <p className="text-muted-foreground">
                {e.customer_name ?? "—"} ·{" "}
                {new Date(e.created_at).toLocaleString()}
              </p>
            </div>
          ))}
          {(myEntries ?? []).length === 0 && (
            <p className="text-xs text-muted-foreground">
              No entries logged yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
