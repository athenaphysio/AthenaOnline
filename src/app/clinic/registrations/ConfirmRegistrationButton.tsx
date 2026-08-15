"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../clinic.module.css";

export default function ConfirmRegistrationButton({ registrationId }: { registrationId: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/clinic/registrations/${registrationId}/confirm`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't confirm that.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't confirm that.");
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
      <button
        type="button"
        className={styles.button}
        style={{ width: "auto", height: "auto", padding: "6px 14px", fontSize: 12.5 }}
        disabled={saving}
        onClick={handleClick}
      >
        {saving ? "Confirming…" : "Confirm into patient record"}
      </button>
      {error && <div style={{ fontSize: 11.5, color: "var(--crimson)", maxWidth: 200, textAlign: "right" }}>{error}</div>}
    </div>
  );
}
