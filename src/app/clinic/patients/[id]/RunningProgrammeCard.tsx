"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clinicStyles from "../../clinic.module.css";

type Rung = { rung_number: number; summary: string };

type Props = {
  patientId: string;
  ladderName: string;
  currentRung: number;
  rungs: Rung[];
  initialPainLimit: number;
  initialProgressionMode: "ask_first" | "automatic";
};

// David's running-specific levers on one client's record -- pain limit,
// ask-first-vs-automatic, and a manual rung override, see
// 0087_running_progression.sql. Only rendered when this client actually
// has a running_programme_state row (patients/[id]/page.tsx).
export default function RunningProgrammeCard({
  patientId,
  ladderName,
  currentRung,
  rungs,
  initialPainLimit,
  initialProgressionMode,
}: Props) {
  const router = useRouter();
  const [painLimit, setPainLimit] = useState(initialPainLimit);
  const [mode, setMode] = useState(initialProgressionMode);
  const [savingSettings, setSavingSettings] = useState(false);
  const [rungChoice, setRungChoice] = useState(currentRung);
  const [savingRung, setSavingRung] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveSettings(next: { pain_limit?: number; progression_mode?: "ask_first" | "automatic" }) {
    setSavingSettings(true);
    setError(null);
    try {
      const res = await fetch(`/api/clinic/patients/${patientId}/running-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed.");
    } finally {
      setSavingSettings(false);
    }
  }

  async function setRung() {
    setSavingRung(true);
    setError(null);
    try {
      const res = await fetch(`/api/clinic/patients/${patientId}/running-rung`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rung_number: rungChoice }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed.");
    } finally {
      setSavingRung(false);
    }
  }

  return (
    <div className={clinicStyles.card}>
      <div className={clinicStyles.cardTitle}>Running programme</div>
      <p className={clinicStyles.notice} style={{ marginTop: 0 }}>
        {ladderName}, currently on rung {currentRung}.
      </p>

      <div className={clinicStyles.field}>
        <label className={clinicStyles.label}>Pain limit (0 to 10)</label>
        <input
          type="number"
          min={0}
          max={10}
          className={clinicStyles.input}
          style={{ maxWidth: 100 }}
          value={painLimit}
          onChange={(e) => setPainLimit(Math.max(0, Math.min(10, Number(e.target.value) || 0)))}
          onBlur={() => saveSettings({ pain_limit: painLimit })}
          disabled={savingSettings}
        />
      </div>

      <div className={clinicStyles.field}>
        <label className={clinicStyles.label}>Progression</label>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className={mode === "ask_first" ? clinicStyles.button : clinicStyles.buttonSecondary}
            style={{ width: "auto", padding: "0 14px", height: 32, fontSize: 13 }}
            disabled={savingSettings}
            onClick={() => {
              setMode("ask_first");
              saveSettings({ progression_mode: "ask_first" });
            }}
          >
            Ask me first
          </button>
          <button
            type="button"
            className={mode === "automatic" ? clinicStyles.button : clinicStyles.buttonSecondary}
            style={{ width: "auto", padding: "0 14px", height: 32, fontSize: 13 }}
            disabled={savingSettings}
            onClick={() => {
              setMode("automatic");
              saveSettings({ progression_mode: "automatic" });
            }}
          >
            Automatic
          </button>
        </div>
      </div>

      <div className={clinicStyles.field} style={{ marginBottom: 0 }}>
        <label className={clinicStyles.label}>Set rung manually</label>
        <div style={{ display: "flex", gap: 8 }}>
          <select
            className={clinicStyles.input}
            value={rungChoice}
            onChange={(e) => setRungChoice(Number(e.target.value))}
          >
            {rungs.map((r) => (
              <option key={r.rung_number} value={r.rung_number}>
                Rung {r.rung_number}: {r.summary}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={clinicStyles.buttonSecondary}
            style={{ width: "auto", padding: "0 16px", height: 38, fontSize: 13, flexShrink: 0 }}
            disabled={savingRung || rungChoice === currentRung}
            onClick={setRung}
          >
            {savingRung ? "…" : "Set"}
          </button>
        </div>
      </div>

      {error && <div className={clinicStyles.error}>{error}</div>}
    </div>
  );
}
