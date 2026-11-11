"use client";

import { useEffect, useState } from "react";
import clinicStyles from "../../clinic.module.css";
import {
  DAY_NAMES,
  FOCUS_LABEL,
  KIT_LABEL,
  type Experience,
  type FocusArea,
  type Kit,
  type Split,
  type StrengthOverrides,
  type StrengthProfile,
} from "@/lib/strengthProfile";

type Props = { patientId: string; firstName: string };

type Form = {
  minutesPerSession: string;
  days: number[];
  anyDay: boolean;
  split: Split | "";
  upper: string;
  lower: string;
  full: string;
  kit: Kit[];
  experience: Experience | "";
  currentLifts: string;
  goal: string;
  avoid: string;
  focus: FocusArea[];
};

function toForm(p: StrengthProfile): Form {
  return {
    minutesPerSession: p.minutesPerSession != null ? String(p.minutesPerSession) : "",
    days: p.days,
    anyDay: p.anyDay,
    split: p.split ?? "",
    upper: p.upper ? String(p.upper) : "",
    lower: p.lower ? String(p.lower) : "",
    full: p.full ? String(p.full) : "",
    kit: p.kit,
    experience: p.experience ?? "",
    currentLifts: p.currentLifts ?? "",
    goal: p.goal ?? "",
    avoid: p.avoid ?? "",
    focus: p.focus,
  };
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Only what differs from the notes, plus anything already corrected, is saved. */
function overridesFrom(form: Form, fromNotes: StrengthProfile, saved: StrengthOverrides | null): StrengthOverrides {
  const notes = toForm(fromNotes);
  const out: StrengthOverrides = {};
  const keep = (k: keyof Form) => !same(form[k], notes[k]) || (saved != null && saved[k as keyof StrengthOverrides] !== undefined);
  const n = (v: string) => (v.trim() === "" ? null : Number(v));
  if (keep("minutesPerSession")) out.minutesPerSession = n(form.minutesPerSession);
  if (keep("days")) out.days = form.days;
  if (keep("anyDay")) out.anyDay = form.anyDay;
  if (keep("split")) out.split = form.split || null;
  if (keep("upper") || keep("lower") || keep("full")) {
    out.upper = n(form.upper) ?? 0;
    out.lower = n(form.lower) ?? 0;
    out.full = n(form.full) ?? 0;
  }
  if (keep("kit")) out.kit = form.kit;
  if (keep("experience")) out.experience = form.experience || null;
  if (keep("currentLifts")) out.currentLifts = form.currentLifts.trim() || null;
  if (keep("goal")) out.goal = form.goal.trim() || null;
  if (keep("avoid")) out.avoid = form.avoid.trim() || null;
  if (keep("focus")) out.focus = form.focus;
  return out;
}

const ROW: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 };
const CHIP: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 };

// What the strength engine builds to for this client: read from their intake
// form and consultation notes, with anything Dr David Silver PhD corrects
// here taking priority from then on.
export default function StrengthProfilePanel({ patientId, firstName }: Props) {
  const [fromNotes, setFromNotes] = useState<StrengthProfile | null>(null);
  const [saved, setSaved] = useState<StrengthOverrides | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [corrected, setCorrected] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function take(data: { fromNotes: StrengthProfile; saved: StrengthOverrides | null; profile: StrengthProfile }) {
    setFromNotes(data.fromNotes);
    setSaved(data.saved);
    setForm(toForm(data.profile));
    setCorrected(data.profile.corrected);
  }

  useEffect(() => {
    let live = true;
    fetch(`/api/clinic/patients/${patientId}/strength-profile`)
      .then((r) => r.json())
      .then((d) => live && !d.error && take(d))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [patientId]);

  async function save(clear: boolean) {
    if (!form || !fromNotes) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/clinic/patients/${patientId}/strength-profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overrides: clear ? null : overridesFrom(form, fromNotes, saved) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save.");
      take(data);
      setMessage(clear ? `Back to what ${firstName}'s notes say.` : "Saved. The next strength build uses this.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  if (!form || !fromNotes) {
    return (
      <div className={clinicStyles.card}>
        <div className={clinicStyles.cardTitle}>Strength profile</div>
        <p className={clinicStyles.notice} style={{ margin: "6px 0 0" }}>Reading {firstName}&apos;s notes…</p>
      </div>
    );
  }

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const minutesText = form.minutesPerSession ? `${form.minutesPerSession} minutes` : "not given";
  const kitText = form.kit.length ? form.kit.map((k) => KIT_LABEL[k]).join(", ") : "not given";
  const perWeek = Number(form.upper || 0) + Number(form.lower || 0) + Number(form.full || 0) || form.days.length;
  const daysText = form.anyDay
    ? `${perWeek ? `${perWeek} a week` : "as many as the plan has"}, on days ${firstName} chooses`
    : form.days.length
      ? form.days.map((d) => DAY_NAMES[d]).join(", ")
      : "from the plan";
  const missing = [!form.minutesPerSession && "minutes", form.kit.length === 0 && "kit", !form.experience && "experience"].filter(Boolean);

  return (
    <div className={clinicStyles.card}>
      <div className={clinicStyles.cardTitle}>Strength profile</div>
      <p className={clinicStyles.notice} style={{ margin: "6px 0 0" }}>
        {`Strength is built to this: ${minutesText} a session, ${daysText}, kit: ${kitText}, experience: ${form.experience || "not given"}.`}
        {(saved?.fromConsultation?.length ?? 0) > 0
          ? ` Some of it comes from the consultation${corrected.length > (saved?.fromConsultation?.length ?? 0) ? ", and you have corrected some" : ""}.`
          : corrected.length > 0
            ? " You have corrected some of it."
            : ` All of it comes from ${firstName}'s intake form and notes.`}
      </p>
      {saved?.consultationNotes && (
        <p className={clinicStyles.notice} style={{ margin: "6px 0 0" }}>
          {`From the consultation: ${saved.consultationNotes}`}
        </p>
      )}
      {missing.length > 0 && (
        <p className={clinicStyles.notice} style={{ margin: "6px 0 0" }}>
          {`Missing from ${firstName}'s answers: ${missing.join(", ")}. Add ${missing.length > 1 ? "them" : "it"} so the sessions fit properly.`}
        </p>
      )}
      <button
        type="button"
        className={clinicStyles.buttonSecondary}
        style={{ width: "auto", padding: "0 16px", height: 32, fontSize: 13, marginTop: 10 }}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? "Close" : "Check or correct"}
      </button>

      {open && (
        <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
          <label className={clinicStyles.smallLabel}>
            Minutes per strength session
            <input
              className={clinicStyles.input}
              inputMode="numeric"
              value={form.minutesPerSession}
              onChange={(e) => set("minutesPerSession", e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="For example 45"
            />
          </label>

          <div>
            <div className={clinicStyles.smallLabel}>Strength days (leave empty to use the plan&apos;s strength days)</div>
            <div style={ROW}>
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <label key={d} style={CHIP}>
                  <input type="checkbox" checked={form.days.includes(d)} onChange={() => set("days", toggle(form.days, d))} />
                  {DAY_NAMES[d]}
                </label>
              ))}
            </div>
          </div>

          <label style={CHIP}>
            <input type="checkbox" checked={form.anyDay} onChange={(e) => set("anyDay", e.target.checked)} />
            {`Let ${firstName} choose the days each week (sessions sit under "Any day this week")`}
          </label>

          <div>
            <div className={clinicStyles.smallLabel}>Split</div>
            <div style={ROW}>
              <select className={clinicStyles.input} value={form.split} onChange={(e) => set("split", e.target.value as Form["split"])}>
                <option value="">No preference</option>
                <option value="full">Whole body each time</option>
                <option value="upper_lower">Upper and lower on different days</option>
              </select>
            </div>
            <div style={ROW}>
              {(["upper", "lower", "full"] as const).map((k) => (
                <label key={k} style={CHIP}>
                  <input
                    className={clinicStyles.smallInput}
                    style={{ width: 48 }}
                    inputMode="numeric"
                    value={form[k]}
                    onChange={(e) => set(k, e.target.value.replace(/[^0-9]/g, ""))}
                  />
                  {k === "full" ? "whole body" : k} a week
                </label>
              ))}
            </div>
          </div>

          <div>
            <div className={clinicStyles.smallLabel}>Kit</div>
            <div style={ROW}>
              {(Object.keys(KIT_LABEL) as Kit[]).map((k) => (
                <label key={k} style={CHIP}>
                  <input type="checkbox" checked={form.kit.includes(k)} onChange={() => set("kit", toggle(form.kit, k))} />
                  {KIT_LABEL[k]}
                </label>
              ))}
            </div>
          </div>

          <label className={clinicStyles.smallLabel}>
            Experience
            <select className={clinicStyles.input} value={form.experience} onChange={(e) => set("experience", e.target.value as Form["experience"])}>
              <option value="">Not given</option>
              <option value="new">New to it</option>
              <option value="some">Some experience</option>
              <option value="experienced">Experienced</option>
            </select>
          </label>

          <div>
            <div className={clinicStyles.smallLabel}>History to cover</div>
            <div style={ROW}>
              {(Object.keys(FOCUS_LABEL) as FocusArea[]).map((f) => (
                <label key={f} style={CHIP}>
                  <input type="checkbox" checked={form.focus.includes(f)} onChange={() => set("focus", toggle(form.focus, f))} />
                  {FOCUS_LABEL[f]}
                </label>
              ))}
            </div>
          </div>

          <label className={clinicStyles.smallLabel}>
            Current lifts
            <textarea className={clinicStyles.textarea} rows={2} value={form.currentLifts} onChange={(e) => set("currentLifts", e.target.value)} />
          </label>
          <label className={clinicStyles.smallLabel}>
            Strength goal
            <textarea className={clinicStyles.textarea} rows={2} value={form.goal} onChange={(e) => set("goal", e.target.value)} />
          </label>
          <label className={clinicStyles.smallLabel}>
            Exercises to avoid (write &quot;avoid&quot; before them, for example &quot;avoid lunges, overhead press&quot;)
            <textarea className={clinicStyles.textarea} rows={2} value={form.avoid} onChange={(e) => set("avoid", e.target.value)} />
          </label>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" className={clinicStyles.button} style={{ width: "auto", padding: "0 18px" }} disabled={busy} onClick={() => void save(false)}>
              {busy ? "Saving…" : "Save"}
            </button>
            {corrected.length > 0 && (
              <button type="button" className={clinicStyles.buttonSecondary} style={{ width: "auto", padding: "0 18px" }} disabled={busy} onClick={() => void save(true)}>
                Use the notes again
              </button>
            )}
          </div>
        </div>
      )}
      {message && (
        <p className={clinicStyles.notice} style={{ margin: "10px 0 0" }}>
          {message}
        </p>
      )}
    </div>
  );
}
