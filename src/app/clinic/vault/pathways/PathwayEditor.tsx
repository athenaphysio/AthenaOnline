"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AthenaPathwayV1, PathwayDrill, PathwayProgressRule, PathwayStage } from "@/lib/pathways";
import clinicStyles from "../../clinic.module.css";
import styles from "./Pathways.module.css";

type ExerciseOption = { id: string; name: string };

type Props = {
  id: string;
  initialStatus: "draft" | "approved";
  initial: AthenaPathwayV1;
  exercises: ExerciseOption[];
};

function ruleLine(r: PathwayProgressRule): string {
  return [r.load, r.completion, r.symptoms].filter(Boolean).join("; ");
}

// The pathway drawn as a flowchart running top to bottom, with the drills
// in each stage editable in place: add, remove, reorder, switch between
// core and optional, and link or unlink library exercises. Stage wording,
// entry and decisions are edited in the Clinical Pathways Project and
// pasted back in, so the Project stays the one place that reasoning lives.
export default function PathwayEditor({ id, initialStatus, initial, exercises }: Props) {
  const router = useRouter();
  const [p, setP] = useState<AthenaPathwayV1>(initial);
  const [status, setStatus] = useState(initialStatus);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const names = useMemo(() => new Map(exercises.map((e) => [e.id, e.name])), [exercises]);

  function updateStage(stageId: string, fn: (s: PathwayStage) => PathwayStage) {
    setP((prev) => ({ ...prev, stages: prev.stages.map((s) => (s.id === stageId ? fn(s) : s)) }));
    setDirty(true);
    setMessage(null);
  }

  function updateDrill(stageId: string, index: number, fn: (d: PathwayDrill) => PathwayDrill | null) {
    updateStage(stageId, (s) => {
      const drills = [...s.drills];
      const next = fn(drills[index]);
      if (next) drills[index] = next;
      else drills.splice(index, 1);
      return { ...s, drills };
    });
  }

  function moveDrill(stageId: string, index: number, by: -1 | 1) {
    updateStage(stageId, (s) => {
      const drills = [...s.drills];
      const to = index + by;
      if (to < 0 || to >= drills.length) return s;
      [drills[index], drills[to]] = [drills[to], drills[index]];
      return { ...s, drills };
    });
  }

  async function save(nextStatus?: "draft" | "approved") {
    setSaving(true);
    setErrors([]);
    setMessage(null);
    const res = await fetch(`/api/clinic/vault/pathways/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ definition: p, ...(nextStatus ? { status: nextStatus } : {}) }),
    });
    const body = (await res.json().catch(() => ({}))) as { errors?: string[] };
    setSaving(false);
    if (!res.ok) {
      setErrors(body.errors ?? ["Something went wrong saving the pathway."]);
      return;
    }
    if (nextStatus) setStatus(nextStatus);
    setDirty(false);
    setMessage(nextStatus === "approved" ? "Saved and approved." : nextStatus === "draft" ? "Saved and set back to draft." : "Saved.");
    router.refresh();
  }

  async function remove() {
    const res = await fetch(`/api/clinic/vault/pathways/${id}`, { method: "DELETE" });
    const body = (await res.json().catch(() => ({}))) as { errors?: string[] };
    if (!res.ok) {
      setErrors(body.errors ?? ["Something went wrong deleting the pathway."]);
      setConfirmDelete(false);
      return;
    }
    router.push("/clinic/vault/pathways");
  }

  async function copyCode() {
    await navigator.clipboard.writeText(JSON.stringify(p, null, 2));
    setMessage("Pathway code copied. Paste it into the Clinical Pathways Project to keep working on it there.");
  }

  const stageIndex = new Map(p.stages.map((s, i) => [s.id, i + 1]));
  const decisionsById = new Map(p.decisions.map((d) => [d.id, d]));
  const stageLabel = (sid: string) => {
    const i = stageIndex.get(sid);
    const s = p.stages.find((x) => x.id === sid);
    return i ? `Stage ${i}${s?.title ? `: ${s.title}` : ""}` : sid;
  };

  return (
    <div>
      {p.premise && <p className={styles.boxSub} style={{ maxWidth: 720, fontSize: 14 }}>{p.premise}</p>}

      <div className={styles.chart}>
        {/* Entry */}
        <div className={`${styles.box} ${styles.entryBox}`}>
          <p className={styles.boxTitle}>Entry</p>
          {p.who && <p className={styles.boxSub}>{p.who}</p>}
          {p.entry.length > 0 ? (
            <div className={styles.drillList}>
              {p.entry.map((e) => (
                <div key={e.presentation} style={{ fontSize: 13.5 }}>
                  <strong>{e.presentation}</strong> starts at {stageLabel(e.start_at)}
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.boxSub} style={{ margin: 0 }}>Every client starts at stage 1.</p>
          )}
          {p.excludes.length > 0 && (
            <div className={styles.rule}>Not for, or start elsewhere: {p.excludes.join("; ")}</div>
          )}
        </div>

        {p.flare_up && (
          <>
            <div className={styles.arrowLabel}>At any stage</div>
            <div className={`${styles.box} ${styles.flareBox}`}>
              <p className={styles.boxTitle}>If a flare-up</p>
              <p className={styles.boxSub} style={{ margin: 0 }}>
                {[p.flare_up.trigger && `When: ${p.flare_up.trigger}`, p.flare_up.action && `Then: ${p.flare_up.action}`, p.flare_up.return && `Back when: ${p.flare_up.return}`]
                  .filter(Boolean)
                  .join(". ")}
              </p>
            </div>
          </>
        )}

        {p.stages.map((s, si) => {
          const decision = s.next ? decisionsById.get(s.next) : undefined;
          return (
            <Fragment key={s.id}>
              <div className={styles.arrow} />
              <div className={styles.box}>
                <div className={styles.stageHead}>
                  <span className={styles.stageNo}>STAGE {si + 1}</span>
                  <p className={styles.boxTitle} style={{ margin: 0 }}>{s.title}</p>
                </div>
                {s.rationale && <p className={styles.boxSub} style={{ marginTop: 6 }}>{s.rationale}</p>}

                <div className={styles.drillList}>
                  {s.drills.map((d, di) => (
                    <DrillCard
                      key={`${s.id}-${di}`}
                      drill={d}
                      names={names}
                      exercises={exercises}
                      first={di === 0}
                      last={di === s.drills.length - 1}
                      onChange={(fn) => updateDrill(s.id, di, fn)}
                      onMove={(by) => moveDrill(s.id, di, by)}
                    />
                  ))}
                </div>

                <AddDrill exercises={exercises} onAdd={(drill) => updateStage(s.id, (st) => ({ ...st, drills: [...st.drills, drill] }))} />

                <div className={styles.rule}>
                  Move on when: {ruleLine(s.progress_rule ?? p.progress_rule)}
                  {s.progress_rule ? " (this stage's own rule)" : ""}
                </div>
              </div>

              {decision && (
                <>
                  <div className={styles.arrow} />
                  <div className={styles.decision}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{decision.question}</div>
                    <div className={styles.options}>
                      {decision.options.map((o) => (
                        <span key={o.answer} className={styles.pill}>
                          {o.answer}: {o.go_to ? stageLabel(o.go_to) : "end"}
                        </span>
                      ))}
                    </div>
                  </div>
                </>
              )}
              {!decision && s.next && stageIndex.get(s.next) !== si + 2 && (
                <div className={styles.arrowLabel}>Then {stageLabel(s.next)}</div>
              )}
            </Fragment>
          );
        })}

        {p.goals.length > 0 && (
          <>
            <div className={styles.arrow} />
            <div className={`${styles.box} ${styles.goalBox}`}>
              <p className={styles.boxTitle}>Functional goals</p>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5 }}>
                {p.goals.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>

      {errors.length > 0 && (
        <ul className={styles.errors}>
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <div className={styles.saveBar}>
        {message && <span className={styles.boxSub} style={{ margin: 0 }}>{message}</span>}
        <span className={`${styles.pill} ${status === "approved" ? styles.pillApproved : ""}`}>{status === "approved" ? "Approved" : "Draft"}</span>
        <button type="button" className={clinicStyles.buttonSecondary} onClick={copyCode}>
          Copy pathway code
        </button>
        {confirmDelete ? (
          <>
            <span className={styles.boxSub} style={{ margin: 0 }}>Delete this pathway?</span>
            <button type="button" className={clinicStyles.buttonDestructive} onClick={remove}>
              Yes, delete
            </button>
            <button type="button" className={clinicStyles.buttonSecondary} onClick={() => setConfirmDelete(false)}>
              Keep it
            </button>
          </>
        ) : (
          <button type="button" className={clinicStyles.buttonSecondary} onClick={() => setConfirmDelete(true)}>
            Delete
          </button>
        )}
        {status === "approved" ? (
          <button type="button" className={clinicStyles.buttonSecondary} disabled={saving} onClick={() => save("draft")}>
            Set back to draft
          </button>
        ) : (
          <button type="button" className={clinicStyles.buttonSecondary} disabled={saving} onClick={() => save("approved")}>
            Save and approve
          </button>
        )}
        <button type="button" className={clinicStyles.button} disabled={saving || !dirty} onClick={() => save()}>
          {saving ? "Saving" : "Save"}
        </button>
      </div>
    </div>
  );
}

function DrillCard({
  drill,
  names,
  exercises,
  first,
  last,
  onChange,
  onMove,
}: {
  drill: PathwayDrill;
  names: Map<string, string>;
  exercises: ExerciseOption[];
  first: boolean;
  last: boolean;
  onChange: (fn: (d: PathwayDrill) => PathwayDrill | null) => void;
  onMove: (by: -1 | 1) => void;
}) {
  const [adding, setAdding] = useState("");
  return (
    <div className={`${styles.drill} ${drill.role === "optional" ? styles.drillOptional : ""}`}>
      <div className={styles.drillRow}>
        <span className={styles.drillName}>{drill.name}</span>
        <button
          type="button"
          className={styles.smallBtn}
          title="Switch between core (always given) and optional (chosen to suit the client)"
          onClick={() => onChange((d) => ({ ...d, role: d.role === "core" ? "optional" : "core" }))}
        >
          {drill.role === "core" ? "Core" : "Optional"}
        </button>
        <button type="button" className={styles.smallBtn} disabled={first} onClick={() => onMove(-1)} aria-label="Move up">
          ↑
        </button>
        <button type="button" className={styles.smallBtn} disabled={last} onClick={() => onMove(1)} aria-label="Move down">
          ↓
        </button>
        <button type="button" className={styles.smallBtn} onClick={() => onChange(() => null)}>
          Remove
        </button>
      </div>
      <div className={styles.drillRow}>
        {drill.exercise_ids.length === 0 && <span className={`${styles.exChip} ${styles.exChipMissing}`}>No library exercise yet</span>}
        {drill.exercise_ids.map((x) => (
          <span key={x} className={`${styles.exChip} ${names.has(x) ? "" : styles.exChipMissing}`}>
            {x} {names.get(x) ?? "(not in the library)"}
            <button
              type="button"
              className={styles.chipX}
              aria-label={`Unlink ${x}`}
              onClick={() => onChange((d) => ({ ...d, exercise_ids: d.exercise_ids.filter((e) => e !== x) }))}
            >
              ×
            </button>
          </span>
        ))}
        <select
          value={adding}
          onChange={(e) => {
            const v = e.target.value;
            setAdding("");
            if (v) onChange((d) => (d.exercise_ids.includes(v) ? d : { ...d, exercise_ids: [...d.exercise_ids, v] }));
          }}
          style={{ fontSize: 12, padding: "2px 6px", border: "1px solid var(--mist)", borderRadius: 7, maxWidth: 220 }}
        >
          <option value="">+ Link exercise</option>
          {exercises.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name} ({e.id})
            </option>
          ))}
        </select>
      </div>
      {drill.notes && <div style={{ fontSize: 12.5, color: "var(--graphite)" }}>{drill.notes}</div>}
    </div>
  );
}

function AddDrill({ exercises, onAdd }: { exercises: ExerciseOption[]; onAdd: (d: PathwayDrill) => void }) {
  const [name, setName] = useState("");
  const [exercise, setExercise] = useState("");
  const [role, setRole] = useState<"core" | "optional">("core");

  function add() {
    const picked = exercises.find((e) => e.id === exercise);
    const drillName = name.trim() || picked?.name || "";
    if (!drillName) return;
    onAdd({ name: drillName, exercise_ids: picked ? [picked.id] : [], role, notes: "" });
    setName("");
    setExercise("");
    setRole("core");
  }

  return (
    <div className={styles.addRow}>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New drill name" style={{ flex: "1 1 140px" }} />
      <select value={exercise} onChange={(e) => setExercise(e.target.value)} style={{ flex: "1 1 160px" }}>
        <option value="">Library exercise (optional)</option>
        {exercises.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name} ({e.id})
          </option>
        ))}
      </select>
      <select value={role} onChange={(e) => setRole(e.target.value as "core" | "optional")}>
        <option value="core">Core</option>
        <option value="optional">Optional</option>
      </select>
      <button type="button" className={styles.smallBtn} onClick={add} disabled={!name.trim() && !exercise}>
        Add drill
      </button>
    </div>
  );
}
