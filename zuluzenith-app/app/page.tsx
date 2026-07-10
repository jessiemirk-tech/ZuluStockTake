// app/page.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function RootPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, active")
    .eq("id", user.id)
    .single();

  if (!profile?.active) redirect("/account-disabled");

  if (profile.role === "office" || profile.role === "super_admin") {
    redirect("/dashboard/office");
  }
  redirect("/dashboard/counter");
}
