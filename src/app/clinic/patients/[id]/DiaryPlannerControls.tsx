"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clinicStyles from "../../clinic.module.css";
import { SLOT_LOCATIONS, formatSlotWhen, locationLabel, type SlotLocation, type SlotSummary } from "@/lib/diary";

type Props = {
  patientId: string;
  firstName: string;
  enabled: boolean;
  google?: { connected: boolean; email: string | null; lastError: string | null };
  links?: { id: string; paName: string; lastUsedAt: string | null }[];
  slots?: { key: string; label: string; slot: SlotSummary | null }[];
  equipment?: { id: string; name: string }[];
  equipmentByLocation?: Record<SlotLocation, string[]>;
};

const ROW: React.CSSProperties = { padding: "8px 0", borderTop: "1px solid var(--border)", fontSize: 13 };

export default function DiaryPlannerControls(props: Props) {
  const { patientId, firstName, enabled } = props;
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [openLocation, setOpenLocation] = useState<SlotLocation | null>(null);
  const [picked, setPicked] = useState<Record<SlotLocation, string[]>>(
    props.equipmentByLocation ?? { home: [], office: [], gym: [], hotel: [], travel: [] },
  );

  async function send(method: "PATCH" | "DELETE", body: unknown) {
    setBusy(true);
    try {
      const res = await fetch(`/api/clinic/patients/${patientId}/diary`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) router.refresh();
      return res.ok;
    } finally {
      setBusy(false);
    }
  }

  function toggleEquipment(location: SlotLocation, id: string) {
    setPicked((prev) => {
      const has = prev[location].includes(id);
      return { ...prev, [location]: has ? prev[location].filter((x) => x !== id) : [...prev[location], id] };
    });
  }

  const small = { width: "auto", padding: "0 14px", height: 30, fontSize: 12.5 } as const;

  return (
    <div className={clinicStyles.card}>
      <div className={clinicStyles.cardTitle}>Diary planner</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
        <span className={`${clinicStyles.statusPill} ${enabled ? clinicStyles.statusActive : clinicStyles.statusNoProgramme}`}>
          {enabled ? "On" : "Off"}
        </span>
        <button type="button" onClick={() => send("PATCH", { enabled: !enabled })} disabled={busy} className={clinicStyles.buttonSecondary} style={small}>
          {busy ? "…" : enabled ? "Turn off" : "Turn on"}
        </button>
      </div>

      {!enabled ? (
        <p className={clinicStyles.notice} style={{ marginTop: 10, marginBottom: 0 }}>
          For executive clients. When on, {firstName} gets a Your diary page to place each session in a real slot, link Google Calendar and
          share a planner link with their PA, and each session fits the length of its slot.
        </p>
      ) : (
        <>
          <p className={clinicStyles.notice} style={{ marginTop: 10 }}>
            Google Calendar:{" "}
            {props.google?.connected
              ? `linked${props.google.email ? ` as ${props.google.email}` : ""}${props.google.lastError ? `. Last problem: ${props.google.lastError}` : ""}`
              : "not linked yet"}
            .
          </p>

          <div style={{ marginTop: 6 }}>
            <strong style={{ fontSize: 13 }}>Shared with</strong>
            {(props.links ?? []).length === 0 && <div style={ROW}>Nobody yet. {firstName} makes PA links from their Your diary page.</div>}
            {(props.links ?? []).map((l) => (
              <div key={l.id} style={{ ...ROW, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <span>
                  {l.paName}, {l.lastUsedAt ? `last used ${new Date(l.lastUsedAt).toLocaleDateString("en-GB")}` : "not used yet"}
                </span>
                <button type="button" className={clinicStyles.buttonSecondary} style={small} disabled={busy} onClick={() => send("DELETE", { linkId: l.id })}>
                  Switch off
                </button>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 12 }}>
            <strong style={{ fontSize: 13 }}>This week and next</strong>
            {(props.slots ?? []).length === 0 && <div style={ROW}>No sessions to place this week or next.</div>}
            {(props.slots ?? []).map((s) => (
              <div key={s.key} style={ROW}>
                {s.label}:{" "}
                {s.slot
                  ? `${formatSlotWhen(s.slot.startsAt)}, ${s.slot.durationMinutes} min, ${locationLabel(s.slot.location).toLowerCase()} (placed by ${s.slot.placedBy === "pa" ? "PA" : s.slot.placedBy})`
                  : "not placed"}
              </div>
            ))}
          </div>

          <div style={{ marginTop: 12 }}>
            <strong style={{ fontSize: 13 }}>Equipment at each place</strong>
            <p className={clinicStyles.notice} style={{ margin: "4px 0 6px" }}>
              Used to point out exercises that need something {firstName} won&apos;t have in a slot&apos;s location. A place left empty is not checked.
            </p>
            {SLOT_LOCATIONS.map((loc) => (
              <div key={loc.value} style={ROW}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <span>
                    {loc.label}: {picked[loc.value].length === 0 ? "not set" : `${picked[loc.value].length} items`}
                  </span>
                  <button
                    type="button"
                    className={clinicStyles.buttonSecondary}
                    style={small}
                    onClick={() => setOpenLocation(openLocation === loc.value ? null : loc.value)}
                  >
                    {openLocation === loc.value ? "Close" : "Edit"}
                  </button>
                </div>
                {openLocation === loc.value && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px" }}>
                      {(props.equipment ?? []).map((e) => (
                        <label key={e.id} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <input type="checkbox" checked={picked[loc.value].includes(e.id)} onChange={() => toggleEquipment(loc.value, e.id)} />
                          {e.name}
                        </label>
                      ))}
                    </div>
                    <button
                      type="button"
                      className={clinicStyles.buttonSecondary}
                      style={{ ...small, marginTop: 8 }}
                      disabled={busy}
                      onClick={async () => {
                        if (await send("PATCH", { location: loc.value, equipmentIds: picked[loc.value] })) setOpenLocation(null);
                      }}
                    >
                      Save {loc.label.toLowerCase()}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
