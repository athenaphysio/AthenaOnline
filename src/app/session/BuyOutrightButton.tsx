"use client";

import { useState } from "react";
import shopStyles from "../shop/shop.module.css";

type Props = {
  programmeId: string;
  label: string;
};

// Same shape as BuyButton/MembershipButton -- creates a Checkout Session
// server-side, sends the browser to Stripe's own hosted page. Deliberately
// a plain button, same visual weight as whatever sits next to it, since
// this needs to read as a genuinely separate choice, not a smaller
// alternative tucked under a bigger one.
export default function BuyOutrightButton({ programmeId, label }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/session/buy-outright/checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programmeId }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Couldn't start checkout.");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start checkout.");
      setLoading(false);
    }
  }

  return (
    <div>
      <button type="button" className={shopStyles.buyButton} onClick={handleClick} disabled={loading}>
        {loading ? "Taking you to checkout…" : label}
      </button>
      {error && <p className={shopStyles.buyStubNotice}>{error}</p>}
    </div>
  );
}
