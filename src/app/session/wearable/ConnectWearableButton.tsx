"use client";

import { useState } from "react";
import shopStyles from "../../shop/shop.module.css";

type Props = {
  dataSource: string;
  name: string;
};

// Tapping this sends the browser straight to the manufacturer's own login
// page (via ROOK's authorizer URL) -- nothing to install, this app never
// sees the patient's device credentials.
export default function ConnectWearableButton({ dataSource, name }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/session/wearable/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataSource }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Couldn't start the connection.");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start the connection.");
      setLoading(false);
    }
  }

  return (
    <div>
      <button type="button" className={shopStyles.buyButton} onClick={handleClick} disabled={loading}>
        {loading ? "Taking you there…" : `Connect ${name}`}
      </button>
      {error && <p className={shopStyles.buyStubNotice}>{error}</p>}
    </div>
  );
}
