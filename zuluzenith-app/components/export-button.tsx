// components/export-button.tsx
"use client";

import { useState } from "react";

interface ExportButtonProps {
  href: string; // e.g. /api/export/stock-take?sessionId=...
  label: string;
  filename: string;
}

/**
 * This button has NO client-side role check baked in on purpose — it's
 * only ever rendered by a Server Component that already gated it (see
 * app/dashboard/office/page.tsx). The actual security boundary is the
 * Route Handler itself, which independently re-checks role server-side.
 * So even if this button were somehow rendered for a staff session, the
 * fetch below would just come back 403 and show the toast — no data leaks.
 */
export function ExportButton({ href, label, filename }: ExportButtonProps) {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleClick() {
    setState("loading");
    setMessage(null);
    try {
      const res = await fetch(href);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setState("idle");
    } catch (err) {
      setState("error");
      setMessage(err instanceof Error ? err.message : "Export failed.");
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={state === "loading"}
        className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-60"
      >
        {state === "loading" ? "Preparing file…" : `⬇ ${label}`}
      </button>
      {message && (
        <p className="mt-2 text-center text-xs text-destructive">{message}</p>
      )}
    </div>
  );
}
