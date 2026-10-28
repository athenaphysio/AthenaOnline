"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import styles from "../../clinic/clinic.module.css";

export default function VerifyForm({ name }: { name: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sentOnce = useRef(false);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/coach/verify/send", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "The code could not be sent.");
        return;
      }
      setSentTo(data.sentTo);
      setMessage(`We have emailed a six digit code to ${data.sentTo}.`);
    } finally {
      setBusy(false);
    }
  }

  // Send the first code as soon as the page opens.
  useEffect(() => {
    if (sentOnce.current) return;
    sentOnce.current = true;
    void send();
  }, []);

  async function check(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/coach/verify/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "That did not work.");
        return;
      }
      router.replace("/coach");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/coach/logout", { method: "POST" });
    router.replace("/coach/login");
  }

  return (
    <div className={styles.app}>
      <div className={styles.centeredInner}>
        <div className={styles.brandbar}>
          <span className={styles.brandmark}>
            <Image src="/icons/athena-mark.png" alt="" width={22} height={22} />
          </span>
          <div className={styles.brandname}>Athena Physio, clinician login</div>
        </div>

        <h1 className={styles.heading}>Check your email</h1>
        <p className={styles.subheading}>
          Hello {name || "there"}. Because this is a new device, we need to confirm it is you. After this, the device is
          remembered for 30 days.
        </p>

        {error && <div className={styles.error}>{error}</div>}

        <form onSubmit={check} className={styles.card}>
          {message && <p className={styles.notice} style={{ marginTop: 0 }}>{message}</p>}
          <div className={styles.field} style={{ marginBottom: 0 }}>
            <label className={styles.label} htmlFor="code">
              Six digit code
            </label>
            <input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 ]*"
              maxLength={7}
              className={styles.input}
              style={{ fontSize: 24, letterSpacing: "0.3em", textAlign: "center" }}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, "").slice(0, 6))}
              required
              autoFocus
            />
          </div>
          <button type="submit" className={styles.button} disabled={busy || code.length !== 6} style={{ marginTop: 16 }}>
            {busy ? "One moment" : "Confirm"}
          </button>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, fontSize: 13 }}>
            <button type="button" onClick={send} disabled={busy} style={linkButton}>
              {sentTo ? "Send a new code" : "Send code"}
            </button>
            <button type="button" onClick={logout} style={linkButton}>
              Log out
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const linkButton = {
  background: "none",
  border: "none",
  padding: 0,
  color: "var(--crimson)",
  textDecoration: "underline",
  cursor: "pointer",
  fontSize: 13,
} as const;
