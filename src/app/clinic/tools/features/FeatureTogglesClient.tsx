"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clinicStyles from "../../clinic.module.css";

type Props = {
  initialRunningBuilderEnabled: boolean;
  initialRunningLaddersEnabled: boolean;
};

function Toggle({
  label,
  description,
  enabled,
  saving,
  onChange,
}: {
  label: string;
  description: string;
  enabled: boolean;
  saving: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className={clinicStyles.card}>
      <div className={clinicStyles.cardTitle}>{label}</div>
      <p className={clinicStyles.notice} style={{ marginTop: 0 }}>
        {description}
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span className={`${clinicStyles.statusPill} ${enabled ? clinicStyles.statusActive : clinicStyles.statusNoProgramme}`}>
          {enabled ? "On" : "Off"}
        </span>
        <button
          type="button"
          className={clinicStyles.buttonSecondary}
          style={{ width: "auto", padding: "0 16px", height: 32, fontSize: 13 }}
          disabled={saving}
          onClick={() => onChange(!enabled)}
        >
          {saving ? "…" : enabled ? "Turn off" : "Turn on"}
        </button>
      </div>
    </div>
  );
}

// David's switch to bring the old AI-driven Running Builder and Running
// ladders screens back into the menu -- see 0090_clinic_settings.sql and
// the athena-plan-v1 Step 1 brief. Both are off by default; nothing about
// their own code or data changes here, only whether they're offered.
export default function FeatureTogglesClient({ initialRunningBuilderEnabled, initialRunningLaddersEnabled }: Props) {
  const router = useRouter();
  const [runningBuilder, setRunningBuilder] = useState(initialRunningBuilderEnabled);
  const [runningLadders, setRunningLadders] = useState(initialRunningLaddersEnabled);
  const [saving, setSaving] = useState<"builder" | "ladders" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function update(field: "running_builder_enabled" | "running_ladders_enabled", value: boolean, which: "builder" | "ladders") {
    setSaving(which);
    setError(null);
    try {
      const res = await fetch("/api/clinic/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed.");
      if (which === "builder") setRunningBuilder(value);
      else setRunningLadders(value);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div>
      <Toggle
        label="Running Builder"
        description="The paste-a-Twofold-note, AI-matched running programme builder. Off by default now that running plans are built in Claude chat and imported instead."
        enabled={runningBuilder}
        saving={saving === "builder"}
        onChange={(next) => update("running_builder_enabled", next, "builder")}
      />
      <Toggle
        label="Running ladders"
        description="David's own running progression ladders, used by the Running Builder above."
        enabled={runningLadders}
        saving={saving === "ladders"}
        onChange={(next) => update("running_ladders_enabled", next, "ladders")}
      />
      {error && <div className={clinicStyles.error}>{error}</div>}
    </div>
  );
}
