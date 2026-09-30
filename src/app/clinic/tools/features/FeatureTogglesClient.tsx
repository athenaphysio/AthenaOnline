"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clinicStyles from "../../clinic.module.css";

type Props = {
  initialRunningBuilderEnabled: boolean;
  initialRunningLaddersEnabled: boolean;
  initialAiToolsEnabled: boolean;
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

type Which = "builder" | "ladders" | "ai";

// David's switches to bring the old AI-driven Running Builder / Running
// ladders screens, and every in-app AI tool, back on -- see
// 0090_clinic_settings.sql, 0093_ai_tools_switch.sql and the Step 1 brief.
// All off by default; nothing about their own code or data changes here,
// only whether they're offered.
export default function FeatureTogglesClient({
  initialRunningBuilderEnabled,
  initialRunningLaddersEnabled,
  initialAiToolsEnabled,
}: Props) {
  const router = useRouter();
  const [runningBuilder, setRunningBuilder] = useState(initialRunningBuilderEnabled);
  const [runningLadders, setRunningLadders] = useState(initialRunningLaddersEnabled);
  const [aiTools, setAiTools] = useState(initialAiToolsEnabled);
  const [saving, setSaving] = useState<Which | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function update(field: "running_builder_enabled" | "running_ladders_enabled" | "ai_tools_enabled", value: boolean, which: Which) {
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
      else if (which === "ladders") setRunningLadders(value);
      else setAiTools(value);
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
        label="AI tools"
        description="Every in-app AI button: Generate scaffold, Say it, drafting a block from a brief, the library ranking panel, and the intake document auto-fill. Off by default; Write it still works fully by hand."
        enabled={aiTools}
        saving={saving === "ai"}
        onChange={(next) => update("ai_tools_enabled", next, "ai")}
      />
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
