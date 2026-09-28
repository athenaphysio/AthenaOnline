"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ClinicBrandbar from "@/app/clinic/ClinicBrandbar";
import PatientPicker, { type Patient } from "@/app/clinic/PatientPicker";
import clinicStyles from "@/app/clinic/clinic.module.css";

// The third door alongside "Write it" (self-build) and "Say it" (guided,
// voice-brief-into-scaffold): paste a Twofold running framework note and
// let the app build the whole draft, ready for review. Its own screen
// rather than a third card on NewProgrammeChoice's "build" step, since
// that step's contract is "produce a BuilderState and jump straight into
// ProgrammeBuilder" -- Running Builder needs its own review screen first
// (see [id]/page.tsx), with ProgrammeBuilder only reachable afterward via
// its own explicit "Edit" button ([id]/edit/page.tsx).
export default function RunningBuilderPage() {
  const router = useRouter();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [note, setNote] = useState("");
  const [weeks, setWeeks] = useState(4);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function build() {
    if (!patient) {
      setError("Choose a client first.");
      return;
    }
    if (!note.trim()) {
      setError("Paste the running framework first.");
      return;
    }
    setBuilding(true);
    setError(null);
    try {
      const res = await fetch("/api/clinic/running-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patient_id: patient.id, note, weeks }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Build failed.");
      router.push(`/clinic/programmes/new/running-builder/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Build failed.");
      setBuilding(false);
    }
  }

  return (
    <div className={clinicStyles.app}>
      <div className={clinicStyles.wideInner}>
        <ClinicBrandbar />
        <h1 className={clinicStyles.heading}>Running Builder</h1>
        <p className={clinicStyles.subheading}>
          Paste David&apos;s Twofold running framework note and build the whole programme into the existing
          scaffolding, ready for review.
        </p>

        <div className={clinicStyles.card}>
          <div className={clinicStyles.cardTitle}>Client</div>
          <PatientPicker selected={patient} onSelect={setPatient} />
        </div>

        <div className={clinicStyles.card}>
          <div className={clinicStyles.cardTitle}>Running framework</div>
          <textarea
            className={clinicStyles.textarea}
            style={{ minHeight: 340 }}
            placeholder="Paste the Twofold running framework here"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div className={clinicStyles.card}>
          <div className={clinicStyles.cardTitle}>Programme length</div>
          <div className={clinicStyles.field} style={{ marginBottom: 0 }}>
            <label className={clinicStyles.label}>Weeks</label>
            <input
              type="number"
              min={1}
              max={12}
              className={clinicStyles.input}
              style={{ maxWidth: 120 }}
              value={weeks}
              onChange={(e) => setWeeks(Math.max(1, Math.min(12, Number(e.target.value) || 4)))}
            />
          </div>
        </div>

        {error && <div className={clinicStyles.error}>{error}</div>}

        <button
          type="button"
          className={clinicStyles.button}
          style={{ width: "auto", padding: "0 28px" }}
          onClick={build}
          disabled={building}
        >
          {building ? "Building…" : "Build programme"}
        </button>
      </div>
    </div>
  );
}
