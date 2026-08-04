"use client";

import { useEffect, useRef, useState } from "react";
import AudioRecorder from "../../AudioRecorder";
import { scanForPii, type PiiFlag } from "@/lib/piiScan";
import clinicStyles from "../../clinic.module.css";
import styles from "./NewProgrammeChoice.module.css";

const FLAG_LABELS: Record<PiiFlag["type"], string> = {
  name: "Possible name",
  date_of_birth: "Possible date",
  phone: "Possible phone number",
  email: "Possible email address",
  address: "Possible address",
  nhs_number: "Possible NHS number",
};

export type ScaffoldBriefConfirmed = {
  focus: string;
  weeks: number;
  sessionsPerWeek: number;
  equipment: string;
  experienceLevel: string;
  brief: string;
};

type Phase = "record" | "pii-review" | "extracting" | "confirm" | "error";

const EXPERIENCE_LABELS: Record<string, string> = {
  beginner: "Beginner experience",
  intermediate: "Intermediate experience",
  advanced: "Advanced experience",
};

type Props = {
  onConfirm: (fields: ScaffoldBriefConfirmed) => void;
  onBack: () => void;
};

// Records a spoken description the same way AudioRecorder already works
// elsewhere, transcribes it, extracts the same five fields the scaffold
// panel's own form asks for, and lets David correct anything before
// handing them on -- nothing here duplicates the scaffold generator itself,
// it only gets these fields into his hands a different way.
export default function VoiceBriefFlow({ onConfirm, onBack }: Props) {
  const [phase, setPhase] = useState<Phase>("record");
  const [transcript, setTranscript] = useState("");
  const [piiFlags, setPiiFlags] = useState<PiiFlag[]>([]);
  const [piiAcknowledged, setPiiAcknowledged] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [focus, setFocus] = useState("");
  const [weeks, setWeeks] = useState(4);
  const [sessionsPerWeek, setSessionsPerWeek] = useState(3);
  const [equipment, setEquipment] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("intermediate");

  const processedRef = useRef(false);

  async function handleUpload(blob: Blob): Promise<string> {
    const formData = new FormData();
    formData.append("audio", blob, "recording.webm");
    const res = await fetch("/api/clinic/audio/voice-brief", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Couldn't process the recording.");
    processedRef.current = false;
    setTranscript(data.transcript);
    return data.url;
  }

  // Fires once the transcript comes back from handleUpload -- checked for
  // identifying details before it ever reaches Claude, same gate the
  // clinical brief field already uses elsewhere.
  useEffect(() => {
    if (!transcript || processedRef.current) return;
    processedRef.current = true;
    const flags = scanForPii(transcript);
    if (flags.length > 0) {
      setPiiFlags(flags);
      setPiiAcknowledged(false);
      setPhase("pii-review");
    } else {
      runExtract(transcript);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript]);

  async function runExtract(text: string) {
    setPhase("extracting");
    setErrorMessage(null);
    try {
      const res = await fetch("/api/clinic/programmes/scaffold-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't read out the details.");
      setFocus(data.focus ?? "");
      setWeeks(data.weeks ?? 4);
      setSessionsPerWeek(data.sessions_per_week ?? 3);
      setEquipment(data.equipment ?? "");
      setExperienceLevel(data.experience_level ?? "intermediate");
      setPhase("confirm");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Couldn't read out the details.");
      setPhase("error");
    }
  }

  function startOver() {
    processedRef.current = false;
    setTranscript("");
    setPiiFlags([]);
    setPiiAcknowledged(false);
    setErrorMessage(null);
    setPhase("record");
  }

  const summaryLine = [
    focus.trim() || "(focus not set)",
    `${weeks} week${weeks === 1 ? "" : "s"}`,
    `${sessionsPerWeek} session${sessionsPerWeek === 1 ? "" : "s"}/week`,
    equipment.trim() || "No equipment specified",
    EXPERIENCE_LABELS[experienceLevel] ?? experienceLevel,
  ].join(" · ");

  return (
    <div>
      <button type="button" className={styles.backLink} onClick={onBack}>
        ← Back
      </button>

      <div className={clinicStyles.card}>
        <div className={clinicStyles.cardTitle}>New template from voice brief</div>

        {phase === "record" && (
          <>
            <p style={{ fontSize: 13.5, color: "var(--stone)", marginBottom: 14 }}>
              Describe the programme out loud -- focus or sport, how many weeks, sessions per week, what
              equipment&apos;s available, and the client&apos;s experience level. You&apos;ll see exactly what
              was picked up before anything gets built.
            </p>
            <AudioRecorder existingUrl={null} onUpload={handleUpload} />
          </>
        )}

        {phase === "pii-review" && (
          <>
            <div className={clinicStyles.warningCard}>
              <div className={clinicStyles.warningTitle}>
                {piiFlags.length} possible identifier{piiFlags.length === 1 ? "" : "s"} found in the transcript
              </div>
              {piiFlags.map((flag, i) => (
                <div key={i} className={clinicStyles.warningItem}>
                  <b>{FLAG_LABELS[flag.type]}:</b> &ldquo;{flag.match}&rdquo;
                  <br />
                  <span style={{ color: "var(--muted)" }}>…{flag.context}…</span>
                </div>
              ))}
              <label style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 12, fontSize: 13.5 }}>
                <input
                  type="checkbox"
                  checked={piiAcknowledged}
                  onChange={(e) => setPiiAcknowledged(e.target.checked)}
                  style={{ marginTop: 3 }}
                />
                <span>
                  I&apos;ve reviewed the above. It&apos;s clinical content only, not an identifier, send anyway.
                </span>
              </label>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button
                type="button"
                className={clinicStyles.button}
                style={{ width: "auto", padding: "0 20px" }}
                disabled={!piiAcknowledged}
                onClick={() => runExtract(transcript)}
              >
                Confirm & continue
              </button>
              <button type="button" className={clinicStyles.buttonSecondary} style={{ width: "auto", padding: "0 20px" }} onClick={startOver}>
                Start over
              </button>
            </div>
          </>
        )}

        {phase === "extracting" && <div className={clinicStyles.notice}>Reading out the details…</div>}

        {phase === "error" && (
          <>
            {errorMessage && <div className={clinicStyles.error}>{errorMessage}</div>}
            <button type="button" className={clinicStyles.buttonSecondary} onClick={startOver}>
              Try again
            </button>
          </>
        )}

        {phase === "confirm" && (
          <>
            <p style={{ fontSize: 13.5, color: "var(--stone)", marginBottom: 8 }}>
              Here&apos;s what was picked up. Fix anything that&apos;s wrong before continuing -- nothing gets
              built until you confirm.
            </p>
            <div
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: "var(--ink)",
                background: "var(--clinic-box-recessed)",
                border: "1px solid var(--mist)",
                borderRadius: 8,
                padding: "10px 12px",
                marginBottom: 14,
              }}
            >
              {summaryLine}
            </div>

            <div className={clinicStyles.row2}>
              <div className={clinicStyles.field}>
                <label className={clinicStyles.label}>Focus</label>
                <input className={clinicStyles.input} value={focus} onChange={(e) => setFocus(e.target.value)} />
              </div>
              <div className={clinicStyles.field}>
                <label className={clinicStyles.label}>Experience level</label>
                <select
                  className={clinicStyles.input}
                  value={experienceLevel}
                  onChange={(e) => setExperienceLevel(e.target.value)}
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
            </div>

            <div className={clinicStyles.row2}>
              <div className={clinicStyles.field}>
                <label className={clinicStyles.label}>Weeks</label>
                <input
                  type="number"
                  min={1}
                  max={12}
                  className={clinicStyles.input}
                  value={weeks}
                  onChange={(e) => setWeeks(Math.max(1, Math.min(12, Number(e.target.value) || 1)))}
                />
              </div>
              <div className={clinicStyles.field}>
                <label className={clinicStyles.label}>Sessions per week</label>
                <input
                  type="number"
                  min={1}
                  max={7}
                  className={clinicStyles.input}
                  value={sessionsPerWeek}
                  onChange={(e) => setSessionsPerWeek(Math.max(1, Math.min(7, Number(e.target.value) || 1)))}
                />
              </div>
            </div>

            <div className={clinicStyles.field} style={{ marginBottom: 0 }}>
              <label className={clinicStyles.label}>Equipment available</label>
              <input className={clinicStyles.input} value={equipment} onChange={(e) => setEquipment(e.target.value)} />
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button
                type="button"
                className={clinicStyles.button}
                style={{ width: "auto", padding: "0 20px" }}
                disabled={!focus.trim()}
                onClick={() =>
                  onConfirm({ focus: focus.trim(), weeks, sessionsPerWeek, equipment: equipment.trim(), experienceLevel, brief: transcript })
                }
              >
                Continue
              </button>
              <button type="button" className={clinicStyles.buttonSecondary} style={{ width: "auto", padding: "0 20px" }} onClick={startOver}>
                Re-record
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
