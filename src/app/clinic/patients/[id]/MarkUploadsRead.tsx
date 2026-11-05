"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clinicStyles from "../../clinic.module.css";

export default function MarkUploadsRead({ patientId }: { patientId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className={clinicStyles.buttonSecondary}
      style={{ width: "auto", padding: "0 14px", height: 32, fontSize: 13, marginBottom: 6 }}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch(`/api/clinic/patients/${patientId}/uploaded-workouts`, { method: "POST" });
        router.refresh();
        setBusy(false);
      }}
    >
      Mark all as read
    </button>
  );
}
