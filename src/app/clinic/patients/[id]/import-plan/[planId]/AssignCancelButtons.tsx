"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clinicStyles from "../../../../clinic.module.css";

export default function AssignCancelButtons({ planId, patientId }: { planId: string; patientId: string }) {
  const router = useRouter();
  const [acting, setActing] = useState<"assign" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function assign() {
    setActing("assign");
    setError(null);
    try {
      const res = await fetch(`/api/clinic/imported-plans/${planId}/assign`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "That didn't work.");
      router.push(`/clinic/patients/${patientId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work.");
      setActing(null);
    }
  }

  async function cancel() {
    setActing("cancel");
    setError(null);
    try {
      const res = await fetch(`/api/clinic/imported-plans/${planId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "That didn't work.");
      router.push(`/clinic/patients/${patientId}/import-plan`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work.");
      setActing(null);
    }
  }

  return (
    <div>
      {error && <div className={clinicStyles.error}>{error}</div>}
      <div style={{ display: "flex", gap: 10 }}>
        <button
          type="button"
          className={clinicStyles.buttonSecondary}
          style={{ width: "auto", padding: "0 20px" }}
          onClick={cancel}
          disabled={acting !== null}
        >
          {acting === "cancel" ? "…" : "Cancel"}
        </button>
        <button
          type="button"
          className={clinicStyles.button}
          style={{ width: "auto", padding: "0 28px" }}
          onClick={assign}
          disabled={acting !== null}
        >
          {acting === "assign" ? "Assigning…" : "Assign to client"}
        </button>
      </div>
    </div>
  );
}
