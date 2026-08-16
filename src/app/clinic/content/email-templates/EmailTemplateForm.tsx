"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../../clinic.module.css";

export type EmailTemplateRow = {
  key: string;
  name: string;
  subject: string;
  body: string;
  status: "pending_review" | "approved";
  grandfathered: boolean;
  updated_at: string;
  updated_by: string | null;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// One card per email type -- a plain form, never a rich-text editor, so
// the body stays trivially copy/paste-friendly (see the Phase 2 brief).
// Approving and saving wording are the same action: there's no separate
// "approve" workflow step, just this one PATCH.
export default function EmailTemplateForm({ template }: { template: EmailTemplateRow }) {
  const router = useRouter();
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.body);
  const [status, setStatus] = useState(template.status);
  const [editedBy, setEditedBy] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [testSent, setTestSent] = useState(false);

  const dirty = subject !== template.subject || body !== template.body || status !== template.status;
  const canSendToday = status === "approved" || template.grandfathered;

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/clinic/email-templates/${template.key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body, status, updated_by: editedBy || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed.");
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSendTest() {
    setTesting(true);
    setTestError(null);
    setTestSent(false);
    try {
      const res = await fetch(`/api/clinic/email-templates/${template.key}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Test send failed.");
      setTestSent(true);
    } catch (err) {
      setTestError(err instanceof Error ? err.message : "Test send failed.");
    } finally {
      setTesting(false);
    }
  }

  const badge =
    status === "approved"
      ? { label: "Approved", background: "var(--accent-patients-soft)", color: "var(--accent-patients)" }
      : template.grandfathered
        ? { label: "Live, needs review", background: "var(--accent-content-soft)", color: "var(--accent-content)" }
        : { label: "Pending, blocked", background: "#FDF0E0", color: "#B45309" };

  return (
    <div className={styles.card} style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
        <div>
          <div className={styles.cardTitle} style={{ marginBottom: 2 }}>
            {template.name}
          </div>
          <div style={{ fontSize: 12, color: "var(--graphite)" }}>{template.key}</div>
        </div>
        <span className={styles.statusPill} style={{ background: badge.background, color: badge.color }}>
          {badge.label}
        </span>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Subject line</label>
        <input className={styles.input} value={subject} onChange={(e) => setSubject(e.target.value)} />
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Body text</label>
        <textarea className={styles.textarea} value={body} onChange={(e) => setBody(e.target.value)} />
        <p className={styles.notice} style={{ marginTop: 6 }}>
          Plain text only. Anything in double braces, like {"{{first_name}}"}, is filled in automatically per patient
          when the email sends.
        </p>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Status</label>
        <select
          className={styles.input}
          value={status}
          onChange={(e) => setStatus(e.target.value as "pending_review" | "approved")}
        >
          <option value="pending_review">Pending review</option>
          <option value="approved">Approved</option>
        </select>
        <p className={styles.notice} style={{ marginTop: 6 }}>
          {status === "approved"
            ? "Sends normally."
            : template.grandfathered
              ? "Already live in production, this is just flagged for your review, it keeps sending exactly as it does today until you change something."
              : "Genuinely blocked. This has never gone to a real patient and won't, no matter what triggers it, until you approve it."}
        </p>
      </div>

      <div className={styles.field} style={{ marginBottom: 12 }}>
        <label className={styles.label}>Your name (optional, for the record below)</label>
        <input className={styles.input} value={editedBy} onChange={(e) => setEditedBy(e.target.value)} placeholder="e.g. David" />
      </div>

      <div style={{ fontSize: 12, color: "var(--graphite)", marginBottom: 12 }}>
        Last edited {formatDate(template.updated_at)}
        {template.updated_by ? ` by ${template.updated_by}` : ""}.
        {!canSendToday && " Not currently sending to patients."}
      </div>

      {error && (
        <div className={styles.error} style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}
      {testError && (
        <div className={styles.error} style={{ marginBottom: 12 }}>
          {testError}
        </div>
      )}
      {testSent && (
        <p style={{ fontSize: 12.5, color: "var(--accent-patients)", marginBottom: 12 }}>
          Test sent to athenaphysio@gmail.com with sample details filled in.
        </p>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        <button
          type="button"
          className={styles.button}
          style={{ width: "auto", padding: "0 24px" }}
          disabled={saving || !dirty}
          onClick={handleSave}
        >
          {saving ? "Saving…" : saved && !dirty ? "Saved" : "Save"}
        </button>
        <button
          type="button"
          className={styles.buttonSecondary}
          style={{ width: "auto", padding: "0 24px" }}
          disabled={testing}
          onClick={handleSendTest}
        >
          {testing ? "Sending…" : "Send test to my inbox"}
        </button>
      </div>
    </div>
  );
}
