// app/api/export/stock-take/route.ts
import { NextResponse, type NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic"; // never cache — this is always a live pull

/**
 * GET /api/export/stock-take?sessionId=<uuid>
 *
 * This is the ONLY place stock-take data leaves the server as a file.
 * Security model (defense in depth):
 *   1. `createClient()` runs as the caller's own JWT, so the underlying
 *      query is already tenant-scoped by RLS — a staff member literally
 *      cannot pull another tenant's rows here even if they forged the URL.
 *   2. We ALSO explicitly check `role` before doing any work and return a
 *      plain 403 for 'staff' — this is the real "office-only download"
 *      boundary. It does not rely on a client-side disabled button, and a
 *      staff member cannot bypass it by editing browser JS, since this
 *      code never runs in the browser at all.
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
    .select("role, tenant_id, full_name, active")
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

  const sessionId = request.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required." }, { status: 400 });
  }

  const { data: rows, error } = await supabase
    .from("stock_take_export_v")
    .select("*")
    .eq("session_id", sessionId)
    .order("category", { ascending: true })
    .order("style_name", { ascending: true })
    .order("colorway", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Stock Take");
  sheet.columns = [
    { header: "Style", key: "style_name", width: 32 },
    { header: "Category", key: "category", width: 14 },
    { header: "Colorway", key: "colorway", width: 16 },
    { header: "Size", key: "size", width: 8 },
    { header: "SKU", key: "sku_code", width: 22 },
    { header: "Front", key: "front_count", width: 8 },
    { header: "Back of House", key: "boh_count", width: 14 },
    { header: "Total in store", key: "total_in_store", width: 14 },
    { header: "Counted By", key: "counted_by", width: 18 },
    { header: "Updated At", key: "updated_at", width: 20 },
    { header: "Notes", key: "notes", width: 30 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.addRows(rows ?? []);

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer as unknown as ArrayBuffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="ZuluZenith_StockTake_${sessionId}.xlsx"`,
    },
  });
}
