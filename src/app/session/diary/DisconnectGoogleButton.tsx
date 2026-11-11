"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/components/diary/DiaryPlanner.module.css";

export default function DisconnectGoogleButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function disconnect() {
    setBusy(true);
    try {
      await fetch("/api/session/google-calendar/disconnect", { method: "POST" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <button type="button" className={styles.secondary} onClick={disconnect} disabled={busy}>
      {busy ? "Unlinking" : "Unlink Google Calendar"}
    </button>
  );
}
