// app/dashboard/counter/page.tsx
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function CounterHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  return (
    <div className="mx-auto max-w-sm space-y-4 p-6">
      <h1 className="font-space-grotesk text-lg font-bold">
        Hi, {profile?.full_name ?? "there"}
      </h1>
      <Link
        href="/dashboard/counter/count"
        className="block rounded-xl border p-4 font-semibold hover:bg-muted"
      >
        📋 Stock Take
        <p className="mt-1 text-xs font-normal text-muted-foreground">
          Count Front / Back of House per style
        </p>
      </Link>
      <Link
        href="/dashboard/counter/exchange"
        className="block rounded-xl border p-4 font-semibold hover:bg-muted"
      >
        🔄 Exchange &amp; Return
        <p className="mt-1 text-xs font-normal text-muted-foreground">
          Log an in-store or online exchange
        </p>
      </Link>
    </div>
  );
}
