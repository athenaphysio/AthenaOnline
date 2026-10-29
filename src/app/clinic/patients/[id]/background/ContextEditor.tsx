"use client";

import { useState } from "react";
import styles from "../dashboard/ClientDashboard.module.css";
import { CONTEXT_SCALES, CONTEXT_SECTIONS, FLAG_KINDS, type ContextContent, type ContextFlag } from "@/lib/clientContext";

export type EditorDraft = {
  entryId: string | null;
  timepoint: string;
  consultedOn: string;
  content: ContextContent;
  documentId: string | null;
  documentName: string | null;
  fromAi: boolean;
  /** The notes as text, shown beside the form to copy from. */
  sourceText?: string | null;
};

type Props = {
  patientId: string;
  initial: EditorDraft;
  notice: string | null;
  onClose: (message: string | null) => void;
};

// One consultation, laid out as the framework: the key items first (anchor
// statement, goals, priority, first action, flags), then the sixteen scales
// with their exact wording, then the fourteen sections. Nothing is saved
// until Save is pressed.
export default function ContextEditor({ patientId, initial, notice, onClose }: Props) {
  const [c, setC] = useState<ContextContent>(initial.content);
  const [timepoint, setTimepoint] = useState(initial.timepoint);
  const [consultedOn, setConsultedOn] = useState(initial.consultedOn);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const edit = (fn: (draft: ContextContent) => void) =>
    setC((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/clinic/patients/${patientId}/context`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entry_id: initial.entryId,
          timepoint,
          consulted_on: consultedOn,
          content: c,
          source_document_id: initial.documentId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "That did not save.");
        return;
      }
      const bits = [
        "Saved.",
        data.scalesSaved ? `${data.scalesSaved} scale${data.scalesSaved === 1 ? "" : "s"} added to the passport as drafts, ready to release from the Passport.` : null,
        data.referralFieldsFilled ? "The referral card on the Overview has been updated." : null,
      ].filter(Boolean);
      onClose(bits.join(" "));
    } finally {
      setBusy(false);
    }
  }

  const scored = c.scales.filter((s) => s.score != null).length;

  const form = (
    <div style={{ minWidth: 0 }}>
      <div className={styles.card} style={{ marginBottom: 16, display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <label className={styles.fieldLabel} htmlFor="ctx-timepoint">
              Consultation
            </label>
            <select id="ctx-timepoint" className={styles.fieldInput} value={timepoint} onChange={(e) => setTimepoint(e.target.value)}>
              <option value="baseline">Baseline (onboarding)</option>
              <option value="month_3">3 month check in</option>
              <option value="month_6">6 month remeasure</option>
              <option value="review">Other review</option>
            </select>
          </div>
          <div>
            <label className={styles.fieldLabel} htmlFor="ctx-date">
              Date
            </label>
            <input id="ctx-date" type="date" className={styles.fieldInput} value={consultedOn} onChange={(e) => setConsultedOn(e.target.value)} />
          </div>
          {initial.documentName && <div className={styles.muted} style={{ fontSize: 13, paddingBottom: 10 }}>From {initial.documentName}</div>}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => onClose(null)} disabled={busy}>
            Cancel
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={save} disabled={busy}>
            {busy ? "Saving" : "Save"}
          </button>
        </div>
      </div>

      {(notice || initial.fromAi) && (
        <div className={styles.card} style={{ marginBottom: 16, borderColor: "var(--tone-warn)" }}>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55 }}>
            {initial.fromAi
              ? "This was read from the notes by AI. Please check every part against the notes before saving, especially quotes, scores and flags. Anything the notes did not say has been left empty."
              : notice}
          </p>
        </div>
      )}

      {/* Key items */}
      <div className={styles.card} style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 14 }}>Key items</h3>
        <Field label="Anchor statement, in their words" value={c.anchor_statement} onChange={(v) => edit((d) => (d.anchor_statement = v))} rows={2} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
          <Field label="Top priority, in their words" value={c.top_priority} onChange={(v) => edit((d) => (d.top_priority = v))} rows={2} />
          <Field label="First action agreed" value={c.first_action} onChange={(v) => edit((d) => (d.first_action = v))} rows={2} />
        </div>

        <div className={styles.fieldLabel} style={{ marginTop: 6 }}>
          Goals (up to three, in their words)
        </div>
        {c.goals.map((g, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 2fr) 90px auto", gap: 8, marginBottom: 8, alignItems: "center" }}>
            <input aria-label={`Goal ${i + 1}`} className={styles.fieldInput} value={g.goal} placeholder="Goal" onChange={(e) => edit((d) => (d.goals[i].goal = e.target.value))} />
            <input aria-label={`Why goal ${i + 1} matters`} className={styles.fieldInput} value={g.value} placeholder="Why it matters" onChange={(e) => edit((d) => (d.goals[i].value = e.target.value))} />
            <input
              aria-label={`Importance of goal ${i + 1}, 0 to 10`}
              className={styles.fieldInput}
              inputMode="numeric"
              value={g.importance ?? ""}
              placeholder="0 to 10"
              onChange={(e) =>
                edit((d) => {
                  const n = e.target.value === "" ? null : Number(e.target.value);
                  d.goals[i].importance = n != null && Number.isFinite(n) && n >= 0 && n <= 10 ? n : null;
                })
              }
            />
            <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => edit((d) => d.goals.splice(i, 1))}>
              Remove
            </button>
          </div>
        ))}
        {c.goals.length < 3 && (
          <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => edit((d) => d.goals.push({ goal: "", value: "", importance: null }))}>
            Add a goal
          </button>
        )}

        <div className={styles.fieldLabel} style={{ marginTop: 18 }}>
          Flags
        </div>
        {c.flags.map((f, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "220px minmax(0, 1fr) auto", gap: 8, marginBottom: 8, alignItems: "center" }}>
            <select
              aria-label={`Flag ${i + 1} type`}
              className={styles.fieldInput}
              value={f.kind}
              onChange={(e) => edit((d) => (d.flags[i].kind = e.target.value as ContextFlag["kind"]))}
            >
              {FLAG_KINDS.map((k) => (
                <option key={k.key} value={k.key}>
                  {k.label}
                </option>
              ))}
            </select>
            <input aria-label={`Flag ${i + 1}`} className={styles.fieldInput} value={f.text} onChange={(e) => edit((d) => (d.flags[i].text = e.target.value))} />
            <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => edit((d) => d.flags.splice(i, 1))}>
              Remove
            </button>
          </div>
        ))}
        <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => edit((d) => d.flags.push({ kind: "note", text: "" }))}>
          Add a flag
        </button>
      </div>

      {/* Scales */}
      <div className={styles.card} style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 4 }}>Scales</h3>
        <p className={styles.muted} style={{ margin: "0 0 14px", fontSize: 13 }}>
          {scored} of 16 recorded. Ask with these exact words at every remeasure. Saved scores go to the passport as drafts.
        </p>
        {CONTEXT_SCALES.map((s) => {
          const score = c.scales.find((x) => x.key === s.key)?.score ?? null;
          return (
            <div key={s.key} style={{ padding: "10px 0", borderTop: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0, flex: "1 1 280px" }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{s.label}</div>
                  <div className={styles.muted} style={{ fontSize: 12.5 }}>
                    &ldquo;{s.question}&rdquo;
                    {(s.low || s.high) && ` 0 ${s.low}, 10 ${s.high}.`}
                  </div>
                </div>
                <div role="radiogroup" aria-label={s.label} style={{ display: "flex", gap: 3, flexWrap: "wrap", alignItems: "center" }}>
                  {Array.from({ length: 11 }, (_, n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={score === n}
                      onClick={() => edit((d) => (d.scales.find((x) => x.key === s.key)!.score = score === n ? null : n))}
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        border: `1px solid ${score === n ? "var(--crimson)" : "var(--border-strong)"}`,
                        background: score === n ? "var(--crimson)" : "transparent",
                        color: score === n ? "#fff" : "var(--cream)",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Referral card */}
      <div className={styles.card} style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 4 }}>For the referral card</h3>
        <p className={styles.muted} style={{ margin: "0 0 14px", fontSize: 13 }}>
          Anything filled in here updates the Overview. Empty boxes leave what is already there.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
          <Field label="Reason for attending" value={c.referral.presenting_complaint} onChange={(v) => edit((d) => (d.referral.presenting_complaint = v))} rows={2} />
          <Field label="Onset" value={c.referral.date_of_onset} onChange={(v) => edit((d) => (d.referral.date_of_onset = v))} />
          <Field label="Mechanism" value={c.referral.mechanism_of_injury} onChange={(v) => edit((d) => (d.referral.mechanism_of_injury = v))} />
          <Field label="Referred via" value={c.referral.referred_via} onChange={(v) => edit((d) => (d.referral.referred_via = v))} />
        </div>
        <Field label="Goals and relevant history" value={c.referral.referral_goals_history} onChange={(v) => edit((d) => (d.referral.referral_goals_history = v))} rows={3} />
      </div>

      {/* The fourteen sections */}
      <h3 style={{ margin: "26px 0 12px" }}>The fourteen sections</h3>
      {CONTEXT_SECTIONS.map((def) => {
        const sIndex = c.sections.findIndex((x) => x.key === def.key);
        const sec = c.sections[sIndex];
        const filled = Boolean(sec.summary || sec.quotes.length || sec.fields.some((f) => f.value));
        return (
          <details key={def.key} className={styles.card} style={{ marginBottom: 10, padding: "16px 22px" }} open={filled}>
            <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 15, listStyle: "revert" }}>
              {def.number}. {def.title}
              {!filled && <span className={styles.muted} style={{ fontWeight: 400, fontSize: 13 }}> (empty)</span>}
            </summary>
            <div style={{ marginTop: 14 }}>
              <Field scope={def.key} label="Summary" value={sec.summary} onChange={(v) => edit((d) => (d.sections[sIndex].summary = v))} rows={3} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
                {sec.fields.map((f, fi) => (
                  <Field key={f.label} scope={def.key} label={f.label} value={f.value} onChange={(v) => edit((d) => (d.sections[sIndex].fields[fi].value = v))} rows={2} />
                ))}
              </div>
              <div className={styles.fieldLabel}>Verbatim quotes</div>
              {sec.quotes.map((q, qi) => (
                <div key={qi} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <textarea
                    aria-label={`Quote ${qi + 1}`}
                    className={styles.fieldInput}
                    rows={2}
                    value={q}
                    onChange={(e) => edit((d) => (d.sections[sIndex].quotes[qi] = e.target.value))}
                  />
                  <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => edit((d) => d.sections[sIndex].quotes.splice(qi, 1))}>
                    Remove
                  </button>
                </div>
              ))}
              <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => edit((d) => d.sections[sIndex].quotes.push(""))}>
                Add a quote
              </button>
              <div style={{ marginTop: 14 }}>
                <Field
                  scope={def.key}
                  label="Codes, separated by commas (for example FEAR AVOIDANCE + FEAR)"
                  value={sec.codes.join(", ")}
                  onChange={(v) => edit((d) => (d.sections[sIndex].codes = v.split(",").map((x) => x.trim()).filter(Boolean)))}
                />
              </div>
            </div>
          </details>
        );
      })}

      {error && <p style={{ color: "var(--tone-bad)", marginTop: 14 }}>{error}</p>}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
        <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => onClose(null)} disabled={busy}>
          Cancel
        </button>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={save} disabled={busy}>
          {busy ? "Saving" : "Save"}
        </button>
      </div>
    </div>
  );

  if (!initial.sourceText) return form;

  // With the notes alongside: the notes stay in view on the left while the
  // form scrolls on the right, so each part can be copied across.
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 38%) minmax(0, 1fr)", gap: 20, alignItems: "start" }}>
      <aside className={styles.card} style={{ position: "sticky", top: 16, maxHeight: "calc(100vh - 32px)", display: "flex", flexDirection: "column", padding: "16px 18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
          <span className={styles.label}>Your notes</span>
          <span className={styles.muted} style={{ fontSize: 12 }}>Select text, then copy and paste</span>
        </div>
        <div
          style={{ marginTop: 10, overflowY: "auto", whiteSpace: "pre-wrap", fontSize: 13.5, lineHeight: 1.6, userSelect: "text", paddingRight: 6 }}
        >
          {initial.sourceText}
        </div>
      </aside>
      {form}
    </div>
  );
}

function Field({ label, value, onChange, rows, scope = "key" }: { label: string; value: string; onChange: (v: string) => void; rows?: number; scope?: string }) {
  const id = `f-${scope}-${label.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel} htmlFor={id}>
        {label}
      </label>
      {rows ? (
        <textarea id={id} className={styles.fieldInput} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} style={{ resize: "vertical" }} />
      ) : (
        <input id={id} className={styles.fieldInput} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}
