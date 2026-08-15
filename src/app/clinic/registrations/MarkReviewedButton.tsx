"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../clinic.module.css";

export default function MarkReviewedButton({ registrationId }: { registrationId: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function handleClick() {
    setSaving(true);
    try {
      await fetch(`/api/clinic/registrations/${registrationId}/review`, { method: "POST" });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <button
      type="button"
      className={styles.buttonSecondary}
      style={{ width: "auto", height: "auto", padding: "6px 14px", fontSize: 12.5 }}
      disabled={saving}
      onClick={handleClick}
    >
      {saving ? "Marking…" : "Mark reviewed"}
    </button>
  );
}
