// components/count-keypad.tsx
"use client";

import { useState, useRef, useTransition } from "react";
import { upsertStockCount } from "@/app/actions/stock-counts";

interface CountKeypadProps {
  sessionId: string;
  skuId: string;
  skuCode: string;
  size: string;
  field: "front" | "boh";
  initialValue: number | null;
}

const LONG_PRESS_MS = 420;

export function CountKeypad({
  sessionId,
  skuId,
  skuCode,
  size,
  field,
  initialValue,
}: CountKeypadProps) {
  const [value, setValue] = useState<number | null>(initialValue);
  const [pulsing, setPulsing] = useState(false);
  const [keypadOpen, setKeypadOpen] = useState(false);
  const [keypadDraft, setKeypadDraft] = useState("");
  const [isPending, startTransition] = useTransition();
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function commit(next: number) {
    setValue(next);
    setPulsing(true);
    setTimeout(() => setPulsing(false), 130);
    startTransition(async () => {
      try {
        await upsertStockCount({ sessionId, skuId, field, value: next });
      } catch (err) {
        // Optimistic update failed server-side (RLS denial, network, etc.)
        // Roll back and surface the real reason rather than silently
        // pretending the count saved.
        setValue(initialValue);
        console.error(err);
        alert(err instanceof Error ? err.message : "Could not save count.");
      }
    });
  }

  function adjust(delta: number) {
    const next = Math.max(0, (value ?? 0) + delta);
    commit(next);
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(10);
    }
  }

  function startPress() {
    pressTimer.current = setTimeout(() => {
      setKeypadDraft(value !== null ? String(value) : "");
      setKeypadOpen(true);
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([15, 20, 15]);
      }
    }, LONG_PRESS_MS);
  }

  function cancelPress() {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  }

  function confirmKeypad() {
    const parsed = keypadDraft === "" ? 0 : parseInt(keypadDraft, 10);
    commit(parsed);
    setKeypadOpen(false);
  }

  const label = field === "front" ? "Front" : "Back of House";

  return (
    <div className="flex items-center gap-2" aria-busy={isPending}>
      <span className="w-[86px] text-xs font-semibold text-muted-foreground">
        {label}
      </span>
      <button
        type="button"
        aria-label={`Decrease ${label} count for ${skuCode}`}
        className="h-7 w-7 rounded-full border border-foreground text-sm font-semibold active:bg-foreground active:text-background"
        onClick={() => adjust(-1)}
        onPointerDown={startPress}
        onPointerUp={cancelPress}
        onPointerLeave={cancelPress}
      >
        −
      </button>
      <span
        className={`w-9 text-center font-space-grotesk text-base font-bold transition-transform ${
          pulsing ? "scale-125" : "scale-100"
        }`}
        onPointerDown={startPress}
        onPointerUp={cancelPress}
        onPointerLeave={cancelPress}
      >
        {value === null ? "—" : value}
      </span>
      <button
        type="button"
        aria-label={`Increase ${label} count for ${skuCode}`}
        className="h-7 w-7 rounded-full border border-foreground text-sm font-semibold active:bg-foreground active:text-background"
        onClick={() => adjust(1)}
        onPointerDown={startPress}
        onPointerUp={cancelPress}
        onPointerLeave={cancelPress}
      >
        +
      </button>

      {keypadOpen && (
        <div
          className="fixed inset-0 z-20 flex items-end bg-black/50"
          onClick={(e: { target: EventTarget | null; currentTarget: EventTarget | null }) =>
            e.target === e.currentTarget && setKeypadOpen(false)
          }
        >
          <div className="w-full rounded-t-2xl bg-background p-5">
            <p className="mb-1 text-center text-xs font-semibold text-muted-foreground">
              Bulk count — {label} · Size {size}
            </p>
            <p className="mb-4 text-center font-space-grotesk text-4xl font-bold">
              {keypadDraft || "0"}
            </p>
            <div className="mb-3 grid grid-cols-3 gap-2">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map(
                (k, i) => (
                  <button
                    key={i}
                    type="button"
                    disabled={k === ""}
                    className="aspect-[3/2] rounded-xl border text-lg font-semibold disabled:opacity-0"
                    onClick={() => {
                      if (k === "⌫") setKeypadDraft((d) => d.slice(0, -1));
                      else if (k) setKeypadDraft((d) => (d.length < 3 ? d + k : d));
                    }}
                  >
                    {k}
                  </button>
                )
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-xl bg-muted py-3 font-semibold"
                onClick={() => setKeypadDraft("")}
              >
                Clear
              </button>
              <button
                type="button"
                className="flex-1 rounded-xl bg-primary py-3 font-semibold text-primary-foreground"
                onClick={confirmKeypad}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
