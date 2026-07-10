// app/dashboard/office/staff/staff-row-actions.tsx
"use client";

import { useTransition } from "react";
import { setStaffActive } from "@/app/actions/staff";

export function StaffRowActions({
  profileId,
  active,
}: {
  profileId: string;
  active: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      try {
        await setStaffActive(profileId, !active);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed to update.");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={`rounded-lg px-3 py-1 text-xs font-semibold ${
        active ? "bg-destructive/10 text-destructive" : "bg-green-100 text-green-700"
      } disabled:opacity-60`}
    >
      {isPending ? "…" : active ? "Deactivate" : "Reactivate"}
    </button>
  );
}
