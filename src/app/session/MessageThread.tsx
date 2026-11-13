"use client";

import { useEffect, useState } from "react";
import styles from "./TodaySession.module.css";
import { useT } from "@/i18n/client";
import { messageTime } from "@/i18n/format";

type Message = { id: string; sender: "patient" | "clinician"; body: string; created_at: string };

// Collapsed by default (the existing footnote line becomes the trigger),
// expands into the real thread + composer on tap. One message included per
// programme for anyone without an active paid membership tier; a second
// attempt never reaches David -- instead this shows the exact automatic
// notice from the messaging spec, styled distinctly from a real reply so
// it reads as a system notice, not a personal one from him.
export default function MessageThread({ programmeId }: { programmeId: string }) {
  const { t, rich, lang } = useT();
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
      .catch(() => setError(t("thread.couldntLoad")))
      .finally(() => {
        setLoading(false);
        setLoaded(true);
      });
  }, [expanded, loaded, programmeId, t]);

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
      if (!res.ok) throw new Error(data.error || t("thread.couldntSend"));
      if (data.delivered) {
        setMessages((prev) => [...prev, data.message]);
      } else {
        setNotice(data.notice as string);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("thread.couldntSend"));
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
        style={{
          display: "block",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
          width: "calc(100% - 48px)",
          boxSizing: "border-box",
          fontFamily: "inherit",
          overflowWrap: "anywhere",
        }}
        onClick={() => setExpanded(true)}
      >
        {rich("thread.footnote", { link: <b>{t("thread.messageDavid")}</b> })}
      </button>
    );
  }

  return (
    <div style={{ margin: "18px 24px 0", textAlign: "left", fontSize: 13.5, color: "var(--charcoal)" }}>
      <div style={{ fontWeight: 600, marginBottom: 10 }}>{t("thread.messageDavid")}</div>

      {loading && <p style={{ fontSize: 13 }}>{t("thread.loading")}</p>}

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
              <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>{messageTime(m.created_at, lang)}</div>
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
                {t("thread.automatic")}
              </div>
              <div style={{ fontWeight: 500, marginBottom: 4 }}>{t("thread.limitReached")}</div>
              <div>{notice}</div>
              <a href="/membership" style={{ color: "var(--crimson-text, var(--crimson))", display: "inline-block", marginTop: 8, fontWeight: 500 }}>
                {t("thread.viewMembership")}
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
            placeholder={t("thread.placeholder")}
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
              color: "var(--on-crimson, #fff)",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            {sending ? t("thread.sending") : t("thread.send")}
          </button>
        </div>
      )}

      {error && (
        <p style={{ color: "var(--crimson-text, var(--crimson))", fontSize: 12.5, marginTop: 6 }}>{error}</p>
      )}
    </div>
  );
}
