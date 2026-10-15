"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./clinic.module.css";

type Outcome = { kind: "sent"; email: string } | { kind: "saved-not-sent"; email: string; reason: string };

// "Add client": three boxes and an optional note. The server saves the
// client, creates their login and emails them a link to choose their own
// password. David never sees or sets a password.
export default function AddClientButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  function close() {
    setOpen(false);
    setFirstName("");
    setLastName("");
    setEmail("");
    setNotes("");
    setError(null);
    setOutcome(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/clinic/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ first_name: firstName, last_name: lastName, email, notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "That did not work.");
      setOutcome(
        data.email_sent
          ? { kind: "sent", email }
          : { kind: "saved-not-sent", email, reason: data.email_error ?? "The email could not be sent." }
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not work.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={styles.buttonSecondary}
        style={{ width: "auto", padding: "0 20px" }}
        onClick={() => setOpen(true)}
      >
        Add client
      </button>

      {open && (
        <div
          onClick={close}
          style={{ position: "fixed", inset: 0, background: "rgba(20,8,8,0.55)", zIndex: 60, display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "40px 16px", overflowY: "auto" }}
        >
          <div
            role="dialog"
            aria-label="Add client"
            onClick={(e) => e.stopPropagation()}
            style={{ width: "min(480px, 100%)", background: "var(--clinic-box)", color: "var(--ink)", borderRadius: 14, padding: 20, boxShadow: "0 12px 40px rgba(0,0,0,0.35)" }}
          >
            {outcome ? (
              <>
                <h2 style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 20, margin: "0 0 10px" }}>
                  {outcome.kind === "sent" ? "Invitation sent" : "Client saved, email not sent"}
                </h2>
                {outcome.kind === "sent" ? (
                  <p className={styles.notice} style={{ marginTop: 0 }}>
                    A welcome email is on its way to {outcome.email}. They will show as Invited until they choose a
                    password.
                  </p>
                ) : (
                  <p className={styles.notice} style={{ marginTop: 0 }}>
                    {outcome.email} has been added and shows as Invited, but the email did not go out ({outcome.reason}).
                    Use Resend invite next to their name to try again.
                  </p>
                )}
                <button type="button" className={styles.button} style={{ width: "auto", padding: "0 22px" }} onClick={close}>
                  Done
                </button>
              </>
            ) : (
              <form onSubmit={submit}>
                <h2 style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 20, margin: "0 0 12px" }}>Add client</h2>
                <div className={styles.row2}>
                  <div className={styles.field}>
                    <label className={styles.label}>First name</label>
                    <input className={styles.input} value={firstName} onChange={(e) => setFirstName(e.target.value)} required autoFocus />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Last name</label>
                    <input className={styles.input} value={lastName} onChange={(e) => setLastName(e.target.value)} required />
                  </div>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Email address</label>
                  <input type="email" className={styles.input} value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Notes (optional, only you see these)</label>
                  <textarea className={styles.textarea} style={{ minHeight: 70 }} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
                {error && <div className={styles.error}>{error}</div>}
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button type="submit" className={styles.button} style={{ width: "auto", padding: "0 22px" }} disabled={saving}>
                    {saving ? "Adding…" : "Add client"}
                  </button>
                  <button type="button" className={styles.buttonSecondary} style={{ width: "auto", padding: "0 18px" }} onClick={close}>
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
