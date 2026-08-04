"use client";

import { useState } from "react";
import shopStyles from "../shop/shop.module.css";
import styles from "./membership.module.css";

type Props = {
  tierId: string;
  // "monthly" for the recurring subscription, or an upfront option's key
  // (e.g. "6mo") for a one-off price.
  option: string;
  label: string;
  variant?: "primary" | "secondary";
};

// Same shape as BuyButton -- creates a Checkout Session server-side, then
// sends the browser to Stripe's own hosted page. "monthly" starts a real
// subscription there; any other option is a one-off payment. Either way
// this component never touches a card number or a Stripe key.
export default function MembershipButton({ tierId, option, label, variant = "primary" }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/membership/checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tierId, option }),
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
      <button
        type="button"
        className={variant === "primary" ? shopStyles.buyButton : styles.secondaryButton}
        onClick={handleClick}
        disabled={loading}
      >
        {loading ? "Taking you to checkout…" : label}
      </button>
      {error && <p className={shopStyles.buyStubNotice}>{error}</p>}
    </div>
  );
}
