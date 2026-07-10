// app/dashboard/counter/exchange/exchange-form.tsx
"use client";

import { useState, useTransition } from "react";
import { createExchangeLog } from "@/app/actions/exchange-logs";
import type { ExchangeChannel, ExchangeType } from "@/types/database";

const emptyItem = { sku_code: "", size: "", colour: "" };

export function ExchangeForm() {
  const [channel, setChannel] = useState<ExchangeChannel>("In-store");
  const [type, setType] = useState<ExchangeType>("Exchange");
  const [orderNumber, setOrderNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [itemIn, setItemIn] = useState(emptyItem);
  const [itemOut, setItemOut] = useState(emptyItem);
  const [inspector, setInspector] = useState("");
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [isPending, startTransition] = useTransition();

  function reset() {
    setOrderNumber("");
    setCustomerName("");
    setItemIn(emptyItem);
    setItemOut(emptyItem);
    setInspector("");
  }

  function handleSubmit(e: { preventDefault: () => void }) {
    e.preventDefault();
    setStatus("idle");
    startTransition(async () => {
      try {
        await createExchangeLog({
          orderNumber: orderNumber || null,
          customerName: customerName || null,
          channel,
          transactionType: type,
          itemsIn: itemIn.sku_code ? [itemIn] : [],
          itemsOut: itemOut.sku_code ? [itemOut] : [],
          inspectorName: inspector || null,
        });
        setStatus("saved");
        reset();
      } catch (err) {
        console.error(err);
        setStatus("error");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-sm">
      <div className="flex gap-2">
        {(["In-store", "Online"] as ExchangeChannel[]).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setChannel(c)}
            className={`flex-1 rounded-lg border py-2 font-semibold ${
              channel === c ? "bg-foreground text-background" : ""
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <input
        placeholder="Order Number"
        value={orderNumber}
        onChange={(e: { target: { value: string } }) => setOrderNumber(e.target.value)}
        className="w-full rounded-lg border px-3 py-2"
      />
      <input
        placeholder="Name & Surname"
        value={customerName}
        onChange={(e: { target: { value: string } }) => setCustomerName(e.target.value)}
        className="w-full rounded-lg border px-3 py-2"
      />

      <div className="flex gap-2">
        {(["Exchange", "Return"] as ExchangeType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`flex-1 rounded-lg border py-2 font-semibold ${
              type === t ? "bg-foreground text-background" : ""
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <fieldset className="space-y-2 rounded-lg border p-3">
        <legend className="px-1 text-xs font-semibold text-muted-foreground">
          Item In
        </legend>
        <input
          placeholder="SKU"
          value={itemIn.sku_code}
          onChange={(e: { target: { value: string } }) => setItemIn({ ...itemIn, sku_code: e.target.value })}
          className="w-full rounded-lg border px-3 py-2"
        />
        <div className="flex gap-2">
          <input
            placeholder="Size"
            value={itemIn.size}
            onChange={(e: { target: { value: string } }) => setItemIn({ ...itemIn, size: e.target.value })}
            className="w-1/2 rounded-lg border px-3 py-2"
          />
          <input
            placeholder="Colour"
            value={itemIn.colour}
            onChange={(e: { target: { value: string } }) => setItemIn({ ...itemIn, colour: e.target.value })}
            className="w-1/2 rounded-lg border px-3 py-2"
          />
        </div>
      </fieldset>

      <fieldset className="space-y-2 rounded-lg border p-3">
        <legend className="px-1 text-xs font-semibold text-muted-foreground">
          Item Out
        </legend>
        <input
          placeholder="SKU"
          value={itemOut.sku_code}
          onChange={(e: { target: { value: string } }) => setItemOut({ ...itemOut, sku_code: e.target.value })}
          className="w-full rounded-lg border px-3 py-2"
        />
        <div className="flex gap-2">
          <input
            placeholder="Size"
            value={itemOut.size}
            onChange={(e: { target: { value: string } }) => setItemOut({ ...itemOut, size: e.target.value })}
            className="w-1/2 rounded-lg border px-3 py-2"
          />
          <input
            placeholder="Colour"
            value={itemOut.colour}
            onChange={(e: { target: { value: string } }) => setItemOut({ ...itemOut, colour: e.target.value })}
            className="w-1/2 rounded-lg border px-3 py-2"
          />
        </div>
      </fieldset>

      <input
        placeholder="Who Inspected"
        value={inspector}
        onChange={(e: { target: { value: string } }) => setInspector(e.target.value)}
        className="w-full rounded-lg border px-3 py-2"
      />

      {status === "saved" && (
        <p className="text-xs font-semibold text-green-600">Entry logged.</p>
      )}
      {status === "error" && (
        <p className="text-xs font-semibold text-destructive">
          Could not save — try again.
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-primary py-2.5 font-semibold text-primary-foreground disabled:opacity-60"
      >
        {isPending ? "Saving…" : "+ Add Entry"}
      </button>
    </form>
  );
}
