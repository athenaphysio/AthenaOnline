"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clinicStyles from "../../../clinic.module.css";

export default function ImportPlanForm({ patientId }: { patientId: string }) {
  const router = useRouter();
  const [rawText, setRawText] = useState("");
  const [errors, setErrors] = useState<string[] | null>(null);
  const [mismatch, setMismatch] = useState<{ planClientName: string; patientName: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(force: boolean) {
    setSubmitting(true);
    setErrors(null);
    if (!force) setMismatch(null);
    try {
      const res = await fetch(`/api/clinic/patients/${patientId}/imported-plans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw_text: rawText, force }),
      });
      const data = await res.json();
      if (data.mismatch) {
        setMismatch({ planClientName: data.planClientName, patientName: data.patientName });
        return;
      }
      if (!res.ok) {
        setErrors(data.errors ?? ["That didn't work."]);
        return;
      }
      router.push(`/clinic/patients/${patientId}/import-plan/${data.id}`);
    } catch {
      setErrors(["That didn't work. Please try again."]);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className={clinicStyles.card}>
        <div className={clinicStyles.cardTitle}>Plan code</div>
        <textarea
          className={clinicStyles.textarea}
          style={{ minHeight: 340 }}
          placeholder="Paste the plan code from Claude here"
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
        />
      </div>

      {errors && errors.length > 0 && (
        <div className={clinicStyles.warningCard}>
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

      {mismatch && (
        <div className={clinicStyles.warningCard}>
          <div className={clinicStyles.warningTitle}>Client name doesn't match</div>
          <div className={clinicStyles.warningItem}>
            This plan says it's for &quot;{mismatch.planClientName}&quot;, but you're on {mismatch.patientName}&apos;s
            page. Import it anyway?
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button
              type="button"
              className={clinicStyles.buttonSecondary}
              style={{ width: "auto", padding: "0 16px" }}
              onClick={() => setMismatch(null)}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className={clinicStyles.button}
              style={{ width: "auto", padding: "0 16px" }}
              onClick={() => submit(true)}
              disabled={submitting}
            >
              Import anyway
            </button>
          </div>
        </div>
      )}

      {!mismatch && (
        <button
          type="button"
          className={clinicStyles.button}
          style={{ width: "auto", padding: "0 28px" }}
          onClick={() => submit(false)}
          disabled={submitting || !rawText.trim()}
        >
          {submitting ? "Checking…" : "Import plan"}
        </button>
      )}
    </div>
  );
}
