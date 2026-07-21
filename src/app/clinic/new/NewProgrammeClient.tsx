"use client";

import { useState } from "react";
import Image from "next/image";
import styles from "../clinic.module.css";
import { scanForPii, type PiiFlag } from "@/lib/piiScan";
import type { ProgrammeDraft } from "@/lib/draftProgramme";
import ProgrammeEditor, {
  type EditorSlot,
  type LibraryExerciseOption,
} from "../ProgrammeEditor";

type Step = "input" | "review" | "editing";

const FLAG_LABELS: Record<PiiFlag["type"], string> = {
  name: "Possible name",
  date_of_birth: "Possible date",
  phone: "Possible phone number",
  email: "Possible email address",
  address: "Possible address",
  nhs_number: "Possible NHS number",
};

export default function NewProgrammeClient({
  exerciseLibrary,
}: {
  exerciseLibrary: LibraryExerciseOption[];
}) {
  const [step, setStep] = useState<Step>("input");
  const [brief, setBrief] = useState("");
  const [blockLengthWeeks, setBlockLengthWeeks] = useState(6);
  const [flags, setFlags] = useState<PiiFlag[]>([]);
  const [acknowledged, setAcknowledged] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProgrammeDraft | null>(null);
  const [programmeId, setProgrammeId] = useState<string | null>(null);
  const [draftCreatedAt, setDraftCreatedAt] = useState<string | null>(null);

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
        body: JSON.stringify({ brief, blockLengthWeeks }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Something went wrong.");
      }
      setDraft(data.draft);
      setProgrammeId(crypto.randomUUID());
      setDraftCreatedAt(new Date().toISOString());
      setStep("editing");
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
    setProgrammeId(null);
    setError(null);
    setStep("input");
  }

  const canSend = flags.length === 0 || acknowledged;

  if (step === "editing" && draft && programmeId && draftCreatedAt) {
    const initialSlots: EditorSlot[] = draft.slots.map((slot, i) => ({
      key: `slot-${i}`,
      weeks: slot.weeks,
    }));

    return (
      <div className={styles.app}>
        <div className={styles.wideInner}>
          <div className={styles.brandbar}>
            <Image src="/icons/athena-mark.png" alt="" width={26} height={26} />
            <div className={styles.brandname}>Athena Physio — Clinic</div>
          </div>
          <h1 className={styles.heading}>Review draft programme</h1>
          <p className={styles.subheading}>
            Nothing has been sent to the patient yet. Edit anything below, then click Send.
          </p>

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

          <ProgrammeEditor
            mode="create"
            programmeId={programmeId}
            shareCode={null}
            initialPatientFirstName=""
            initialTitle=""
            initialBlockLengthWeeks={blockLengthWeeks}
            initialSlots={initialSlots}
            initialAudioUrl={null}
            aiDraft={{
              block: draft.block,
              assumptions: draft.assumptions,
              confirmations: draft.confirmations,
              created_at: draftCreatedAt,
            }}
            exerciseLibrary={exerciseLibrary}
          />

          <div className={styles.actions}>
            <button type="button" className={styles.buttonSecondary} onClick={startOver}>
              Start a new brief
            </button>
          </div>
        </div>
      </div>
    );
  }

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
              <label className={styles.label}>Block length (weeks)</label>
              <input
                type="number"
                min={1}
                max={12}
                className={styles.input}
                value={blockLengthWeeks}
                onChange={(e) => setBlockLengthWeeks(Number(e.target.value) || 1)}
              />
            </div>
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
                <label
                  style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 12, fontSize: 13.5 }}
                >
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
                {loading ? "Generating draft…" : "Confirm & send"}
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
      </div>
    </div>
  );
}
