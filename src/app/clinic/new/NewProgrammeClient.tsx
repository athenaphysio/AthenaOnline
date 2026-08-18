"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "../clinic.module.css";
import { scanForPii, type PiiFlag } from "@/lib/piiScan";
import type { BlockDraft } from "@/lib/draftBlock";
import ClinicBrandbar from "../ClinicBrandbar";
import { useUnsavedChanges } from "../useUnsavedChanges";
import BlockBuilder, {
  type EditorItem,
  type LibraryExerciseOption,
} from "../blocks/BlockBuilder";
import type { BlockUsageTag } from "@/lib/blockUsageTags";

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
  usageTagCatalog,
}: {
  exerciseLibrary: LibraryExerciseOption[];
  usageTagCatalog: BlockUsageTag[];
}) {
  const [step, setStep] = useState<Step>("input");
  const [brief, setBrief] = useState("");
  const [blockLengthWeeks, setBlockLengthWeeks] = useState(6);
  const [flags, setFlags] = useState<PiiFlag[]>([]);
  const [acknowledged, setAcknowledged] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<BlockDraft | null>(null);
  const [blockId, setBlockId] = useState<string | null>(null);
  const [draftCreatedAt, setDraftCreatedAt] = useState<string | null>(null);

  // Only the brief text is tracked here -- once generation succeeds it's
  // cleared and step flips to "editing", at which point the embedded
  // BlockBuilder below takes over as the sole source of unsaved-changes
  // truth for that stage via its own instance of this same hook.
  useUnsavedChanges({ brief });

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

      // A failure at this point (timeout, proxy error) comes back as a
      // plain-text page, not JSON -- parsing that with res.json() throws a
      // generic, useless "not valid JSON" error. Read the body once as text
      // and only parse it as JSON, so a non-JSON response gets a message
      // that actually says what happened instead of a parser error.
      const raw = await res.text();
      let data: { draft?: BlockDraft; error?: string };
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error(
          `The server didn't return a usable response (status ${res.status}). This usually means the request took too long -- try again.`
        );
      }
      if (!res.ok) {
        throw new Error(data.error || "Something went wrong.");
      }
      setDraft(data.draft!);
      setBlockId(crypto.randomUUID());
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
    setBlockId(null);
    setError(null);
    setStep("input");
  }

  const canSend = flags.length === 0 || acknowledged;

  if (step === "editing" && draft && blockId && draftCreatedAt) {
    // The AI scaffold doesn't reason about prescription mode -- every drill
    // it drafts starts in Reps & Sets, same as a manually added exercise;
    // David switches individual ones to Time under load afterward.
    const initialItems: EditorItem[] = draft.slots.map((slot, i) => ({
      key: `item-${i}`,
      weeks: slot.weeks.map((w) => ({ ...w, prescription_mode: "reps_and_sets" as const })),
    }));

    return (
      <div className={styles.app}>
        <div className={styles.wideInner}>
          <ClinicBrandbar />
          <h1 className={styles.heading}>Review draft block</h1>
          <p className={styles.subheading}>
            Nothing is saved yet. Edit anything below, give it a name, then save it to your Block
            library.
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

          <BlockBuilder
            mode="create"
            blockId={blockId}
            initialName=""
            initialType="main_body"
            initialBlockLengthWeeks={blockLengthWeeks}
            initialItems={initialItems}
            aiDraft={{
              block: draft.block,
              assumptions: draft.assumptions,
              confirmations: draft.confirmations,
              created_at: draftCreatedAt,
            }}
            exerciseLibrary={exerciseLibrary}
            usageTagCatalog={usageTagCatalog}
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
        <ClinicBrandbar />

        <h1 className={styles.heading}>New block from a brief</h1>
        <p className={styles.subheading} style={{ marginTop: -12 }}>
          <Link href="/clinic/blocks" className={styles.canvasLink}>
            Blocks
          </Link>{" "}
          ·{" "}
          <Link href="/clinic/workouts" className={styles.canvasLink}>
            Workouts
          </Link>{" "}
          ·{" "}
          <Link href="/clinic/programmes" className={styles.canvasLink}>
            Programmes
          </Link>
        </p>

        {step === "input" && (
          <>
            <p className={styles.subheading}>
              Paste a clinical brief below. Nothing is sent anywhere until you&apos;ve reviewed and
              confirmed it.
            </p>
            {/* A light card, not a bare field on the canvas -- see the
                matching comment in BlockBuilder.tsx. */}
            <div className={styles.card}>
              <div className={styles.field} style={{ marginBottom: 0 }}>
                <label className={styles.label}>Block length (weeks)</label>
                <input
                  type="number"
                  min={1}
                  max={12}
                  className={styles.input}
                  style={{ maxWidth: 160 }}
                  value={blockLengthWeeks}
                  onChange={(e) => setBlockLengthWeeks(Number(e.target.value) || 1)}
                />
              </div>
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
