"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clinicStyles from "../clinic.module.css";

export type DraftSessionRow = {
  id: string;
  week_number: number;
  day_of_week: number;
  kind: string;
  description: string;
  distance_value: number | null;
  distance_unit: string | null;
  review_status: "pending" | "reviewed";
};

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type Props = {
  programmeId: string;
  hasGoal: boolean;
  initialSessions: DraftSessionRow[];
};

// Phase 4-5 review panel: generate the draft, then read/edit/remove/approve
// it here, separate from the weekly strength/rehab grid above (see
// 0065_cardio_goal_draft_sessions.sql for why it can't live in that grid).
export default function CardioDraftReview({ programmeId, hasGoal, initialSessions }: Props) {
  const router = useRouter();
  const [sessions, setSessions] = useState(initialSessions);
  const [generating, setGenerating] = useState(false);
  const [insufficientMessage, setInsufficientMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function generate() {
    setGenerating(true);
    setError(null);
    setInsufficientMessage(null);
    try {
      const res = await fetch(`/api/clinic/programmes/${programmeId}/cardio-draft`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generate failed.");
      if (data.status === "insufficient") {
        setInsufficientMessage(data.message);
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generate failed.");
    } finally {
      setGenerating(false);
    }
  }

  async function toggleReview(session: DraftSessionRow) {
    const next = session.review_status === "pending" ? "reviewed" : "pending";
    setSessions((prev) => prev.map((s) => (s.id === session.id ? { ...s, review_status: next } : s)));
    await fetch(`/api/clinic/cardio-draft-sessions/${session.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ review_status: next }),
    });
  }

  async function markAllReviewed() {
    setSessions((prev) => prev.map((s) => ({ ...s, review_status: "reviewed" as const })));
    await fetch(`/api/clinic/programmes/${programmeId}/cardio-draft/review-all`, { method: "PATCH" });
  }

  async function saveEdit(session: DraftSessionRow, description: string) {
    setSessions((prev) => prev.map((s) => (s.id === session.id ? { ...s, description } : s)));
    setEditingId(null);
    await fetch(`/api/clinic/cardio-draft-sessions/${session.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description }),
    });
  }

  async function removeSession(session: DraftSessionRow) {
    setSessions((prev) => prev.filter((s) => s.id !== session.id));
    await fetch(`/api/clinic/cardio-draft-sessions/${session.id}`, { method: "DELETE" });
  }

  const weeks = Array.from(new Set(sessions.map((s) => s.week_number))).sort((a, b) => a - b);
  const pendingCount = sessions.filter((s) => s.review_status === "pending").length;

  return (
    <div className={clinicStyles.card}>
      <div className={clinicStyles.cardTitle}>Cardio draft</div>
      <p style={{ fontSize: 13, color: "var(--stone)", marginBottom: 12 }}>
        Generated from the cardio goal above, scaled to this patient&apos;s own baseline and timeline. Lives here,
        separate from the weekly grid below, since it varies week to week rather than repeating.
      </p>

      {hasGoal ? (
        <button type="button" className={clinicStyles.buttonSecondary} onClick={generate} disabled={generating}>
          {generating ? "Generating..." : sessions.length > 0 ? "Regenerate cardio draft" : "Generate cardio draft"}
        </button>
      ) : (
        <p style={{ fontSize: 13, color: "var(--muted)" }}>Set a cardio goal above first.</p>
      )}

      {insufficientMessage && (
        <div
          style={{
            marginTop: 12,
            padding: "12px 14px",
            background: "rgba(180, 83, 9, 0.1)",
            border: "1px solid rgba(180, 83, 9, 0.3)",
            borderRadius: 10,
            fontSize: 13.5,
            lineHeight: 1.5,
            color: "var(--stone)",
          }}
        >
          {insufficientMessage}
        </div>
      )}
      {error && <p style={{ fontSize: 12.5, color: "var(--crimson)", marginTop: 8 }}>{error}</p>}

      {sessions.length > 0 && (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16 }}>
            <span style={{ fontSize: 12.5, color: "var(--stone)" }}>
              {pendingCount > 0 ? `${pendingCount} of ${sessions.length} sessions pending your review` : "All reviewed"}
            </span>
            {pendingCount > 0 && (
              <button type="button" className={clinicStyles.buttonSecondary} onClick={markAllReviewed}>
                Mark all reviewed
              </button>
            )}
          </div>

          {weeks.map((week) => (
            <div key={week} style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--crimson)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Week {week}
              </div>
              {sessions
                .filter((s) => s.week_number === week)
                .sort((a, b) => a.day_of_week - b.day_of_week)
                .map((s) => (
                  <div
                    key={s.id}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 10,
                      padding: "8px 0",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    <div style={{ minWidth: 40, fontSize: 12.5, color: "var(--muted)" }}>{DAY_LABELS[s.day_of_week - 1]}</div>
                    <div style={{ flex: 1 }}>
                      {editingId === s.id ? (
                        <EditRow session={s} onSave={(desc) => saveEdit(s, desc)} onCancel={() => setEditingId(null)} />
                      ) : (
                        <span style={{ fontSize: 13.5 }}>{s.description}</span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => toggleReview(s)}
                        style={{
                          fontSize: 10.5,
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: 100,
                          border: "none",
                          cursor: "pointer",
                          background: s.review_status === "pending" ? "rgba(180, 83, 9, 0.16)" : "rgba(47, 107, 68, 0.14)",
                          color: s.review_status === "pending" ? "#b45309" : "#2f6b44",
                        }}
                      >
                        {s.review_status === "pending" ? "Pending" : "Reviewed"}
                      </button>
                      {editingId !== s.id && (
                        <button type="button" onClick={() => setEditingId(s.id)} className={clinicStyles.buttonSecondary} style={{ fontSize: 11.5, padding: "2px 8px" }}>
                          Edit
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removeSession(s)}
                        className={clinicStyles.buttonSecondary}
                        style={{ fontSize: 11.5, padding: "2px 8px" }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function EditRow({ session, onSave, onCancel }: { session: DraftSessionRow; onSave: (description: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState(session.description);
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        style={{ flex: 1, fontSize: 13, padding: "4px 8px" }}
      />
      <button type="button" className={clinicStyles.buttonSecondary} style={{ fontSize: 11.5, padding: "2px 8px" }} onClick={() => onSave(value)}>
        Save
      </button>
      <button type="button" className={clinicStyles.buttonSecondary} style={{ fontSize: 11.5, padding: "2px 8px" }} onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
