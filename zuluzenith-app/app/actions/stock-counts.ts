// app/actions/stock-counts.ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface UpsertCountInput {
  sessionId: string;
  skuId: string;
  field: "front" | "boh";
  value: number;
}

/**
 * Upserts a single Front / Back-of-House count for one SKU in one session.
 * Runs as the calling user (RLS-scoped) — no service role involved, so a
 * staff member from Tenant A physically cannot write into Tenant B's rows
 * no matter what skuId/sessionId they pass in; the tenant_id check in RLS
 * (public.stock_counts insert/update policies) rejects it server-side.
 */
export async function upsertStockCount(input: UpsertCountInput) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated.");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("tenant_id, active")
    .eq("id", user.id)
    .single();
  if (profileError || !profile?.active || !profile.tenant_id) {
    throw new Error("No active tenant profile for this user.");
  }

  // Read-modify-write so front/boh can be updated independently without
  // clobbering whichever field the other staffer already entered.
  const { data: existing } = await supabase
    .from("stock_counts")
    .select("front_count, boh_count")
    .eq("session_id", input.sessionId)
    .eq("sku_id", input.skuId)
    .maybeSingle();

  const nextRow = {
    session_id: input.sessionId,
    tenant_id: profile.tenant_id,
    sku_id: input.skuId,
    counter_id: user.id,
    front_count:
      input.field === "front" ? input.value : existing?.front_count ?? null,
    boh_count:
      input.field === "boh" ? input.value : existing?.boh_count ?? null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("stock_counts")
    .upsert(nextRow, { onConflict: "session_id,sku_id" });

  if (error) throw new Error(`Failed to save count: ${error.message}`);

  revalidatePath("/dashboard/counter/count");
  return { ok: true as const };
}

/**
 * Office-only: starts a new stock take session for the tenant. RLS already
 * enforces this (the insert policy requires is_office_or_above()), but we
 * check role here too so staff get a clean error instead of a raw
 * Postgres RLS-denial message.
 */
export async function startStockTakeSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "office" && profile.role !== "super_admin")) {
    throw new Error("Only Office accounts can start a new stock take.");
  }

  const { data, error } = await supabase
    .from("stock_take_sessions")
    .insert({ tenant_id: profile.tenant_id!, started_by: user.id })
    .select("id")
    .single();

  if (error) throw new Error(`Could not start session: ${error.message}`);

  revalidatePath("/dashboard");
  return { sessionId: data.id };
}
