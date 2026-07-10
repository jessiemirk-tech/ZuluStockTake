// app/dashboard/office/staff/add-staff-form.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { UserRole } from "@/types/database";

export function AddStaffForm() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("staff");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: { preventDefault: () => void }) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const res = await fetch("/api/admin/create-staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, fullName, role }),
      });
      const body = await res.json();

      if (!res.ok) {
        setError(body.error ?? "Could not create account.");
        return;
      }

      setSuccess(`${fullName} added as ${role}.`);
      setFullName("");
      setEmail("");
      setPassword("");
      setRole("staff");
      router.refresh(); // re-fetch the staff list on the server component
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border p-4">
      <h2 className="font-space-grotesk text-sm font-bold">Add Staff</h2>

      <input
        placeholder="Full name"
        required
        value={fullName}
        onChange={(e: { target: { value: string } }) => setFullName(e.target.value)}
        className="w-full rounded-lg border px-3 py-2 text-sm"
      />
      <input
        placeholder="Login email"
        type="email"
        required
        value={email}
        onChange={(e: { target: { value: string } }) => setEmail(e.target.value)}
        className="w-full rounded-lg border px-3 py-2 text-sm"
      />
      <input
        placeholder="Password / PIN (min 6 characters)"
        type="text"
        required
        minLength={6}
        value={password}
        onChange={(e: { target: { value: string } }) => setPassword(e.target.value)}
        className="w-full rounded-lg border px-3 py-2 text-sm"
      />

      <div className="flex gap-2">
        {(["staff", "office"] as UserRole[]).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRole(r)}
            className={`flex-1 rounded-lg border py-2 text-sm font-semibold capitalize ${
              role === r ? "bg-foreground text-background" : ""
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
      {success && <p className="text-xs font-semibold text-green-600">{success}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {isPending ? "Creating…" : "Create Account"}
      </button>
    </form>
  );
}
