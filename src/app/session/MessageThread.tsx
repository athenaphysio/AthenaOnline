"use client";

import { useEffect, useState } from "react";
import styles from "./TodaySession.module.css";

type Message = { id: string; sender: "patient" | "clinician"; body: string; created_at: string };

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// Collapsed by default (the existing footnote line becomes the trigger),
// expands into the real thread + composer on tap. One message included per
// programme for anyone without an active paid membership tier; a second
// attempt never reaches David -- instead this shows the exact automatic
// notice from the messaging spec, styled distinctly from a real reply so
// it reads as a system notice, not a personal one from him.
export default function MessageThread({ programmeId }: { programmeId: string }) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!expanded || loaded) return;
    setLoading(true);
    fetch(`/api/session/messages?programme_id=${programmeId}`)
      .then((res) => res.json())
      .then((data) => setMessages(data.messages ?? []))
      .catch(() => setError("Couldn't load your messages."))
      .finally(() => {
        setLoading(false);
        setLoaded(true);
      });
  }, [expanded, loaded, programmeId]);

  async function handleSend() {
    if (!draft.trim() || sending) return;
    setSending(true);
    setError(null);
    const toSend = draft;
    setDraft("");
    try {
      const res = await fetch("/api/session/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programme_id: programmeId, body: toSend }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't send that.");
      if (data.delivered) {
        setMessages((prev) => [...prev, data.message]);
      } else {
        setNotice(data.notice as string);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send that.");
      setDraft(toSend);
    } finally {
      setSending(false);
    }
  }

  if (!expanded) {
    return (
      <button
        type="button"
        className={styles.footnote}
        style={{ background: "none", border: "none", cursor: "pointer", padding: 0, width: "100%", font: "inherit" }}
        onClick={() => setExpanded(true)}
      >
        Something not feeling right? <b>Message David</b> (one message is included with your programme)
      </button>
    );
  }

  return (
    <div style={{ margin: "18px 24px 0", textAlign: "left", fontSize: 13.5, color: "var(--charcoal)" }}>
      <div style={{ fontWeight: 600, marginBottom: 10 }}>Message David</div>

      {loading && <p style={{ fontSize: 13 }}>Loading…</p>}

      {!loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
          {messages.map((m) => (
            <div
              key={m.id}
              style={{
                alignSelf: m.sender === "patient" ? "flex-end" : "flex-start",
                maxWidth: "80%",
                background: m.sender === "patient" ? "var(--crimson)" : "var(--sand)",
                color: m.sender === "patient" ? "#fff" : "var(--charcoal)",
                borderRadius: 12,
                padding: "8px 12px",
                fontSize: 13.5,
              }}
            >
              {m.body}
              <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>{formatTime(m.created_at)}</div>
            </div>
          ))}

          {notice && (
            <div
              style={{
                background: "var(--border, #e5e0d5)",
                border: "1px solid var(--stone)",
                borderRadius: 12,
                padding: "10px 12px",
                fontSize: 13,
                color: "var(--stone)",
              }}
            >
              <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.7, marginBottom: 4 }}>
                Automatic
              </div>
              <div style={{ fontWeight: 500, marginBottom: 4 }}>Message limit reached</div>
              <div>{notice}</div>
              <a href="/membership" style={{ color: "var(--crimson)", display: "inline-block", marginTop: 8, fontWeight: 500 }}>
                View membership options
              </a>
            </div>
          )}
        </div>
      )}

      {!notice && (
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSend();
            }}
            placeholder="Type a message…"
            style={{
              flex: 1,
              padding: "9px 12px",
              borderRadius: 9,
              border: "1px solid var(--border, #d9cfba)",
              fontSize: 13.5,
              fontFamily: "inherit",
            }}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || !draft.trim()}
            style={{
              padding: "9px 16px",
              borderRadius: 9,
              border: "none",
              background: "var(--crimson)",
              color: "#fff",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      )}

      {error && (
        <p style={{ color: "var(--crimson)", fontSize: 12.5, marginTop: 6 }}>{error}</p>
      )}
    </div>
  );
}
