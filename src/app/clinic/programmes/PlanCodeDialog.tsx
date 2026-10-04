"use client";

import { useRef, useState } from "react";
import { validateAthenaPlan, type AthenaPlanV1 } from "@/lib/athenaPlan";
import type { Patient } from "../PatientPicker";
import clinicStyles from "../clinic.module.css";
import styles from "./ProgrammeBuilderBar.module.css";

type Stage = "paste" | "name" | "placement";

type Props = {
  client: Patient | null;
  hasSessions: boolean;
  onBuild: (plan: AthenaPlanV1, how: "replace" | "add") => void;
  /** No client chosen yet: hand back the name written in the plan code. */
  onPrefillClient: (name: string) => void;
  onClose: () => void;
};

// "Paste plan code": checks the code against athena-plan-v1 (the same
// validation the Import plan screen uses, no AI), then asks only what it
// needs to before the builder is filled in.
export default function PlanCodeDialog({ client, hasSessions, onBuild, onPrefillClient, onClose }: Props) {
  const [text, setText] = useState("");
  const [errors, setErrors] = useState<string[] | null>(null);
  const [stage, setStage] = useState<Stage>("paste");
  const [plan, setPlan] = useState<AthenaPlanV1 | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Reads a dropped or chosen .json or .txt file into the box. The code is
  // then checked when Build is pressed, exactly as if it had been pasted.
  async function loadFile(file: File | undefined) {
    if (!file) return;
    if (!/\.(json|txt)$/i.test(file.name)) {
      setErrors(["Please choose a .json or .txt file."]);
      return;
    }
    try {
      setText(await file.text());
      setErrors(null);
    } catch {
      setErrors(["That file could not be read."]);
    }
  }

  function finish(p: AthenaPlanV1, how: "replace" | "add") {
    if (!client) onPrefillClient(p.client_name);
    onBuild(p, how);
  }

  function afterNameCheck(p: AthenaPlanV1) {
    if (hasSessions) {
      setStage("placement");
    } else {
      finish(p, "replace");
    }
  }

  function handleBuild() {
    setErrors(null);
    if (!text.trim()) {
      setErrors(["Paste the plan code first."]);
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      setErrors([`That isn't valid JSON: ${detail}`]);
      return;
    }
    const result = validateAthenaPlan(parsed, { allowAnyDay: true });
    if (!result.valid) {
      setErrors(result.errors);
      return;
    }
    setPlan(result.plan);

    // Same loose first-name match the Import plan screen uses.
    if (client && !result.plan.client_name.toLowerCase().includes(client.first_name.toLowerCase())) {
      setStage("name");
      return;
    }
    afterNameCheck(result.plan);
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Paste plan code">
        {stage === "paste" && (
          <>
            <h2 className={styles.modalTitle}>Paste the plan code from Claude here</h2>
            <textarea
              className={clinicStyles.textarea}
              style={{ minHeight: 280 }}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                loadFile(e.dataTransfer.files?.[0]);
              }}
              placeholder="Paste the plan code from Claude here"
              autoFocus
            />
            <input
              ref={fileInput}
              type="file"
              accept=".json,.txt,application/json,text/plain"
              hidden
              onChange={(e) => {
                loadFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              className={styles.btnSecondary}
              style={{ width: "auto", padding: "0 14px", height: 32, fontSize: 13, marginTop: 8 }}
              onClick={() => fileInput.current?.click()}
            >
              Choose file
            </button>
            {errors && errors.length > 0 && (
              <div className={clinicStyles.warningCard} style={{ marginTop: 12 }}>
                <div className={clinicStyles.warningTitle}>
                  {errors.length} thing{errors.length === 1 ? "" : "s"} to fix in the plan code
                </div>
                {errors.map((e, i) => (
                  <div key={i} className={clinicStyles.warningItem}>
                    {e}
                  </div>
                ))}
              </div>
            )}
            <div className={styles.modalActions}>
              <button type="button" className={styles.btnPrimary} style={{ width: "auto", padding: "0 22px" }} onClick={handleBuild}>
                Build
              </button>
              <button type="button" className={styles.btnQuiet} style={{ width: "auto", padding: "0 18px" }} onClick={onClose}>
                Cancel
              </button>
            </div>
          </>
        )}

        {stage === "name" && plan && client && (
          <>
            <div className={clinicStyles.warningCard}>
              <div className={clinicStyles.warningTitle}>Client name doesn&apos;t match</div>
              <div className={clinicStyles.warningItem}>
                This plan says it&apos;s for &quot;{plan.client_name}&quot;, but the client chosen here is{" "}
                {client.first_name}. Build it anyway?
              </div>
            </div>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.btnPrimary}
                style={{ width: "auto", padding: "0 22px" }}
                onClick={() => afterNameCheck(plan)}
              >
                Build anyway
              </button>
              <button type="button" className={styles.btnQuiet} style={{ width: "auto", padding: "0 18px" }} onClick={() => setStage("paste")}>
                Back
              </button>
            </div>
          </>
        )}

        {stage === "placement" && plan && (
          <>
            <h2 className={styles.modalTitle}>Replace what&apos;s here, or add to it?</h2>
            <p className={clinicStyles.notice} style={{ marginTop: 0 }}>
              The grid already has sessions on it.
            </p>
            <div className={styles.modalActions}>
              <button type="button" className={styles.btnPrimary} style={{ width: "auto", padding: "0 22px" }} onClick={() => finish(plan, "replace")}>
                Replace what&apos;s here
              </button>
              <button type="button" className={styles.btnSecondary} style={{ width: "auto", padding: "0 18px" }} onClick={() => finish(plan, "add")}>
                Add to it
              </button>
              <button type="button" className={styles.btnQuiet} style={{ width: "auto", padding: "0 18px" }} onClick={onClose}>
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
