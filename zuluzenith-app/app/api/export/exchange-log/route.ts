// app/api/export/exchange-log/route.ts
import { NextResponse, type NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import type { ExchangeItem } from "@/types/database";

export const dynamic = "force-dynamic";

function formatItems(items: ExchangeItem[] | null): string {
  if (!items || items.length === 0) return "";
  return items.map((i) => `${i.sku_code} (${i.size}/${i.colour})`).join(", ");
}

/**
 * GET /api/export/exchange-log?from=<iso-date>&to=<iso-date>
 * Same office/super_admin-only boundary as the stock-take export. This
 * doubles as the enforcement point for "staff cannot browse historical
 * logs" — RLS already limits a staff caller's SELECT to their own rows,
 * but we short-circuit with a 403 before even running the query so the
 * failure mode is an explicit, auditable "access denied" rather than a
 * silently-empty file.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, tenant_id, active")
    .eq("id", user.id)
    .single();

  if (!profile?.active) {
    return NextResponse.json({ error: "Account inactive." }, { status: 403 });
  }
  if (profile.role !== "office" && profile.role !== "super_admin") {
    return NextResponse.json(
      { error: "Only Office accounts can download this report." },
      { status: 403 }
    );
  }

  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");

  let query = supabase
    .from("exchange_logs")
    .select(
      "order_number, customer_name, channel, transaction_type, items_in, items_out, inspector_name, created_at, operator_id, profiles:operator_id (full_name)"
    )
    .eq("tenant_id", profile.tenant_id!)
    .order("created_at", { ascending: false });

  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);

  const { data: rows, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Exchange & Return");
  sheet.columns = [
    { header: "IN-STORE/ONLINE", key: "channel", width: 14 },
    { header: "ORDER NUMBER", key: "order_number", width: 16 },
    { header: "NAME & SURNAME", key: "customer_name", width: 20 },
    { header: "EXCHANGE/ RETURN", key: "transaction_type", width: 16 },
    { header: "ITEM(S) IN", key: "items_in", width: 34 },
    { header: "ITEM(S) OUT", key: "items_out", width: 34 },
    { header: "OPERATOR", key: "operator", width: 18 },
    { header: "WHO INSPECTED", key: "inspector_name", width: 18 },
    { header: "DATE", key: "created_at", width: 20 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const r of rows ?? []) {
    sheet.addRow({
      channel: r.channel,
      order_number: r.order_number,
      customer_name: r.customer_name,
      transaction_type: r.transaction_type,
      items_in: formatItems(r.items_in as ExchangeItem[]),
      items_out: formatItems(r.items_out as ExchangeItem[]),
      operator: (r as unknown as { profiles?: { full_name?: string } }).profiles
        ?.full_name,
      inspector_name: r.inspector_name,
      created_at: r.created_at,
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer as unknown as ArrayBuffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="ZuluZenith_ExchangeReturn.xlsx"`,
    },
  });
}
