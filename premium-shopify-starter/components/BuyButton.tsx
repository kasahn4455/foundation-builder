"use client";

import { useState } from "react";

export default function BuyButton({ merchandiseId, disabled = false }: { merchandiseId: string; disabled?: boolean }) {
  const [loading, setLoading] = useState(false);

  async function checkout() {
    try {
      setLoading(true);
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchandiseId, quantity: 1 })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to create checkout");
      window.location.href = data.checkoutUrl;
    } catch (error) {
      alert(error instanceof Error ? error.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <button className="primaryButton" onClick={checkout} disabled={disabled || loading}>
      {loading ? "Preparing checkout…" : disabled ? "Sold out" : "Buy now"}
    </button>
  );
}
