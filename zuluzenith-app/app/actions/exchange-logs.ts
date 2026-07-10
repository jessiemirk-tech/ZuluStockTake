// app/actions/exchange-logs.ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ExchangeChannel, ExchangeItem, ExchangeType } from "@/types/database";

export interface CreateExchangeLogInput {
  orderNumber: string | null;
  customerName: string | null;
  channel: ExchangeChannel;
  transactionType: ExchangeType;
  itemsIn: ExchangeItem[];
  itemsOut: ExchangeItem[];
  inspectorName: string | null;
}

/**
 * Any authenticated tenant member (staff or office) may stage an exchange.
 * RLS forces operator_id = auth.uid() and tenant_id = their own tenant, so
 * nobody can log an entry on another staffer's behalf or into another
 * store's log. Staff can then only SELECT rows where operator_id is their
 * own id (see migration) — they cannot browse the full historical log,
 * which is deliberately reserved for office/super_admin.
 */
export async function createExchangeLog(input: CreateExchangeLogInput) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id, active")
    .eq("id", user.id)
    .single();
  if (!profile?.active || !profile.tenant_id) {
    throw new Error("No active tenant profile for this user.");
  }

  const { error } = await supabase.from("exchange_logs").insert({
    tenant_id: profile.tenant_id,
    operator_id: user.id,
    order_number: input.orderNumber,
    customer_name: input.customerName,
    channel: input.channel,
    transaction_type: input.transactionType,
    items_in: input.itemsIn,
    items_out: input.itemsOut,
    inspector_name: input.inspectorName,
  });

  if (error) throw new Error(`Failed to log entry: ${error.message}`);

  revalidatePath("/dashboard/counter/exchange");
  revalidatePath("/dashboard/office/exchange-history");
  return { ok: true as const };
}
