"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clinicStyles from "@/app/clinic/clinic.module.css";

// The real "make this a patient's actual programme" action -- everything
// before this (the draft row, the workouts/blocks the note built) is
// clinic-internal only. Calls the same instantiateProgramme(...) path
// every other assign flow in this app uses, via the approve route.
export default function ApproveButton({ draftId }: { draftId: string }) {
  const router = useRouter();
  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    setApproving(true);
    setError(null);
    try {
      const res = await fetch(`/api/clinic/running-builder/${draftId}/approve`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Approve failed.");
      setApproved(true);
      router.push(`/clinic/patients/${data.patient_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approve failed.");
      setApproving(false);
    }
  }

  return (
    <div>
      {error && <div className={clinicStyles.error}>{error}</div>}
      <button
        type="button"
        className={clinicStyles.button}
        style={{ width: "auto", padding: "0 28px" }}
        onClick={approve}
        disabled={approving || approved}
      >
        {approving ? "Assigning…" : approved ? "Assigned" : "Approve and assign"}
      </button>
    </div>
  );
}
