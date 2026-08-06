"use client";

import { useState, type CSSProperties } from "react";
import shopStyles from "../shop/shop.module.css";
import styles from "./membership.module.css";

type Props = {
  tierId: string;
  // "monthly" for the recurring subscription, or an upfront option's key
  // (e.g. "6mo") for a one-off price.
  option: string;
  label: string;
  variant?: "primary" | "secondary";
  // The tier's own tonal-fade colours (see membershipTiers.ts) -- only
  // meaningful on variant="primary". Omit to fall back to the plain
  // crimson button (buyButton's own default).
  accent?: string;
  accentDark?: string;
  onAccent?: string;
  // Adds a visible border in this colour -- needed on a tier's own detail
  // page, where the page background is already that tier's accent colour,
  // so the button still reads as a separate, tappable thing.
  borderColor?: string;
};

type ButtonStyle = CSSProperties & {
  "--section-accent"?: string;
  "--section-on-accent"?: string;
};

// Same shape as BuyButton -- creates a Checkout Session server-side, then
// sends the browser to Stripe's own hosted page. "monthly" starts a real
// subscription there; any other option is a one-off payment. Either way
// this component never touches a card number or a Stripe key.
export default function MembershipButton({
  tierId,
  option,
  label,
  variant = "primary",
  accent,
  accentDark,
  onAccent,
  borderColor,
}: Props) {
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

  let style: (CSSProperties & ButtonStyle) | undefined;
  if (variant === "primary" && accent) {
    style = {
      "--section-accent": `linear-gradient(135deg, ${accentDark ?? accent}, ${accent})`,
      "--section-on-accent": onAccent,
      ...(borderColor ? { border: `1.5px solid ${borderColor}` } : {}),
    };
  } else if (variant === "secondary" && onAccent) {
    // On a tier's own detail page the default neutral outline (built for a
    // cream background) wouldn't read against that tier's own colour, so
    // it's recoloured to the page's own text colour instead.
    style = { background: "transparent", color: onAccent, borderColor: onAccent };
  }

  return (
    <div>
      <button
        type="button"
        className={variant === "primary" ? shopStyles.buyButton : styles.secondaryButton}
        style={style}
        onClick={handleClick}
        disabled={loading}
      >
        {loading ? "Taking you to checkout…" : label}
      </button>
      {error && <p className={shopStyles.buyStubNotice}>{error}</p>}
    </div>
  );
}
