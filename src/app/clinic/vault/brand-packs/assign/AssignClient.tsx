"use client";

import { useEffect, useState } from "react";
import clinicStyles from "../../../clinic.module.css";
import styles from "../BrandPacks.module.css";
import type { BrandPack } from "@/lib/brandPack";

type ProgrammeResult = { id: string; title: string; brand_pack_id: string | null };
type PatientResult = { id: string; name: string; email: string; brand_pack_id: string | null };

type Target =
  | { type: "programme"; id: string; label: string; currentBrandPackId: string | null }
  | { type: "patient"; id: string; label: string; currentBrandPackId: string | null };

export default function AssignClient({ packs }: { packs: BrandPack[] }) {
  const [query, setQuery] = useState("");
  const [programmes, setProgrammes] = useState<ProgrammeResult[]>([]);
  const [patients, setPatients] = useState<PatientResult[]>([]);
  const [searching, setSearching] = useState(false);

  const [target, setTarget] = useState<Target | null>(null);
  const [selectedPackId, setSelectedPackId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (target) return;
    setSearching(true);
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/clinic/brand-packs/search-targets?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setProgrammes(data.programmes ?? []);
        setPatients(data.patients ?? []);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [query, target]);

  function selectProgramme(p: ProgrammeResult) {
    setTarget({ type: "programme", id: p.id, label: p.title, currentBrandPackId: p.brand_pack_id });
    setSelectedPackId(p.brand_pack_id ?? "");
    setSaved(false);
  }

  function selectPatient(p: PatientResult) {
    setTarget({ type: "patient", id: p.id, label: p.name, currentBrandPackId: p.brand_pack_id });
    setSelectedPackId(p.brand_pack_id ?? "");
    setSaved(false);
  }

  async function handleSave() {
    if (!target) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/clinic/brand-packs/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_type: target.type,
          target_id: target.id,
          brand_pack_id: selectedPackId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed.");
      setTarget({ ...target, currentBrandPackId: selectedPackId || null });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  if (target) {
    return (
      <div className={clinicStyles.card}>
        <div className={clinicStyles.field}>
          <label className={clinicStyles.label}>{target.type === "programme" ? "Programme" : "Client"}</label>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className={clinicStyles.input} style={{ flex: 1 }}>
              {target.label}
            </div>
            <button
              type="button"
              className={clinicStyles.buttonSecondary}
              style={{ width: "auto", padding: "0 16px", height: 38 }}
              onClick={() => {
                setTarget(null);
                setSaved(false);
              }}
            >
              Change
            </button>
          </div>
        </div>

        <div className={clinicStyles.field} style={{ marginBottom: 0 }}>
          <label className={clinicStyles.label}>Brand pack</label>
          <select
            className={clinicStyles.input}
            value={selectedPackId}
            onChange={(e) => {
              setSelectedPackId(e.target.value);
              setSaved(false);
            }}
          >
            <option value="">None -- use default</option>
            {packs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.is_default ? " (default)" : ""}
              </option>
            ))}
          </select>
        </div>

        <p className={clinicStyles.notice} style={{ marginTop: 14 }}>
          {target.type === "programme"
            ? selectedPackId
              ? `Everyone on the ${target.label} programme will see this pack, unless they personally have their own pack assigned.`
              : `Everyone on the ${target.label} programme will see the default pack, unless they personally have their own pack assigned, or the programme is later given its own pack.`
            : selectedPackId
              ? `${target.label} will see this pack everywhere in the app, overriding whatever pack their programme uses.`
              : `${target.label} has no pack of their own -- they'll see whatever their programme uses, or the default pack if the programme doesn't have one either.`}
        </p>

        {error && (
          <div className={clinicStyles.error} style={{ marginTop: 12 }}>
            {error}
          </div>
        )}

        <button
          type="button"
          className={clinicStyles.button}
          style={{ marginTop: 18 }}
          disabled={saving}
          onClick={handleSave}
        >
          {saving ? "Saving…" : saved ? "Saved" : "Save assignment"}
        </button>
      </div>
    );
  }

  return (
    <div className={clinicStyles.card}>
      <div className={clinicStyles.field} style={{ marginBottom: 0 }}>
        <label className={clinicStyles.label}>Search programmes or clients</label>
        <input
          className={clinicStyles.input}
          placeholder="Search by programme title, client name, or email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div style={{ marginTop: 16 }}>
        {searching && <div className={styles.uploadFormat}>Searching…</div>}

        {!searching && (
          <>
            <div className={clinicStyles.smallLabel}>Programmes</div>
            {programmes.length === 0 && <div className={clinicStyles.notice}>No programmes match.</div>}
            {programmes.map((p) => (
              <button key={p.id} type="button" className={clinicStyles.pickerRow} onClick={() => selectProgramme(p)}>
                {p.title}
              </button>
            ))}

            <div className={clinicStyles.smallLabel} style={{ marginTop: 16 }}>
              Clients
            </div>
            {patients.length === 0 && <div className={clinicStyles.notice}>No clients match.</div>}
            {patients.map((p) => (
              <button key={p.id} type="button" className={clinicStyles.pickerRow} onClick={() => selectPatient(p)}>
                {p.name} <span style={{ color: "var(--muted)" }}>({p.email})</span>
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
