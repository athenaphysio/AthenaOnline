"use client";

import { useState } from "react";
import Link from "next/link";
import clinicStyles from "../clinic.module.css";

export default function SaveAsTemplateButton({ programmeId }: { programmeId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/clinic/programmes/${programmeId}/save-as-template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed.");
      setTemplateId(data.template_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed.");
    } finally {
      setSaving(false);
    }
  }

  if (templateId) {
    return (
      <div className={clinicStyles.shareLinkCard} style={{ marginTop: 16 }}>
        <div className={clinicStyles.smallLabel}>Saved as template</div>
        <div className={clinicStyles.shareLinkText}>
          A standalone copy — not tied to this patient, and editing it won&apos;t change their programme.{" "}
          <Link href={`/clinic/programme-templates/${templateId}`} style={{ color: "var(--crimson)" }}>
            Open the new template →
          </Link>
        </div>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        className={clinicStyles.buttonSecondary}
        style={{ marginTop: 16 }}
        onClick={() => setOpen(true)}
      >
        Save as template
      </button>
    );
  }

  return (
    <div className={clinicStyles.card} style={{ marginTop: 16 }}>
      <div className={clinicStyles.cardTitle}>Save as template</div>
      <p style={{ fontSize: 13.5, color: "var(--stone)", marginBottom: 12 }}>
        Copies this programme&apos;s weekly schedule — sessions, workouts, exercises and prescriptions — into a
        new, reusable Programme Template. It&apos;s an independent copy: this patient&apos;s name and message
        aren&apos;t carried over, and nothing you edit in the template can change their live programme.
      </p>
      <div className={clinicStyles.field}>
        <label className={clinicStyles.label}>Template name</label>
        <input
          className={clinicStyles.input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Return to Running — Standard"
        />
      </div>
      {error && <div className={clinicStyles.error}>{error}</div>}
      <div style={{ display: "flex", gap: 10 }}>
        <button
          type="button"
          className={clinicStyles.button}
          style={{ width: "auto", padding: "0 20px" }}
          disabled={saving || !name.trim()}
          onClick={handleSave}
        >
          {saving ? "Saving…" : "Save as template"}
        </button>
        <button
          type="button"
          className={clinicStyles.buttonSecondary}
          style={{ width: "auto", padding: "0 20px" }}
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
