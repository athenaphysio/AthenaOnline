"use client";

import { useState } from "react";
import Image from "next/image";
import styles from "../clinic.module.css";
import { scanForPii, type PiiFlag } from "@/lib/piiScan";
import { prescriptionChips } from "@/lib/prescription";
import type { ProgrammeDraft } from "@/lib/draftProgramme";

type Step = "input" | "review" | "result";

const FLAG_LABELS: Record<PiiFlag["type"], string> = {
  name: "Possible name",
  date_of_birth: "Possible date",
  phone: "Possible phone number",
  email: "Possible email address",
  address: "Possible address",
  nhs_number: "Possible NHS number",
};

export default function NewProgrammePage() {
  const [step, setStep] = useState<Step>("input");
  const [brief, setBrief] = useState("");
  const [flags, setFlags] = useState<PiiFlag[]>([]);
  const [acknowledged, setAcknowledged] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProgrammeDraft | null>(null);

  function handleScan() {
    const found = scanForPii(brief);
    setFlags(found);
    setAcknowledged(false);
    setStep("review");
  }

  async function handleConfirmSend() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/clinic/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Something went wrong.");
      }
      setDraft(data.draft);
      setStep("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function startOver() {
    setBrief("");
    setFlags([]);
    setAcknowledged(false);
    setDraft(null);
    setError(null);
    setStep("input");
  }

  const canSend = flags.length === 0 || acknowledged;

  return (
    <div className={styles.app}>
      <div className={styles.inner}>
        <div className={styles.brandbar}>
          <Image src="/icons/athena-mark.png" alt="" width={26} height={26} />
          <div className={styles.brandname}>Athena Physio — Clinic</div>
        </div>

        <h1 className={styles.heading}>New programme brief</h1>

        {step === "input" && (
          <>
            <p className={styles.subheading}>
              Paste your programme brief below. Nothing is sent anywhere until you&apos;ve
              reviewed and confirmed it.
            </p>
            <div className={styles.field}>
              <textarea
                className={styles.textarea}
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder="--- PROGRAMME BRIEF ---&#10;&#10;AGE:&#10;PRESENTATION:&#10;PRIMARY DRIVER:&#10;..."
              />
            </div>
            <button
              type="button"
              className={styles.button}
              disabled={!brief.trim()}
              onClick={handleScan}
            >
              Scan &amp; review
            </button>
          </>
        )}

        {step === "review" && (
          <>
            {flags.length > 0 && (
              <div className={styles.warningCard}>
                <div className={styles.warningTitle}>
                  {flags.length} possible identifier{flags.length === 1 ? "" : "s"} found
                </div>
                {flags.map((flag, i) => (
                  <div key={i} className={styles.warningItem}>
                    <b>{FLAG_LABELS[flag.type]}:</b> &ldquo;{flag.match}&rdquo;
                    <br />
                    <span style={{ color: "var(--muted)" }}>…{flag.context}…</span>
                  </div>
                ))}
                <label style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 12, fontSize: 13.5 }}>
                  <input
                    type="checkbox"
                    checked={acknowledged}
                    onChange={(e) => setAcknowledged(e.target.checked)}
                    style={{ marginTop: 3 }}
                  />
                  <span>
                    I&apos;ve reviewed the above. It&apos;s clinical content only, not an
                    identifier — send anyway.
                  </span>
                </label>
              </div>
            )}

            <div className={styles.card}>
              <div className={styles.cardTitle}>Exact text about to be sent</div>
              <div className={styles.pre}>{brief}</div>
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.button}
                disabled={!canSend || loading}
                onClick={handleConfirmSend}
              >
                {loading ? "Sending…" : "Confirm & send"}
              </button>
              <button
                type="button"
                className={styles.buttonSecondary}
                disabled={loading}
                onClick={() => setStep("input")}
              >
                Back to edit
              </button>
            </div>
          </>
        )}

        {step === "result" && draft && (
          <>
            <div className={styles.card}>
              <div className={styles.cardTitle}>What this is building</div>
              <p style={{ fontSize: 14, color: "var(--charcoal)", lineHeight: 1.55 }}>
                {draft.block}
              </p>
            </div>

            {draft.warnings.length > 0 && (
              <div className={styles.warningCard}>
                <div className={styles.warningTitle}>Flagged during generation</div>
                {draft.warnings.map((w, i) => (
                  <div key={i} className={styles.warningItem}>
                    {w}
                  </div>
                ))}
              </div>
            )}

            <div className={styles.card}>
              <div className={styles.cardTitle}>Exercises</div>
              {draft.exercises.map((ex, i) => {
                const chips = prescriptionChips(ex);
                return (
                  <div key={ex.exercise_id} className={i === 0 ? undefined : styles.exerciseRow}>
                    <div className={styles.exerciseName}>
                      {ex.name}
                      <span className={styles.exerciseId}>{ex.exercise_id}</span>
                    </div>
                    {chips.length > 0 && (
                      <div className={styles.dose}>
                        {chips.map((chip) => (
                          <span key={chip} className={styles.chip}>
                            {chip}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className={styles.rationale}>{ex.rationale}</p>
                  </div>
                );
              })}
            </div>

            <div className={styles.card}>
              <div className={styles.cardTitle}>Assumptions I&apos;ve made</div>
              <ul className={styles.list}>
                {draft.assumptions.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>

            <div className={styles.card}>
              <div className={styles.cardTitle}>What only you can confirm</div>
              <ul className={styles.list}>
                {draft.confirmations.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>

            <div className={styles.actions}>
              <button type="button" className={styles.buttonSecondary} onClick={startOver}>
                Start a new brief
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
