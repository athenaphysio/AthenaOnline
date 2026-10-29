"use client";

import { useEffect, useRef, useState } from "react";
import type { PatientMessage } from "@/lib/messaging";
import styles from "./Screens.module.css";

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// The conversation and the box to write in. Read only in the clinic's
// Client view.
export default function Conversation({ initial, readOnly = false }: { initial: PatientMessage[]; readOnly?: boolean }) {
  const [messages, setMessages] = useState(initial);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function send() {
    if (!draft.trim() || sending) return;
    setSending(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/session/conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: draft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "That message could not be sent.");
      if (data.delivered) {
        setMessages((m) => [...m, data.message]);
        setDraft("");
      } else {
        setNotice(data.notice);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "That message could not be sent.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <div className={styles.thread}>
        {messages.length === 0 && (
          <div className={styles.notice}>
            Nothing here yet. Write to the team whenever something comes up, a question, something you noticed, or how a practice felt.
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`${styles.bubble} ${m.sender === "patient" ? styles.fromClient : styles.fromTeam}`}>
            {m.body}
            <span className={styles.time}>{when(m.created_at)}</span>
          </div>
        ))}
        <div ref={end} />
      </div>
      {!readOnly && (
        <div className={styles.composer}>
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Write a message" aria-label="Your message" maxLength={5000} />
          {notice && <div className={styles.notice}>{notice}</div>}
          {error && <div className={styles.notice}>{error}</div>}
          <button type="button" className={styles.send} onClick={send} disabled={sending || !draft.trim()}>
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      )}
    </>
  );
}
