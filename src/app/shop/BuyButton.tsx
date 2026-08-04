"use client";

import { useState } from "react";
import styles from "./shop.module.css";

type Props = {
  sectionSlug: string;
  programmeSlug: string;
  priceLabel: string;
};

// Creates a Stripe Checkout Session server-side, then sends the browser
// straight to Stripe's own hosted payment page -- this component never
// touches a card number, a Stripe key, or anything payment-related beyond
// the URL Stripe itself hands back.
export default function BuyButton({ sectionSlug, programmeSlug, priceLabel }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/shop/checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionSlug, programmeSlug }),
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
      <button type="button" className={styles.buyButton} onClick={handleClick} disabled={loading}>
        {loading ? "Taking you to checkout…" : `Buy, ${priceLabel}`}
      </button>
      {error && <p className={styles.buyStubNotice}>{error}</p>}
    </div>
  );
}
