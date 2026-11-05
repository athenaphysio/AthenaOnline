"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../clinic.module.css";

// Shown on the Forms page while either of the Programme Builder forms is
// missing from the library.
export default function AddBuilderFormsButton({ missing }: { missing: string[] }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "working" | "error">("idle");
  const [error, setError] = useState("");

  async function add() {
    setState("working");
    try {
      const res = await fetch("/api/clinic/forms/builder-forms", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      setState("idle");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState("error");
    }
  }

  return (
    <div className={styles.card} style={{ marginBottom: 20 }}>
      <div className={styles.cardTitle}>Programme Builder forms</div>
      <p className={styles.subheading} style={{ marginTop: 0 }}>
        Ready made forms for clients who have not had a one to one consultation. Answers are saved to the client&apos;s
        background, laid out under the same headings as your Twofold notes, ready to copy into the Programme Builder.
        Still to add: {missing.join(" and ")}.
      </p>
      <button
        type="button"
        className={styles.buttonSecondary}
        style={{ width: "auto", padding: "0 16px" }}
        onClick={add}
        disabled={state === "working"}
      >
        {state === "working" ? "Adding…" : "Add these forms"}
      </button>
      {state === "error" && <p className={styles.error}>{error}</p>}
    </div>
  );
}
