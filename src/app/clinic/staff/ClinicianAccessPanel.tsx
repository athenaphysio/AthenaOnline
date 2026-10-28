"use client";

import { useState } from "react";
import clinicStyles from "../clinic.module.css";
import { SECTIONS } from "@/lib/clinicianAccessSections";

export type AccessCoach = { id: string; name: string; email: string; profession: string | null };
export type AccessPackage = { id: string; name: string };
export type AccessSwitch = { staff_id: string; package_id: string; section: string };

type Props = { coaches: AccessCoach[]; packages: AccessPackage[]; initialSwitches: AccessSwitch[] };

// One card per clinician: their profession (shown to clients on the consent
// page) and a slider for every section in every package.
export default function ClinicianAccessPanel({ coaches, packages, initialSwitches }: Props) {
  const [switches, setSwitches] = useState(initialSwitches);

  const isOn = (staffId: string, packageId: string, section: string) =>
    switches.some((s) => s.staff_id === staffId && s.package_id === packageId && s.section === section);

  async function flip(staffId: string, packageId: string, section: string) {
    const on = !isOn(staffId, packageId, section);
    const apply = (turnOn: boolean) =>
      setSwitches((prev) =>
        turnOn
          ? [...prev, { staff_id: staffId, package_id: packageId, section }]
          : prev.filter((s) => !(s.staff_id === staffId && s.package_id === packageId && s.section === section))
      );
    apply(on);
    const res = await fetch(`/api/clinic/staff/${staffId}/sections`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ package_id: packageId, section, on }),
    }).catch(() => null);
    if (!res?.ok) apply(!on);
  }

  if (coaches.length === 0) return null;

  return (
    <div style={{ marginTop: 28 }}>
      <h2 className={clinicStyles.heading} style={{ fontSize: 22 }}>
        Clinician access
      </h2>
      <p className={clinicStyles.subheading}>
        Choose what each clinician can see for clients in each package. Switching a section off takes effect straight
        away. Switching one on only reaches a client once that client has signed a consent naming this clinician and
        this section, so they will be asked to sign again.
      </p>
      {coaches.map((coach) => (
        <div key={coach.id} className={clinicStyles.card}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div>
              <div className={clinicStyles.cardTitle} style={{ margin: 0 }}>
                {coach.name}
              </div>
              <div style={{ fontSize: 13, color: "var(--graphite)" }}>{coach.email}</div>
            </div>
            <ProfessionField coach={coach} />
          </div>

          <div style={{ overflowX: "auto", marginTop: 14 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr>
                  <th style={th}>Section</th>
                  {packages.map((p) => (
                    <th key={p.id} style={{ ...th, textAlign: "center", width: 140 }}>
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SECTIONS.map((s) => (
                  <tr key={s.key}>
                    <td style={td}>
                      <div style={{ fontWeight: 500 }}>{s.label}</div>
                      <div style={{ fontSize: 12, color: "var(--graphite)" }}>{s.hint}</div>
                    </td>
                    {packages.map((p) => {
                      const on = isOn(coach.id, p.id, s.key);
                      return (
                        <td key={p.id} style={{ ...td, textAlign: "center" }}>
                          <Slider on={on} label={`${s.label} for ${coach.name} in ${p.name}`} onChange={() => flip(coach.id, p.id, s.key)} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

function ProfessionField({ coach }: { coach: AccessCoach }) {
  const [value, setValue] = useState(coach.profession ?? "");
  const [saved, setSaved] = useState(coach.profession ?? "");
  async function save() {
    const res = await fetch(`/api/clinic/staff/${coach.id}/profile`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profession: value }),
    });
    if (res.ok) setSaved(value);
  }
  return (
    <div style={{ minWidth: 0, flex: "1 1 320px", maxWidth: 460 }}>
      <label className={clinicStyles.label} htmlFor={`profession-${coach.id}`} style={{ fontSize: 12 }}>
        Role shown to clients
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          id={`profession-${coach.id}`}
          className={clinicStyles.input}
          style={{ fontSize: 14, padding: "6px 10px" }}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="For example, GMC registered doctor (MBBS)"
        />
        <button
          type="button"
          className={clinicStyles.buttonSecondary}
          style={{ width: "auto", padding: "0 14px", height: 34, fontSize: 13 }}
          disabled={value === saved}
          onClick={save}
        >
          Save
        </button>
      </div>
    </div>
  );
}

export function Slider({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onChange}
      style={{
        width: 44,
        height: 26,
        borderRadius: 13,
        border: "none",
        padding: 3,
        cursor: "pointer",
        background: on ? "#2e6f5c" : "#c9ced5",
        transition: "background 0.15s",
        display: "inline-flex",
        justifyContent: on ? "flex-end" : "flex-start",
      }}
    >
      <span style={{ width: 20, height: 20, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.25)" }} />
    </button>
  );
}

const th = {
  textAlign: "left" as const,
  padding: "8px 10px",
  borderBottom: "1px solid var(--mist)",
  color: "var(--graphite)",
  fontWeight: 500,
  fontSize: 12.5,
};
const td = { padding: "10px", borderBottom: "1px solid var(--mist)", verticalAlign: "middle" as const };
