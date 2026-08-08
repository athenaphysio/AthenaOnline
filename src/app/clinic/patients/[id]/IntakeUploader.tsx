"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clinicStyles from "../../clinic.module.css";
import type { IntakeFormFields } from "@/lib/extractIntakeForm";

type Props = {
  patientId: string;
};

const FIELD_ORDER: (keyof IntakeFormFields)[] = [
  "presenting_complaint",
  "date_of_onset",
  "mechanism_of_injury",
  "body_region",
  "referred_via",
  "referral_goals_history",
];

const FIELD_LABELS: Record<keyof IntakeFormFields, string> = {
  presenting_complaint: "Presenting complaint",
  date_of_onset: "Date of onset",
  mechanism_of_injury: "Mechanism of injury",
  body_region: "Body region",
  referred_via: "Referred via",
  referral_goals_history: "Goals / relevant history",
};

// Drag-and-drop or click-to-choose an intake form -> upload + read in one
// request -> review every field before anything touches the patient row.
// Mirrors ImageUploader.tsx's drag-and-drop shape, but "upload" here always
// leads to a review step rather than handing back a URL immediately.
export default function IntakeUploader({ patientId }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [reviewFields, setReviewFields] = useState<IntakeFormFields | null>(null);
  const [currentFields, setCurrentFields] = useState<IntakeFormFields | null>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    setReviewFields(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/clinic/patients/${patientId}/intake/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't read that form.");
      setFileName(data.document.fileName);
      setReviewFields(data.extracted);
      setCurrentFields(data.current);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that form.");
    } finally {
      setUploading(false);
    }
  }

  function updateField(key: keyof IntakeFormFields, value: string) {
    setReviewFields((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function keepCurrent(key: keyof IntakeFormFields) {
    if (!currentFields) return;
    updateField(key, currentFields[key]);
  }

  async function handleConfirm() {
    if (!reviewFields) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/clinic/patients/${patientId}/intake/save`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reviewFields),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed.");
      setReviewFields(null);
      setCurrentFields(null);
      setFileName(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setReviewFields(null);
    setCurrentFields(null);
    setFileName(null);
    setError(null);
  }

  if (reviewFields && currentFields) {
    return (
      <div>
        <p style={{ fontSize: 13, color: "var(--graphite)", marginTop: 0, marginBottom: 14 }}>
          Read from &ldquo;{fileName}&rdquo;. Nothing&apos;s saved yet -- check each field, then confirm.
        </p>
        {FIELD_ORDER.map((key) => {
          const currentValue = currentFields[key];
          const hasConflict = currentValue.trim().length > 0 && currentValue.trim() !== reviewFields[key].trim();
          return (
            <div key={key} className={clinicStyles.field}>
              <label className={clinicStyles.label}>{FIELD_LABELS[key]}</label>
              <textarea
                className={clinicStyles.input}
                style={{ minHeight: 56, resize: "vertical" }}
                value={reviewFields[key]}
                onChange={(e) => updateField(key, e.target.value)}
              />
              {hasConflict && (
                <div style={{ fontSize: 12, color: "var(--crimson-dark)", marginTop: 4 }}>
                  Already set to &ldquo;{currentValue}&rdquo;, replace?{" "}
                  <button
                    type="button"
                    onClick={() => keepCurrent(key)}
                    style={{
                      color: "var(--crimson)",
                      textDecoration: "underline",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                      font: "inherit",
                    }}
                  >
                    Keep current instead
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {error && <div className={clinicStyles.error}>{error}</div>}
        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button
            type="button"
            className={clinicStyles.button}
            style={{ width: "auto", padding: "0 20px" }}
            disabled={saving}
            onClick={handleConfirm}
          >
            {saving ? "Saving…" : "Confirm and save"}
          </button>
          <button
            type="button"
            className={clinicStyles.buttonSecondary}
            style={{ width: "auto", padding: "0 20px" }}
            onClick={handleCancel}
            disabled={saving}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? "var(--crimson)" : "var(--mist)"}`,
          borderRadius: 10,
          padding: "22px 16px",
          textAlign: "center",
          cursor: "pointer",
          background: dragOver ? "var(--clinic-box-recessed)" : "var(--clinic-box)",
          fontSize: 13,
          color: "var(--graphite)",
        }}
      >
        {uploading ? "Reading the form…" : "Drag an intake form here, or click to choose one (PDF, JPG, PNG, or DOCX)"}
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.docx,application/pdf,image/jpeg,image/png,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
      </div>
      {error && (
        <div className={clinicStyles.error} style={{ marginTop: 8 }}>
          {error}
        </div>
      )}
    </div>
  );
}
