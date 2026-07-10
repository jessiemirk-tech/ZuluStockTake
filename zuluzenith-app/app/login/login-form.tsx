// app/login/login-form.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Plain email/password sign-in against Supabase Auth. If your staff
 * accounts are provisioned with a username-style login (e.g.
 * "jdoe@staff.zuluzenith.internal") rather than real email addresses,
 * that's still just an email string as far as Supabase Auth is concerned —
 * swap the label/placeholder below, no other change needed. Password
 * strength/PIN-length policy is enforced at account-creation time in your
 * admin-provisioning endpoint (see README), not here.
 */
export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: { preventDefault: () => void }) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);
    if (signInError) {
      setError("Incorrect email or password.");
      return;
    }
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-xs font-semibold text-muted-foreground">
          Email
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e: { target: { value: string } }) => setEmail(e.target.value)}
          className="w-full rounded-lg border px-3 py-2 text-sm"
          autoComplete="username"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-muted-foreground">
          Password
        </label>
        <input
          type="password"
          required
          value={password}
          onChange={(e: { target: { value: string } }) => setPassword(e.target.value)}
          className="w-full rounded-lg border px-3 py-2 text-sm"
          autoComplete="current-password"
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
