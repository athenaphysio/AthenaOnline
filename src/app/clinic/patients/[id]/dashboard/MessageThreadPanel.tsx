"use client";

import { useEffect, useState } from "react";
import styles from "./ClientDashboard.module.css";

type Message = { id: string; sender: "patient" | "clinician"; body: string; created_at: string };

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// The real two-way thread, replacing Phase 2's honest "not yet available"
// placeholder now that one exists. Self-fetching (GET marks every unread
// patient message as read on load, same "viewing it is reading it" model
// as the notification bell) so the server component around this stays
// simple. David's reply carries no gate -- see src/lib/messaging.ts.
export default function MessageThreadPanel({ patientId, patientFirstName }: { patientId: string; patientFirstName: string }) {
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/clinic/patients/${patientId}/messages`)
      .then((res) => res.json())
      .then((data) => setMessages(data.messages ?? []))
      .catch(() => setError("Couldn't load this conversation."))
      .finally(() => setLoading(false));
  }, [patientId]);

  async function handleSend() {
    if (!draft.trim() || sending) return;
    setSending(true);
    setError(null);
    const toSend = draft;
    setDraft("");
    try {
      const res = await fetch(`/api/clinic/patients/${patientId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: toSend }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't send that.");
      setMessages((prev) => [...prev, data.message]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send that.");
      setDraft(toSend);
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <p className={styles.muted} style={{ margin: 0 }}>
        Loading…
      </p>
    );
  }

  return (
    <div>
      {messages.length === 0 ? (
        <p className={styles.muted} style={{ margin: "0 0 20px" }}>
          No messages yet from {patientFirstName}.
        </p>
      ) : (
        <div className={styles.thread}>
          {messages.map((m) => (
            <div key={m.id} className={`${styles.bubble} ${m.sender === "patient" ? styles.bubbleIn : styles.bubbleOut}`}>
              {m.body}
              <span className={styles.bubbleTime}>
                {m.sender === "patient" ? patientFirstName : "You"} · {formatTime(m.created_at)}
              </span>
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className={styles.muted} style={{ color: "#e8b27a", marginBottom: 10 }}>
          {error}
        </p>
      )}

      <div className={styles.composer}>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSend();
          }}
          placeholder={`Reply to ${patientFirstName}…`}
        />
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} disabled={sending || !draft.trim()} onClick={handleSend}>
          {sending ? "Sending…" : "Send"}
        </button>
      </div>
    </div>
  );
}
