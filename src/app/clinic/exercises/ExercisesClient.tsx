"use client";

import { useMemo, useState, type CSSProperties } from "react";
import clinicStyles from "../clinic.module.css";

export type ExerciseRow = {
  exercise_id: string;
  name_clinical: string;
  body_site: string | null;
  equipment: string | null;
  difficulty: string | null;
};

export default function ExercisesClient({ initialExercises }: { initialExercises: ExerciseRow[] }) {
  const [exercises, setExercises] = useState<ExerciseRow[]>(initialExercises);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const [name, setName] = useState("");
  const [bodySite, setBodySite] = useState("");
  const [equipment, setEquipment] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return exercises;
    return exercises.filter((e) => e.name_clinical.toLowerCase().includes(q));
  }, [exercises, query]);

  async function handleAdd() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/clinic/exercises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name_clinical: name,
          body_site: bodySite || null,
          equipment: equipment || null,
          difficulty: difficulty || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed.");
      setExercises((prev) =>
        [
          {
            exercise_id: data.exercise_id,
            name_clinical: name.trim(),
            body_site: bodySite || null,
            equipment: equipment || null,
            difficulty: difficulty || null,
          },
          ...prev,
        ].sort((a, b) => a.name_clinical.localeCompare(b.name_clinical))
      );
      setName("");
      setBodySite("");
      setEquipment("");
      setDifficulty("");
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className={clinicStyles.card}>
        {!open ? (
          <button
            type="button"
            className={clinicStyles.buttonSecondaryAccent}
            style={{ "--zone-accent": "var(--accent-content)", "--zone-accent-soft": "var(--accent-content-soft)" } as CSSProperties}
            onClick={() => setOpen(true)}
          >
            + Add an exercise
          </button>
        ) : (
          <>
            <div className={clinicStyles.cardTitle}>Add an exercise</div>
            <div className={clinicStyles.field}>
              <label className={clinicStyles.label}>Name</label>
              <input className={clinicStyles.input} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className={clinicStyles.row2}>
              <div className={clinicStyles.field}>
                <label className={clinicStyles.label}>Body site</label>
                <input className={clinicStyles.input} value={bodySite} onChange={(e) => setBodySite(e.target.value)} />
              </div>
              <div className={clinicStyles.field}>
                <label className={clinicStyles.label}>Equipment</label>
                <input className={clinicStyles.input} value={equipment} onChange={(e) => setEquipment(e.target.value)} />
              </div>
            </div>
            <div className={clinicStyles.field}>
              <label className={clinicStyles.label}>Difficulty</label>
              <select className={clinicStyles.input} value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                <option value="">Not set</option>
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
              </select>
            </div>
            {error && <div className={clinicStyles.error}>{error}</div>}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                className={clinicStyles.button}
                style={{ width: "auto", padding: "0 20px" }}
                disabled={saving || !name.trim()}
                onClick={handleAdd}
              >
                {saving ? "Adding…" : "Add exercise"}
              </button>
              <button
                type="button"
                className={clinicStyles.buttonSecondary}
                style={{ width: "auto", padding: "0 20px" }}
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>

      <div className={clinicStyles.field} style={{ marginTop: 20 }}>
        <input
          className={clinicStyles.input}
          placeholder="Search exercises…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {filtered.map((e) => (
        <div key={e.exercise_id} className={clinicStyles.card} style={{ padding: "12px 18px" }}>
          <div style={{ fontSize: 14.5, fontWeight: 500 }}>{e.name_clinical}</div>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>
            {[e.body_site, e.equipment, e.difficulty].filter(Boolean).join(" · ") || "No details yet"}
          </div>
        </div>
      ))}
    </div>
  );
}
