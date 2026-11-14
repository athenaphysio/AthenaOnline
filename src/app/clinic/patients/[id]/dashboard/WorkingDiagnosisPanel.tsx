"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./ClientDashboard.module.css";

export type PathwayChoice = { id: string; name: string; region: string; presentations: string[] };
export type PathwayHistory = { id: string; pathway: string; presentation: string; stage: string; created_at: string; draftId: string | null };

const FIELD: React.CSSProperties = {
  font: "inherit",
  fontSize: 14,
  padding: "8px 10px",
  border: "1px solid var(--border)",
  borderRadius: 8,
  background: "var(--surface, #fff)",
  color: "inherit",
  minWidth: 0,
};

// Give a working diagnosis and the programme is built from it: the chosen
// pathway, started at the stage that suits this presentation, saved under
// "Saved, not sent" for review before anything reaches the client.
export default function WorkingDiagnosisPanel({
  patientId,
  firstName,
  pathways,
  history,
}: {
  patientId: string;
  firstName: string;
  pathways: PathwayChoice[];
  history: PathwayHistory[];
}) {
  const router = useRouter();
  const [pathwayId, setPathwayId] = useState("");
  const [presentation, setPresentation] = useState("");
  const [weeks, setWeeks] = useState(4);
  const [perWeek, setPerWeek] = useState(3);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chosen = pathways.find((p) => p.id === pathwayId) ?? null;

  async function build() {
    setBuilding(true);
    setError(null);
    const res = await fetch(`/api/clinic/patients/${patientId}/pathway`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pathway_id: pathwayId, presentation, weeks, sessions_per_week: perWeek }),
    });
    const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
    setBuilding(false);
    if (!res.ok || !body.url) {
      setError(body.error ?? "Something went wrong building the programme.");
      return;
    }
    router.push(body.url);
  }

  if (pathways.length === 0) {
    return (
      <p className={styles.muted} style={{ margin: 0, fontSize: 14 }}>
        No approved pathways yet. Paste a pathway into the Vault under Pathways and approve it, and you can build{" "}
        {firstName}&apos;s programme from a working diagnosis here.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <select
          value={pathwayId}
          onChange={(e) => {
            setPathwayId(e.target.value);
            setPresentation("");
          }}
          style={{ ...FIELD, flex: "2 1 220px" }}
          aria-label="Pathway"
        >
          <option value="">Choose a pathway</option>
          {pathways.map((p) => (
            <option key={p.id} value={p.id}>
              {p.region ? `${p.region}: ` : ""}
              {p.name}
            </option>
          ))}
        </select>
        {chosen && chosen.presentations.length > 0 && (
          <select value={presentation} onChange={(e) => setPresentation(e.target.value)} style={{ ...FIELD, flex: "2 1 220px" }} aria-label="Presentation">
            <option value="">Choose the presentation</option>
            {chosen.presentations.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        )}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", fontSize: 14 }}>
        <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          Weeks
          <input type="number" min={1} max={12} value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} style={{ ...FIELD, width: 70 }} />
        </label>
        <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          Sessions a week
          <input type="number" min={1} max={7} value={perWeek} onChange={(e) => setPerWeek(Number(e.target.value))} style={{ ...FIELD, width: 70 }} />
        </label>
        <button
          type="button"
          className={styles.btn}
          disabled={building || !chosen || (chosen.presentations.length > 0 && !presentation)}
          onClick={build}
        >
          {building ? "Building" : "Build programme"}
        </button>
      </div>
      {error && <p style={{ margin: 0, color: "var(--crimson)", fontSize: 13.5 }}>{error}</p>}
      <p className={styles.muted} style={{ margin: 0, fontSize: 12.5 }}>
        Every drill in the starting stage goes into one session, core first and then optional, so you only need to
        remove what doesn&apos;t suit. It is saved under Saved, not sent, and {firstName} sees nothing until you send it.
      </p>

      {history.length > 0 && (
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          {history.map((h) => (
            <div key={h.id} style={{ fontSize: 13.5 }}>
              <strong>{h.pathway}</strong>
              {h.presentation ? `, ${h.presentation}` : ""}, on {h.stage}
              <span className={styles.muted}> (from {new Date(h.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
