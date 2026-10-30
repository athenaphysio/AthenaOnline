"use client";

import { useState } from "react";
import clinicStyles from "../../clinic.module.css";
import { APP_TABS, HOME_ITEMS, SIGNOFFS, type AppLayout, type TeamMember } from "@/lib/appLayout";

// The "What clients see in the app" part of a brand pack: the bottom
// toolbar and its tabs, the home page items, the sign-off and the team.
// Controlled by the pack editor, so one Save button keeps everything.

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      style={{
        position: "relative",
        width: 42,
        height: 24,
        borderRadius: 999,
        border: "none",
        padding: 0,
        flexShrink: 0,
        cursor: "pointer",
        background: on ? "var(--crimson)" : "rgba(0, 0, 0, 0.18)",
        transition: "background 160ms ease",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 3,
          left: on ? 21 : 3,
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "#fff",
          boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
          transition: "left 160ms ease",
        }}
      />
    </button>
  );
}

function Row({ title, note, on, onChange, disabled }: { title: string; note?: string; on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "9px 0", borderTop: "1px solid var(--border)", opacity: disabled ? 0.5 : 1 }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{title}</div>
        {note && <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2, lineHeight: 1.45 }}>{note}</div>}
      </div>
      <Switch on={on} onChange={disabled ? () => {} : onChange} label={title} />
    </div>
  );
}

const input: React.CSSProperties = {
  width: "100%",
  padding: "9px 11px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  font: "inherit",
  fontSize: 14,
  background: "#fff",
  color: "inherit",
};

// A team member's photo: a round preview, and buttons to add, change or
// remove it. The photo is uploaded straight away; the address is kept with
// the team when the pack is saved.
function MemberPhoto({ packId, photo, name, onChange }: { packId: string; photo: string; name: string; onChange: (url: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch(`/api/clinic/brand-packs/${packId}/team-photo`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed.");
      onChange(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: "50%",
          overflow: "hidden",
          flexShrink: 0,
          background: "var(--clinic-box-recessed, #efe6d6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          color: "var(--muted)",
        }}
      >
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt={name ? `Photo of ${name}` : ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          "No photo"
        )}
      </div>
      <label className={clinicStyles.buttonSecondary} style={{ cursor: busy ? "wait" : "pointer" }}>
        {busy ? "Uploading…" : photo ? "Change photo" : "Add photo"}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) upload(f);
          }}
        />
      </label>
      {photo && !busy && (
        <button type="button" className={clinicStyles.buttonSecondary} onClick={() => onChange("")}>
          Remove photo
        </button>
      )}
      {error && <span style={{ color: "var(--crimson)", fontSize: 13 }}>{error}</span>}
    </div>
  );
}

export default function AppLayoutEditor({ packId, layout, onChange }: { packId: string; layout: AppLayout; onChange: (next: AppLayout) => void }) {
  const set = (patch: Partial<AppLayout>) => onChange({ ...layout, ...patch });
  const setMember = (i: number, patch: Partial<TeamMember>) =>
    set({ team: layout.team.map((m, j) => (j === i ? { ...m, ...patch } : m)) });

  return (
    <div className={clinicStyles.field} style={{ marginTop: 22 }}>
      <label className={clinicStyles.label}>What clients see in the app</label>
      <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 12px", lineHeight: 1.5 }}>
        Everyone on this pack sees the same app. Anything switched off here disappears from the home page and the menu.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 22 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, letterSpacing: 0.4, textTransform: "uppercase", margin: "0 0 4px" }}>Bottom toolbar</div>
          <Row
            title="Show the toolbar"
            note="Home first, then the tabs switched on below."
            on={layout.bottom_bar}
            onChange={(v) => set({ bottom_bar: v })}
          />
          {APP_TABS.map((t) => (
            <Row
              key={t.key}
              title={t.label}
              note={t.note}
              on={layout.tabs[t.key]}
              disabled={!layout.bottom_bar}
              onChange={(v) => set({ tabs: { ...layout.tabs, [t.key]: v } })}
            />
          ))}
          <Row
            title="Messaging included"
            note="Clients can message the team freely, without a membership."
            on={layout.messaging_included}
            onChange={(v) => set({ messaging_included: v })}
          />
        </div>

        <div>
          <div style={{ fontWeight: 700, fontSize: 13, letterSpacing: 0.4, textTransform: "uppercase", margin: "0 0 4px" }}>Home page</div>
          {HOME_ITEMS.map((h) => (
            <Row key={h.key} title={h.label} on={layout.home[h.key]} onChange={(v) => set({ home: { ...layout.home, [h.key]: v } })} />
          ))}
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 13, letterSpacing: 0.4, textTransform: "uppercase", margin: "0 0 8px" }}>Sign-off at the foot of the home page</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {SIGNOFFS.map((s) => {
            const on = layout.signoff === s.key;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => set({ signoff: s.key })}
                aria-pressed={on}
                style={{
                  flex: "1 1 180px",
                  textAlign: "left",
                  padding: "10px 13px",
                  borderRadius: 10,
                  cursor: "pointer",
                  font: "inherit",
                  background: on ? "var(--clinic-box-recessed, #efe6d6)" : "transparent",
                  border: on ? "2px solid var(--crimson)" : "1px solid var(--border)",
                  color: "inherit",
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 14 }}>{s.label}</div>
                <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>{s.note}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 13, letterSpacing: 0.4, textTransform: "uppercase", margin: "0 0 8px" }}>The app</div>
        <p style={{ fontSize: 12.5, opacity: 0.75, margin: "0 0 8px", lineHeight: 1.5 }}>
          If this pack has an app of its own, its name and the line beneath it appear on the login page under the brand&apos;s logo,
          and the name sits under the icon on the client&apos;s phone.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 160px) minmax(0, 1fr)", gap: 8, maxWidth: 560, marginBottom: 18 }}>
          <input
            style={input}
            placeholder="App name, for example ROAM"
            value={layout.app_name}
            onChange={(e) => set({ app_name: e.target.value })}
            aria-label="App name"
          />
          <input
            style={input}
            placeholder="The line beneath it"
            value={layout.app_strapline}
            onChange={(e) => set({ app_strapline: e.target.value })}
            aria-label="App strapline"
          />
        </div>

        <div style={{ fontWeight: 700, fontSize: 13, letterSpacing: 0.4, textTransform: "uppercase", margin: "0 0 8px" }}>The team</div>
        <input
          style={{ ...input, maxWidth: 360, marginBottom: 10 }}
          placeholder="Team name, for example The Regenerate team"
          value={layout.team_name}
          onChange={(e) => set({ team_name: e.target.value })}
          aria-label="Team name"
        />
        <div style={{ display: "grid", gap: 10 }}>
          {layout.team.map((m, i) => (
            <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12, display: "grid", gap: 8 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8 }}>
                <input style={input} placeholder="Name" value={m.name} onChange={(e) => setMember(i, { name: e.target.value })} aria-label="Name" />
                <input style={input} placeholder="Role" value={m.role} onChange={(e) => setMember(i, { role: e.target.value })} aria-label="Role" />
                <div style={{ display: "flex", gap: 4 }}>
                  <button type="button" className={clinicStyles.buttonSecondary} disabled={i === 0} onClick={() => set({ team: swap(layout.team, i, i - 1) })} aria-label="Move up">
                    ↑
                  </button>
                  <button type="button" className={clinicStyles.buttonSecondary} onClick={() => set({ team: layout.team.filter((_, j) => j !== i) })}>
                    Remove
                  </button>
                </div>
              </div>
              <MemberPhoto packId={packId} photo={m.photo} name={m.name} onChange={(url) => setMember(i, { photo: url })} />
              <textarea
                style={{ ...input, minHeight: 64, resize: "vertical" }}
                placeholder="A sentence or two on what they do for the client"
                value={m.about}
                onChange={(e) => setMember(i, { about: e.target.value })}
                aria-label="About"
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          className={clinicStyles.buttonSecondary}
          style={{ marginTop: 10 }}
          disabled={layout.team.length >= 12}
          onClick={() => set({ team: [...layout.team, { name: "", role: "", about: "", photo: "" }] })}
        >
          Add a team member
        </button>
      </div>
    </div>
  );
}

function swap<T>(list: T[], a: number, b: number): T[] {
  const next = [...list];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}
