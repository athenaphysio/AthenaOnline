"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clinicStyles from "../../clinic.module.css";

type Props = {
  patientId: string;
  allGroups: { id: string; name: string }[];
  initialGroupIds: string[];
};

// No separate save step -- every toggle sends the new full set immediately,
// matching "keep this manual and under my control": one click, done.
export default function PatientGroupsEditor({ patientId, allGroups, initialGroupIds }: Props) {
  const router = useRouter();
  const [groupIds, setGroupIds] = useState<Set<string>>(new Set(initialGroupIds));
  const [saving, setSaving] = useState<string | null>(null);

  async function toggle(groupId: string) {
    const next = new Set(groupIds);
    if (next.has(groupId)) next.delete(groupId);
    else next.add(groupId);
    setGroupIds(next);
    setSaving(groupId);
    try {
      const res = await fetch(`/api/clinic/patients/${patientId}/groups`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group_ids: Array.from(next) }),
      });
      if (!res.ok) throw new Error("Failed.");
      router.refresh();
    } catch {
      // Revert on failure.
      setGroupIds(groupIds);
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className={clinicStyles.card} style={{ borderLeft: "3px solid var(--accent-groups)" }}>
      <div className={clinicStyles.cardTitle}>Groups</div>
      {allGroups.length === 0 && (
        <p className={clinicStyles.notice} style={{ marginTop: 0 }}>
          No groups yet — create one from the Patients dashboard.
        </p>
      )}
      {allGroups.map((g) => (
        <label
          key={g.id}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", fontSize: 13.5 }}
        >
          <input
            type="checkbox"
            checked={groupIds.has(g.id)}
            disabled={saving === g.id}
            onChange={() => toggle(g.id)}
            style={{ accentColor: "var(--accent-groups)" }}
          />
          {g.name}
        </label>
      ))}
    </div>
  );
}
