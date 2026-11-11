"use client";

import { useState } from "react";
import styles from "@/components/diary/DiaryPlanner.module.css";

type Link = { id: string; paName: string; url: string; lastUsedAt: string | null };

// The client sharing their planner with a PA, and switching a link off.
export default function PlannerLinks({ initial }: { initial: Link[] }) {
  const [links, setLinks] = useState<Link[]>(initial);
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/session/diary/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paName: name, consent }),
      });
      const data = (await res.json()) as { link?: Link; error?: string };
      if (!res.ok || !data.link) throw new Error(data.error ?? "The link couldn't be made.");
      setLinks((prev) => [...prev, data.link!]);
      setName("");
      setConsent(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The link couldn't be made.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/session/diary/links", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkId: id }),
      });
      if (res.ok) setLinks((prev) => prev.filter((l) => l.id !== id));
    } finally {
      setBusy(false);
    }
  }

  async function copy(link: Link) {
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(link.id);
    } catch {
      setCopied(null);
    }
  }

  return (
    <div>
      {links.map((l) => (
        <div key={l.id} className={styles.session}>
          <div className={styles.sessionHead}>
            <span className={styles.sessionName}>{l.paName}</span>
            <button type="button" className={styles.link} onClick={() => revoke(l.id)} disabled={busy}>
              Switch off
            </button>
          </div>
          <p className={styles.quiet} style={{ wordBreak: "break-all" }}>
            {l.url}
          </p>
          <div className={styles.actions} style={{ marginTop: 8 }}>
            <button type="button" className={styles.secondary} onClick={() => copy(l)}>
              {copied === l.id ? "Copied" : "Copy link"}
            </button>
          </div>
        </div>
      ))}

      <div className={styles.form} style={{ gridTemplateColumns: "1fr" }}>
        <label>
          Name of your PA or assistant
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </label>
        <label style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, fontSize: 13, color: "var(--charcoal)" }}>
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ height: 18, marginTop: 2 }} />
          <span>
            I am happy for this person to see when my practice sessions are planned and to place them in my diary. They will not see
            the content of my programme, my notes or my messages.
          </span>
        </label>
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={create} disabled={busy || !name.trim() || !consent}>
            Make a planner link
          </button>
        </div>
      </div>
    </div>
  );
}
