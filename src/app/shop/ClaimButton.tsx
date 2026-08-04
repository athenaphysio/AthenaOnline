"use client";

import { useState } from "react";
import styles from "./shop.module.css";

type Props = {
  sectionSlug: string;
  programmeSlug: string;
};

// The Free counterpart to BuyButton -- no redirect to Stripe, just a direct
// call that copies the template onto the patient's own account and sends
// them straight into it.
export default function ClaimButton({ sectionSlug, programmeSlug }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/shop/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionSlug, programmeSlug }),
      });
      const data = await res.json();
      if (!res.ok || !data.programmeId) throw new Error(data.error || "Couldn't add this programme.");
      window.location.href = `/session/${data.programmeId}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add this programme.");
      setLoading(false);
    }
  }

  return (
    <div>
      <button type="button" className={styles.buyButton} onClick={handleClick} disabled={loading}>
        {loading ? "Adding to your programmes…" : "Add to my programmes"}
      </button>
      {error && <p className={styles.buyStubNotice}>{error}</p>}
    </div>
  );
}
