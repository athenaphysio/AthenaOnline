"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clinicStyles from "../../clinic.module.css";

type ProgrammeSource = "subscription_gated" | "owned" | "clinician_assigned";

const SOURCE_OPTIONS: { value: ProgrammeSource; label: string }[] = [
  { value: "clinician_assigned", label: "Clinician-assigned" },
  { value: "subscription_gated", label: "Subscription-gated" },
  { value: "owned", label: "Owned outright" },
];

type Props = {
  programmeId: string;
  initialPaused: boolean;
  initialSource: ProgrammeSource;
};

// The actual "unassign" / "reassign" control -- doesn't delete anything,
// just flips whether this programme is currently returned to the patient's
// own session pages. Same mechanism the membership-lapse webhook calls
// automatically; this is the manual, clinician-driven version of it.
//
// The source dropdown alongside it is the manual override -- everything
// tags itself automatically at creation time (POST /api/clinic/programmes),
// this is the one place to reclassify a specific programme by hand for the
// rare exception.
export default function ProgrammeAccessToggle({ programmeId, initialPaused, initialSource }: Props) {
  const router = useRouter();
  const [paused, setPaused] = useState(initialPaused);
  const [source, setSource] = useState(initialSource);
  const [savingAccess, setSavingAccess] = useState(false);
  const [savingSource, setSavingSource] = useState(false);

  async function toggleAccess() {
    const next = !paused;
    setSavingAccess(true);
    try {
      const res = await fetch(`/api/clinic/programmes/${programmeId}/access`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !next }),
      });
      if (!res.ok) throw new Error("Failed.");
      setPaused(next);
      router.refresh();
    } catch {
      // Leave as-is on failure.
    } finally {
      setSavingAccess(false);
    }
  }

  async function changeSource(next: ProgrammeSource) {
    const previous = source;
    setSource(next);
    setSavingSource(true);
    try {
      const res = await fetch(`/api/clinic/programmes/${programmeId}/source`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: next }),
      });
      if (!res.ok) throw new Error("Failed.");
      router.refresh();
    } catch {
      setSource(previous);
    } finally {
      setSavingSource(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <select
        value={source}
        disabled={savingSource}
        onChange={(e) => changeSource(e.target.value as ProgrammeSource)}
        style={{
          fontSize: 11.5,
          color: "var(--muted)",
          border: "1px solid var(--frost)",
          borderRadius: 6,
          padding: "3px 5px",
          background: "var(--surface)",
        }}
      >
        {SOURCE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {paused && <span className={`${clinicStyles.statusPill} ${clinicStyles.statusLapsed}`}>Access paused</span>}
      <button
        type="button"
        onClick={toggleAccess}
        disabled={savingAccess}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          fontSize: 12.5,
          color: "var(--crimson)",
          cursor: "pointer",
        }}
      >
        {savingAccess ? "…" : paused ? "Reassign" : "Unassign"}
      </button>
    </div>
  );
}
