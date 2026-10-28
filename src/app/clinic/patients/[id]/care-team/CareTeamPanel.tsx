"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clinicStyles from "../../../clinic.module.css";
import { Slider } from "../../../staff/ClinicianAccessPanel";
import { SECTIONS, sectionLabel } from "@/lib/clinicianAccessSections";

export type PackageState = {
  id: string;
  name: string;
  member: boolean;
  consent: { tone: "green" | "amber" | "muted"; text: string; clinicians?: string[] } | null;
};
export type NoteRow = { id: string; section: string; author_name: string; body: string; created_at: string };
export type LogRow = { who: string; section: string; at: string };

const TONE = { green: "#2e6f5c", amber: "#b45309", muted: "#565f6b" } as const;

export default function CareTeamPanel({ patientId, packages, notes, log }: { patientId: string; packages: PackageState[]; notes: NoteRow[]; log: LogRow[] }) {
  const router = useRouter();
  const [section, setSection] = useState("programme");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function setMember(packageId: string, member: boolean) {
    await fetch(`/api/clinic/patients/${patientId}/packages`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ package_id: packageId, member }),
    });
    router.refresh();
  }

  async function addNote() {
    setBusy(true);
    try {
      const res = await fetch(`/api/clinic/patients/${patientId}/care-notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, body }),
      });
      if (res.ok) {
        setBody("");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className={clinicStyles.card}>
        <div className={clinicStyles.cardTitle}>Packages and consent</div>
        {packages.length === 0 && <p className={clinicStyles.notice}>No packages yet. Create one on the Packages page.</p>}
        {packages.map((p) => (
          <div key={p.id} style={{ borderTop: "1px solid var(--mist)", padding: "12px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Slider on={p.member} label={`In ${p.name}`} onChange={() => setMember(p.id, !p.member)} />
              <div style={{ fontWeight: 600 }}>{p.name}</div>
            </div>
            {p.consent && (
              <div style={{ marginTop: 6, marginLeft: 56, fontSize: 13.5 }}>
                <div style={{ color: TONE[p.consent.tone] }}>{p.consent.text}</div>
                {p.consent.clinicians && (
                  <ul style={{ margin: "6px 0 0", paddingLeft: 18, color: "var(--graphite)", fontSize: 13 }}>
                    {p.consent.clinicians.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className={clinicStyles.card}>
        <div className={clinicStyles.cardTitle}>Care team notes</div>
        <p className={clinicStyles.notice} style={{ marginTop: 0 }}>
          Notes for the care team, never shown to the client. Each note sits in one section and is seen by clinicians who
          can see that section.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
          <select
            id="note-section"
            className={clinicStyles.input}
            style={{ width: "auto", fontSize: 14, padding: "6px 10px" }}
            value={section}
            onChange={(e) => setSection(e.target.value)}
          >
            {SECTIONS.filter((s) => s.key !== "write_notes").map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          <textarea
            id="note-body"
            className={clinicStyles.textarea}
            style={{ flex: "1 1 320px", minHeight: 70, fontFamily: "var(--font-inter), sans-serif", fontSize: 14 }}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a note for the care team"
          />
          <button
            type="button"
            className={clinicStyles.buttonSecondary}
            style={{ width: "auto", padding: "0 16px", height: 34, fontSize: 13 }}
            disabled={busy || !body.trim()}
            onClick={addNote}
          >
            Add note
          </button>
        </div>
        {notes.map((n) => (
          <div key={n.id} style={{ borderTop: "1px solid var(--mist)", padding: "10px 0", marginTop: 10 }}>
            <div style={{ fontSize: 12.5, color: "var(--graphite)" }}>
              {n.author_name}, {sectionLabel(n.section)}, {new Date(n.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
            </div>
            <div style={{ fontSize: 14, whiteSpace: "pre-wrap", marginTop: 2 }}>{n.body}</div>
          </div>
        ))}
      </div>

      <div className={clinicStyles.card}>
        <div className={clinicStyles.cardTitle}>Who has looked at this record</div>
        {log.length === 0 ? (
          <p className={clinicStyles.notice} style={{ marginTop: 0 }}>
            No clinician has opened this client&apos;s record yet.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
              <tbody>
                {log.map((l, i) => (
                  <tr key={i}>
                    <td style={cell}>{new Date(l.at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</td>
                    <td style={cell}>{l.who}</td>
                    <td style={{ ...cell, color: "var(--graphite)" }}>{l.section}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

const cell = { padding: "6px 8px", borderBottom: "1px solid var(--mist)" };
