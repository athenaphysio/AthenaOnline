"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/components/passport/Passport.module.css";

type Props = {
  packageId: string;
  state: "not_signed" | "needs_resign" | "withdrawn" | "signed";
  fingerprint: string;
  signedLine: string | null;
  suggestedName: string;
};

export default function ConsentForm({ packageId, state, fingerprint, signedLine }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);

  async function post(payload: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/session/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ package_id: packageId, ...payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "That did not work.");
        if (data.refresh) router.refresh();
        return;
      }
      setConfirmWithdraw(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (state === "signed") {
    return (
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Your consent</div>
        <p className={styles.sectionBody}>{signedLine} You can withdraw it at any time, and from that moment nobody on the care team can see your information through the app.</p>
        {!confirmWithdraw ? (
          <button type="button" onClick={() => setConfirmWithdraw(true)} style={quietButton}>
            Withdraw my consent
          </button>
        ) : (
          <div style={{ marginTop: 10 }}>
            <p className={styles.sectionBody}>Are you sure? Your care team will no longer see your information through the app.</p>
            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <button type="button" disabled={busy} onClick={() => post({ action: "withdraw" })} style={primaryButton}>
                Yes, withdraw
              </button>
              <button type="button" onClick={() => setConfirmWithdraw(false)} style={quietButton}>
                Keep my consent
              </button>
            </div>
          </div>
        )}
        {error && <p className={styles.sectionBody} style={{ color: "#b45309", marginTop: 8 }}>{error}</p>}
      </div>
    );
  }

  return (
    <form
      className={styles.section}
      onSubmit={(e) => {
        e.preventDefault();
        void post({ action: "sign", signed_name: name, agreed, fingerprint });
      }}
    >
      <div className={styles.sectionTitle}>Sign</div>
      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14, lineHeight: 1.5 }}>
        <input id="consent-agree" type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={{ marginTop: 4 }} />
        I have read this page and I agree to the people listed seeing the parts of my record shown beside their names.
      </label>
      <label htmlFor="consent-name" style={{ display: "block", fontSize: 13, color: "var(--muted)", marginTop: 14 }}>
        Type your full name to sign
      </label>
      <input
        id="consent-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoComplete="name"
        style={{ width: "100%", fontSize: 16, padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 10, marginTop: 6, boxSizing: "border-box" }}
      />
      {error && <p className={styles.sectionBody} style={{ color: "#b45309", marginTop: 8 }}>{error}</p>}
      <button type="submit" disabled={busy || !agreed || name.trim().length < 2} style={{ ...primaryButton, marginTop: 14, width: "100%" }}>
        {busy ? "One moment" : "Sign"}
      </button>
      <p className={styles.sectionBody} style={{ fontSize: 13, color: "var(--muted)", marginTop: 10 }}>
        Signing is your choice. If you do not sign, you can still use the app, but your care team will not see your information through it.
      </p>
    </form>
  );
}

const primaryButton = {
  background: "var(--crimson)",
  color: "#fff",
  border: "none",
  borderRadius: 10,
  padding: "12px 18px",
  fontSize: 15,
  fontWeight: 500,
  cursor: "pointer",
} as const;

const quietButton = {
  background: "none",
  border: "1px solid var(--border)",
  borderRadius: 10,
  padding: "10px 14px",
  fontSize: 14,
  color: "var(--charcoal)",
  cursor: "pointer",
  marginTop: 10,
} as const;
