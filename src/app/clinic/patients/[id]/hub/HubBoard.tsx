"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dash from "../dashboard/ClientDashboard.module.css";
import styles from "./Hub.module.css";
import { HUB_SECTIONS, type HubField, type HubFieldValue, type HubSection, type HubStatus } from "@/lib/onboardingHub";
import type { HubData } from "@/lib/onboardingHubServer";

type State = "confirmed" | "to_confirm" | "explore";

function stateOf(v: HubFieldValue | undefined): State {
  if (!v) return "explore";
  return v.status === "confirmed" ? "confirmed" : "to_confirm";
}

function ukDate(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function HubBoard({ patientId, clientName, initial }: { patientId: string; clientName: string; initial: HubData }) {
  const [values, setValues] = useState<Record<string, HubFieldValue>>(initial.values);
  const [focus, setFocus] = useState(false);

  const counts = useMemo(() => {
    const c = { confirmed: 0, to_confirm: 0, explore: 0, total: 0 };
    for (const s of HUB_SECTIONS) for (const f of s.fields) {
      c[stateOf(values[f.key])] += 1;
      c.total += 1;
    }
    return c;
  }, [values]);

  function onSaved(key: string, saved: HubFieldValue | null) {
    setValues((prev) => {
      const next = { ...prev };
      if (saved) next[key] = saved;
      else delete next[key];
      return next;
    });
  }

  return (
    <div>
      <div className={dash.card}>
        <h2 style={{ fontSize: 21 }}>Consultation hub</h2>
        <p className={dash.muted} style={{ margin: "6px 0 0", fontSize: 13.5 }}>
          The fourteen parts of the conversation with {clientName}, as a reminder list. Tap a part to open it.
        </p>
        <div className={styles.summary}>
          <div className={styles.bar} aria-hidden>
            <div className={styles.barConfirmed} style={{ width: `${(counts.confirmed / counts.total) * 100}%` }} />
            <div className={styles.barToConfirm} style={{ width: `${(counts.to_confirm / counts.total) * 100}%` }} />
          </div>
          <div className={styles.key}>
            <span><span className={`${styles.dot} ${styles.dotConfirmed}`} />{counts.confirmed} confirmed</span>
            <span><span className={`${styles.dot} ${styles.dotToConfirm}`} />{counts.to_confirm} to confirm</span>
            <span><span className={`${styles.dot} ${styles.dotExplore}`} />{counts.explore} to explore</span>
          </div>
        </div>
        <div className={`${styles.actions} ${styles.noPrint}`} style={{ marginTop: 14 }}>
          <button type="button" className={`${dash.btn} ${dash.btnGhost}`} onClick={() => setAllOpen(true)}>
            Open all
          </button>
          <button type="button" className={`${dash.btn} ${dash.btnGhost}`} onClick={() => setAllOpen(false)}>
            Close all
          </button>
          <button type="button" className={`${dash.btn} ${focus ? dash.btnPrimary : dash.btnGhost}`} onClick={() => setFocus((f) => !f)}>
            {focus ? "Showing what is still open" : "Show only what is still open"}
          </button>
          <button
            type="button"
            className={`${dash.btn} ${dash.btnGhost}`}
            onClick={() => {
              setAllOpen(true);
              setTimeout(() => window.print(), 50);
            }}
          >
            Print briefing
          </button>
        </div>
      </div>

      <ImportPanel patientId={patientId} imports={initial.imports} />

      <div className={styles.partList}>
      {HUB_SECTIONS.map((s) => (
        <SectionCard
          key={s.key}
          patientId={patientId}
          section={s}
          values={values}
          record={initial.record[s.key] ?? []}
          passport={initial.passport[s.key] ?? []}
          findings={s.key === "health" ? initial.findings : []}
          focus={focus}
          onSaved={onSaved}
        />
      ))}
      </div>
    </div>
  );
}

// Opens or closes every part and every item inside them, for looking at the
// conversation as a whole.
function setAllOpen(open: boolean) {
  document.querySelectorAll<HTMLDetailsElement>("details[data-hub]").forEach((d) => {
    d.open = open;
  });
}

function ImportPanel({ patientId, imports }: { patientId: string; imports: HubData["imports"] }) {
  const router = useRouter();
  const [source, setSource] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [safety, setSafety] = useState<string | null>(null);

  async function run() {
    setMessage(null);
    setSafety(null);
    if (!source.trim()) return setMessage("Please say where this came from first, for example the medical report and its date.");
    if (!file && !text.trim()) return setMessage("Choose a file, or paste the text to read.");
    setBusy(true);
    const form = new FormData();
    form.set("source", source.trim());
    if (file) form.set("file", file);
    else form.set("text", text);
    try {
      const res = await fetch(`/api/clinic/patients/${patientId}/hub/import`, { method: "POST", body: form });
      const json = (await res.json()) as { filled?: number; safetyNotes?: string; error?: string };
      if (!res.ok) throw new Error(json.error || "The document could not be read.");
      setMessage(
        json.filled
          ? `${json.filled} ${json.filled === 1 ? "field has" : "fields have"} been filled from ${source.trim()}, each waiting for you to confirm.`
          : "Nothing new was found for the hub in that document. Anything already confirmed is left as it is.",
      );
      if (json.safetyNotes) setSafety(json.safetyNotes);
      setFile(null);
      setText("");
      setSource("");
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "The document could not be read.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className={`${dash.card} ${styles.noPrint} ${styles.importBox}`} style={{ marginTop: 14 }}>
      <summary className={styles.partSummary}>
        <span className={styles.partTitle}>Bring in a transcript or report</span>
        {imports.length > 0 && <span className={styles.source}>{imports.length} brought in</span>}
      </summary>
      <p className={dash.muted} style={{ margin: "4px 0 0", fontSize: 13 }}>
        The Twofold transcript, a medical report or lab results. Nothing you have confirmed is overwritten.
      </p>
      <div style={{ marginTop: 14 }}>
        <label className={dash.fieldLabel} htmlFor="hub-source">Where this came from</label>
        <input
          id="hub-source"
          className={dash.fieldInput}
          placeholder="For example: Professor Haq medical report, 11 November 2026"
          value={source}
          onChange={(e) => setSource(e.target.value)}
        />
      </div>
      <div className={styles.importGrid}>
        <div>
          <label className={dash.fieldLabel} htmlFor="hub-file">A file (PDF, Word, text, or a photo)</label>
          <input
            id="hub-file"
            type="file"
            accept=".pdf,.docx,.txt,.jpg,.jpeg,.png"
            className={dash.fieldInput}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <div>
          <label className={dash.fieldLabel} htmlFor="hub-text">Or paste the text</label>
          <textarea id="hub-text" rows={3} className={dash.fieldInput} value={text} onChange={(e) => setText(e.target.value)} disabled={Boolean(file)} />
        </div>
      </div>
      <div className={styles.actions}>
        <button type="button" className={`${dash.btn} ${dash.btnPrimary}`} onClick={run} disabled={busy}>
          {busy ? "Reading, this can take a minute" : "Read into the hub"}
        </button>
        {message && <span className={dash.muted} style={{ fontSize: 13.5 }}>{message}</span>}
      </div>
      {safety && (
        <div className={styles.safetyNote}>
          <strong>The document raises something to check first:</strong> {safety}
        </div>
      )}
      {imports.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <span className={dash.label}>Already brought in</span>
          {imports.map((i) => (
            <div key={i.id} style={{ fontSize: 13.5, padding: "4px 0" }}>
              {i.source_label}
              <span className={styles.source}>
                {" "}
                {ukDate(i.created_at)}, {i.fields_filled} {i.fields_filled === 1 ? "field" : "fields"}
                {i.file_name ? `, ${i.file_name}` : ""}
              </span>
              {i.safety_notes && <div className={styles.safetyNote}>To check: {i.safety_notes}</div>}
            </div>
          ))}
        </div>
      )}
    </details>
  );
}

function SectionCard({
  patientId,
  section,
  values,
  record,
  passport,
  findings,
  focus,
  onSaved,
}: {
  patientId: string;
  section: HubSection;
  values: Record<string, HubFieldValue>;
  record: HubData["record"][string];
  passport: HubData["passport"][string];
  findings: HubData["findings"];
  focus: boolean;
  onSaved: (key: string, saved: HubFieldValue | null) => void;
}) {
  const fields = focus && !section.alwaysFull ? section.fields.filter((f) => stateOf(values[f.key]) !== "confirmed") : section.fields;
  const allConfirmed = section.fields.every((f) => stateOf(values[f.key]) === "confirmed");
  const states = section.fields.map((f) => stateOf(values[f.key]));
  // Complete once every item in the part is confirmed; started once anything
  // in it has been filled in, from a document or in the conversation.
  const progress = states.every((x) => x === "confirmed") ? "complete" : states.some((x) => x !== "explore") ? "started" : null;
  const tone = states.every((x) => x === "confirmed") ? styles.dotConfirmed : states.some((x) => x === "to_confirm") ? styles.dotToConfirm : styles.dotExplore;

  return (
    <details id={`hub-${section.key}`} data-hub className={styles.part}>
      <summary className={styles.partSummary}>
        <span className={`${styles.dot} ${tone}`} style={{ marginRight: 0 }} />
        <span className={styles.partTitle}>
          {section.number}. {section.title}
        </span>
        {section.safety && <span className={`${styles.tag} ${styles.tagSafety}`}>Safety check</span>}
        {progress === "complete" ? (
          <span className={`${styles.tag} ${styles.tagComplete}`}>Complete</span>
        ) : progress === "started" ? (
          <span className={`${styles.tag} ${styles.tagStarted}`}>Started</span>
        ) : null}
      </summary>
      <div className={styles.partBody}>
      <p className={dash.muted} style={{ margin: "0 0 8px", fontSize: 13 }}>{section.purpose}</p>

      {(record.length > 0 || passport.length > 0 || findings.length > 0) && (
        <div className={styles.known}>
          <span className={dash.label}>Already on the record</span>
          {record.map((r) => (
            <div key={r.label} className={styles.knownRow}>
              <span className={dash.muted}>{r.label}</span>
              <span style={{ whiteSpace: "pre-wrap" }}>{r.value}</span>
              <span className={styles.source}>{r.source}</span>
            </div>
          ))}
          {passport.map((p) => (
            <div key={p.domain} className={styles.knownRow}>
              <span className={dash.muted}>Passport: {p.name}</span>
              <span>
                {p.markers} {p.markers === 1 ? "result" : "results"}, latest {ukDate(p.latest)}
                {p.outside.length > 0 ? `. Outside the reference range: ${p.outside.slice(0, 8).join(", ")}${p.outside.length > 8 ? ` and ${p.outside.length - 8} more` : ""}.` : ". All within the reference range."}
                {p.drafts > 0 && <span className={styles.source}> {p.drafts} still in draft.</span>}
              </span>
              <a className={styles.source} href={`/clinic/patients/${patientId}/passport`}>Open passport</a>
            </div>
          ))}
          {findings.map((f, i) => (
            <div key={`${f.title}-${i}`} className={styles.knownRow}>
              <span className={dash.muted}>{f.title}</span>
              <span>{f.result}</span>
              <span className={styles.source}>{f.source ?? ukDate(f.taken_on)}</span>
            </div>
          ))}
        </div>
      )}

      {focus && !section.alwaysFull && allConfirmed ? (
        <p className={dash.muted} style={{ margin: "14px 0 0", fontSize: 13.5 }}>Everything in this part is confirmed.</p>
      ) : (
        fields.map((f) => <FieldEditor key={f.key} patientId={patientId} field={f} value={values[f.key]} onSaved={onSaved} />)
      )}
      </div>
    </details>
  );
}

function FieldEditor({
  patientId,
  field,
  value,
  onSaved,
}: {
  patientId: string;
  field: HubField;
  value: HubFieldValue | undefined;
  onSaved: (key: string, saved: HubFieldValue | null) => void;
}) {
  const state = stateOf(value);
  const [draft, setDraft] = useState(value?.value ?? "");
  const [editing, setEditing] = useState(state !== "confirmed");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(status: HubStatus, nextValue = draft) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/clinic/patients/${patientId}/hub`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field_key: field.key, value: nextValue, status, source: value?.source ?? "Consultation" }),
      });
      const json = (await res.json()) as { field?: HubFieldValue | null; error?: string };
      if (!res.ok) throw new Error(json.error || "Save failed.");
      onSaved(field.key, json.field ?? null);
      setDraft(json.field?.value ?? "");
      setEditing(!json.field || json.field.status !== "confirmed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  const stateClass = state === "confirmed" ? styles.fieldConfirmed : state === "to_confirm" ? styles.fieldToConfirm : styles.fieldExplore;
  const statusText =
    state === "confirmed"
      ? `Confirmed ${ukDate(value?.confirmed_at)}`
      : state === "to_confirm"
        ? "To confirm with the client"
        : "To explore";
  const statusClass = state === "confirmed" ? styles.statusConfirmed : state === "to_confirm" ? styles.statusToConfirm : styles.statusExplore;
  const changed = draft.trim() !== (value?.value ?? "").trim();

  return (
    <details data-hub className={`${styles.field} ${stateClass}`}>
      <summary className={`${styles.fieldTop} ${styles.fieldSummary}`}>
        <span className={styles.fieldName}>{field.label}</span>
        <span className={`${styles.status} ${statusClass}`}>{statusText}</span>
      </summary>
      {field.hint && editing && <div className={styles.source} style={{ marginBottom: 6 }}>{field.hint}</div>}

      {!editing ? (
        <div style={{ whiteSpace: "pre-wrap", fontSize: 14 }}>{value?.value}</div>
      ) : field.kind === "scale" ? (
        <div className={styles.scaleRow}>
          {Array.from({ length: 11 }, (_, n) => String(n)).map((n) => (
            <button
              key={n}
              type="button"
              className={`${styles.scaleBtn} ${draft === n ? styles.scaleBtnOn : ""}`}
              onClick={() => setDraft(draft === n ? "" : n)}
              aria-pressed={draft === n}
            >
              {n}
            </button>
          ))}
        </div>
      ) : (
        <textarea className={dash.fieldInput} rows={Math.min(8, Math.max(2, Math.ceil(draft.length / 90)))} value={draft} onChange={(e) => setDraft(e.target.value)} />
      )}

      {value?.source && <div className={styles.source} style={{ marginTop: 6 }}>Source: {value.source}</div>}

      <div className={`${styles.actions} ${styles.noPrint}`}>
        {!editing ? (
          <button type="button" className={`${dash.btn} ${dash.btnGhost}`} onClick={() => setEditing(true)}>
            Edit
          </button>
        ) : (
          <>
            <button type="button" className={`${dash.btn} ${dash.btnPrimary}`} disabled={busy || !draft.trim()} onClick={() => save("confirmed")}>
              {state === "to_confirm" && !changed ? "Confirm" : "Save and confirm"}
            </button>
            {(changed || state === "explore") && (
              <button type="button" className={`${dash.btn} ${dash.btnGhost}`} disabled={busy || !draft.trim()} onClick={() => save("to_confirm")}>
                Save, still to confirm
              </button>
            )}
            {state === "confirmed" && (
              <button
                type="button"
                className={`${dash.btn} ${dash.btnGhost}`}
                disabled={busy}
                onClick={() => {
                  setDraft(value?.value ?? "");
                  setEditing(false);
                }}
              >
                Cancel
              </button>
            )}
            {state !== "explore" && (
              <button type="button" className={`${dash.btn} ${dash.btnGhost}`} disabled={busy} onClick={() => save("to_confirm", "")}>
                Clear
              </button>
            )}
          </>
        )}
        {error && <span className={dash.muted} style={{ fontSize: 13 }}>{error}</span>}
      </div>
    </details>
  );
}
