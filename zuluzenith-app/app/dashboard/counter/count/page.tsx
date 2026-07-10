// app/dashboard/counter/count/page.tsx
import { createClient } from "@/lib/supabase/server";
import { CountKeypad } from "@/components/count-keypad";
import { redirect } from "next/navigation";

/**
 * Server Component: fetches the tenant's catalog + the open stock take
 * session's existing counts in two RLS-scoped queries, then hands the
 * per-SKU rows to the client CountKeypad component. No catalog or count
 * data is ever fetched client-side directly — this page owns that, so a
 * staff browser only ever sees its own tenant's rows to begin with,
 * before any role-based UI logic even applies.
 */
export default async function CounterCountPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();
  if (!profile?.tenant_id) redirect("/account-disabled");

  const { data: session } = await supabase
    .from("stock_take_sessions")
    .select("id")
    .eq("tenant_id", profile.tenant_id)
    .is("closed_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!session) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        No stock take is currently open. Ask an Office user to start one.
      </p>
    );
  }

  const { data: products } = await supabase
    .from("products")
    .select("id, name, category, skus(id, colorway, color_hex, size, sku_code)")
    .or(`tenant_id.is.null,tenant_id.eq.${profile.tenant_id}`)
    .order("category");

  const { data: counts } = await supabase
    .from("stock_counts")
    .select("sku_id, front_count, boh_count")
    .eq("session_id", session.id);

  interface CountRow {
    sku_id: string;
    front_count: number | null;
    boh_count: number | null;
  }

  const countsBySku = new Map<string, CountRow>(
    (counts ?? []).map((c: CountRow) => [c.sku_id, c])
  );

  interface SkuRow {
    id: string;
    colorway: string;
    color_hex: string | null;
    size: string;
    sku_code: string;
  }
  interface ProductRow {
    id: string;
    name: string;
    category: string;
    skus: SkuRow[] | null;
  }

  return (
    <div className="mx-auto max-w-md space-y-6 p-4">
      {((products ?? []) as ProductRow[]).map((product) => (
        <section key={product.id}>
          <h2 className="mb-2 font-space-grotesk text-sm font-bold">
            {product.name}
          </h2>
          <div className="space-y-3">
            {(product.skus ?? []).map((sku) => {
              const existing = countsBySku.get(sku.id);
              return (
                <div
                  key={sku.id}
                  className="rounded-xl border p-3 text-sm"
                  style={{ borderLeft: `4px solid ${sku.color_hex ?? "#ccc"}` }}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-semibold">
                      {sku.colorway} · {sku.size}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {sku.sku_code}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <CountKeypad
                      sessionId={session.id}
                      skuId={sku.id}
                      skuCode={sku.sku_code}
                      size={sku.size}
                      field="front"
                      initialValue={existing?.front_count ?? null}
                    />
                    <CountKeypad
                      sessionId={session.id}
                      skuId={sku.id}
                      skuCode={sku.sku_code}
                      size={sku.size}
                      field="boh"
                      initialValue={existing?.boh_count ?? null}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
