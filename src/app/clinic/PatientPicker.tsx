"use client";

import { useEffect, useState } from "react";
import styles from "./clinic.module.css";

export type Patient = {
  id: string;
  first_name: string;
  email: string;
};

type Props = {
  selected: Patient | null;
  onSelect: (patient: Patient | null) => void;
  readOnly?: boolean;
};

export default function PatientPicker({ selected, onSelect, readOnly }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Patient[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/clinic/patients/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.patients ?? []);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [query, open]);

  if (selected) {
    return (
      <div className={styles.field}>
        <label className={styles.label}>Patient</label>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className={styles.input} style={{ flex: 1 }}>
            {selected.first_name} <span className={styles.exerciseId}>{selected.email}</span>
          </div>
          {!readOnly && (
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => {
                onSelect(null);
                setOpen(true);
                setQuery("");
              }}
            >
              Change
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.field}>
      <label className={styles.label}>Patient</label>
      <input
        className={styles.input}
        placeholder="Search by name or email…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
      />
      {open && (
        <div className={styles.pickerResults}>
          {loading && <div className={styles.pickerRow}>Searching…</div>}
          {!loading && results.length === 0 && (
            <div className={styles.pickerRow}>No patients found. They need to create an account first.</div>
          )}
          {!loading &&
            results.map((p) => (
              <button
                key={p.id}
                type="button"
                className={styles.pickerRow}
                onClick={() => {
                  onSelect(p);
                  setOpen(false);
                }}
              >
                {p.first_name} <span style={{ color: "var(--muted)" }}>— {p.email}</span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
