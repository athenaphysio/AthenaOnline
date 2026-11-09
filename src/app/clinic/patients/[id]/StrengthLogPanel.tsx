"use client";

import { useEffect, useState } from "react";
import clinicStyles from "../../clinic.module.css";
import type { Suggestion } from "@/lib/strengthSuggestions";

type Strand = { label: string; status: string; tone: "good" | "middle" | "look" | "none"; detail: string };

type RecentLog = {
  id: string;
  name: string;
  week_number: number;
  weight_kg: number | null;
  reps_done: number | null;
  seconds_done: number | null;
  effort: number | null;
  pain: number | null;
  not_sure: boolean;
  note: string | null;
};

type Props = { programmeId: string; firstName: string };

const DAYLESS_ROW: React.CSSProperties = { fontSize: 13, lineHeight: 1.5, padding: "6px 0", borderTop: "1px solid var(--line, #e5e1da)" };

function describe(l: RecentLog): string {
  const parts = [`Week ${l.week_number}`];
  if (l.weight_kg != null) parts.push(`${l.weight_kg} kg`);
  if (l.reps_done != null) parts.push(`${l.reps_done} reps`);
  if (l.seconds_done != null) parts.push(`${l.seconds_done} s`);
  if (l.effort != null) parts.push(`effort ${l.effort}/10`);
  if (l.pain) parts.push(`pain ${l.pain}/10`);
  return parts.join(", ");
}

// The client's strength logs and the step up or step back suggestions drawn
// from them (strengthSuggestions.ts). Nothing changes in the programme until
// Dr David Silver PhD approves a suggestion here.
export default function StrengthLogPanel({ programmeId, firstName }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [recent, setRecent] = useState<RecentLog[]>([]);
  const [strand, setStrand] = useState<Strand | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`/api/clinic/programmes/${programmeId}/strength-suggestions`)
      .then((r) => r.json())
      .then((d) => {
        if (!live || d.error) return;
        setSuggestions(d.suggestions);
        setRecent(d.recent);
        setStrand(d.strand ?? null);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [programmeId]);

  async function decide(s: Suggestion, decision: "approved" | "dismissed") {
    setBusy(s.log_id);
    setMessage(null);
    try {
      const res = await fetch(`/api/clinic/programmes/${programmeId}/strength-suggestions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ log_id: s.log_id, exercise_id: s.exercise_id, kind: s.kind, week: s.week, swap_to: s.swap_to, decision }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Could not save that.");
      setSuggestions(d.suggestions);
      setRecent(d.recent);
      setStrand(d.strand ?? null);
      setMessage(decision === "approved" ? `${s.name}: ${d.detail}` : `${s.name}: left as it is.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not save that.");
    } finally {
      setBusy(null);
    }
  }

  if (suggestions == null) return null;
  const notSure = recent.filter((l) => l.not_sure);

  return (
    <div className={clinicStyles.card}>
      <div className={clinicStyles.cardTitle}>Strength log</div>
      {strand && strand.tone !== "none" && (
        <div style={{ margin: "6px 0 4px", fontSize: 13.5, lineHeight: 1.5 }}>
          <b>{strand.status}.</b> {strand.detail}
        </div>
      )}
      {recent.length === 0 ? (
        <p className={clinicStyles.notice} style={{ margin: "6px 0 0" }}>
          {`No weights or effort logged as numbers yet. ${firstName}'s voice notes after strength sessions, with the weights and effort in their own words, are with their other voice notes.`}
        </p>
      ) : (
        <>
          {suggestions.length === 0 ? (
            <p className={clinicStyles.notice} style={{ margin: "6px 0 0" }}>
              Nothing to change: everything logged so far sits where it was planned.
            </p>
          ) : (
            suggestions.map((s) => (
              <div key={s.log_id} style={{ ...DAYLESS_ROW, borderTop: "none", marginTop: 8 }}>
                <div style={{ fontWeight: 600 }}>
                  {s.name}: {s.kind === "step_up" ? "step up" : "step back"}
                </div>
                <div>{s.why}</div>
                <div className={clinicStyles.notice} style={{ margin: "2px 0 6px" }}>
                  If approved: {s.change}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className={clinicStyles.button}
                    style={{ width: "auto", padding: "0 14px", height: 32, fontSize: 13 }}
                    disabled={busy === s.log_id}
                    onClick={() => void decide(s, "approved")}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className={clinicStyles.buttonSecondary}
                    style={{ width: "auto", padding: "0 14px", height: 32, fontSize: 13 }}
                    disabled={busy === s.log_id}
                    onClick={() => void decide(s, "dismissed")}
                  >
                    Leave as it is
                  </button>
                </div>
              </div>
            ))
          )}

          {notSure.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div className={clinicStyles.smallLabel}>{`Where ${firstName} was not sure they were getting it right`}</div>
              {notSure.slice(0, 5).map((l) => (
                <div key={l.id} style={DAYLESS_ROW}>
                  {l.name}, week {l.week_number}
                  {l.note ? `: "${l.note}"` : ""}
                </div>
              ))}
            </div>
          )}

          <details style={{ marginTop: 12 }}>
            <summary className={clinicStyles.smallLabel} style={{ cursor: "pointer" }}>
              Recent logs
            </summary>
            {recent.map((l) => (
              <div key={l.id} style={DAYLESS_ROW}>
                <strong>{l.name}</strong>: {describe(l)}
                {l.note && !l.not_sure ? `. "${l.note}"` : ""}
              </div>
            ))}
          </details>
        </>
      )}
      {message && (
        <p className={clinicStyles.notice} style={{ margin: "10px 0 0" }}>
          {message}
        </p>
      )}
    </div>
  );
}
